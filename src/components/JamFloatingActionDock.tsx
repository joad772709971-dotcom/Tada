import React, { useState, useEffect } from 'react';
import { MessageCircle, Video, FileText, Calculator, Sparkles, X, ShieldCheck, Zap, Lock, ShieldAlert, Cpu, Database, BookOpen, Layers, CheckCircle2, RefreshCw, ChevronLeft, ChevronRight, Store, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router-dom';
import CommercialCalculator from './CommercialCalculator';

export default function JamFloatingActionDock() {
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [noteCount, setNoteCount] = useState(0);
  
  // Dock Visibility State (User can toggle on/off from sidebar or settings)
  const [isDockHidden, setIsDockHidden] = useState<boolean>(() => {
    return localStorage.getItem('jam_show_floating_dock') === 'false';
  });

  // 1. Default Hidden State: Menu and all tools are completely closed/hidden by default on startup
  const [isDockMinimized, setIsDockMinimized] = useState(true);
  const [showShieldRibbon, setShowShieldRibbon] = useState(false);
  
  // Mobile Edge Panel States
  const [isMobileEdgeOpen, setIsMobileEdgeOpen] = useState(false);
  const [isCleaningCache, setIsCleaningCache] = useState(false);
  const [cacheCleanedSuccess, setCacheCleanedSuccess] = useState(false);
  
  // 2. Mutual Exclusivity: Single state managing the active tool across all options
  const [activeTool, setActiveTool] = useState<'calculator' | 'notes' | 'mediaplayer' | 'chat' | 'assistant' | null>(null);

  // 3. Cyclic FAB Button logic for Quick Tasks
  const [cyclingIndex, setCyclingIndex] = useState(0);

  // 4. Cyclic FAB Logic for System Accelerator Shield
  const [shieldCyclingIndex, setShieldCyclingIndex] = useState(0);

  const location = useLocation();

  // Watcher for Route Navigation to close everything automatically
  useEffect(() => {
    setActiveTool(null);
    setIsDockMinimized(true);
    setShowShieldRibbon(false);
    setIsMobileEdgeOpen(false);
  }, [location.pathname]);

  const handlePerformCacheClean = () => {
    setIsCleaningCache(true);
    setTimeout(() => {
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('jam_cache_') || key.startsWith('jam_temp_')) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {}
      setIsCleaningCache(false);
      setCacheCleanedSuccess(true);
      setTimeout(() => setCacheCleanedSuccess(false), 2500);
    }, 1200);
  };


  const shieldSections = [
    {
      id: 'hwid',
      name: 'بصمات الأجهزة 🔑',
      tab: 'hwid',
      icon: <Cpu size={26} className="text-amber-300 animate-pulse" />,
      badgeBg: 'bg-amber-950/95 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
    },
    {
      id: 'security_tamper',
      name: 'درع منع التلاعب 🔒',
      tab: 'security',
      icon: <Lock size={26} className="text-emerald-400" />,
      badgeBg: 'bg-emerald-950/95 text-emerald-300 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
    },
    {
      id: 'barcode_shield',
      name: 'حماية الباركود 🛡️',
      tab: 'security',
      icon: <ShieldAlert size={26} className="text-teal-400" />,
      badgeBg: 'bg-teal-950/95 text-teal-300 border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.3)]'
    },
    {
      id: 'box_match',
      name: 'مطابقة النقدية 💰',
      tab: 'box_match',
      icon: <Calculator size={26} className="text-amber-400" />,
      badgeBg: 'bg-amber-950/95 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
    },
    {
      id: 'audit_safety',
      name: 'تدقيق المنظومة ⚡',
      tab: 'audit',
      icon: <Zap size={26} className="text-cyan-400 animate-pulse" />,
      badgeBg: 'bg-cyan-950/95 text-cyan-300 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
    },
    {
      id: 'ai_advisor',
      name: 'المعلم الذكي 🤖',
      tab: 'ai_advisor',
      icon: <Sparkles size={26} className="text-indigo-400" />,
      badgeBg: 'bg-indigo-950/95 text-indigo-300 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
    },
    {
      id: 'cache_cleaner',
      name: 'تنظيف الذاكرة 🚀',
      tab: 'cache',
      icon: <RefreshCw size={26} className="text-rose-400" />,
      badgeBg: 'bg-rose-950/95 text-rose-300 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
    },
    {
      id: 'audit_logs',
      name: 'سجل العمليات المعزز 📜',
      tab: 'audit_logs',
      icon: <Layers size={26} className="text-blue-400" />,
      badgeBg: 'bg-blue-950/95 text-blue-300 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
    },
    {
      id: 'guide',
      name: 'دليل التوجيه 📖',
      tab: 'guide',
      icon: <BookOpen size={26} className="text-emerald-400" />,
      badgeBg: 'bg-emerald-950/95 text-emerald-300 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
    }
  ];

  // Cycle the Shield section index every 3.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setShieldCyclingIndex(prev => (prev + 1) % shieldSections.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const currentShield = shieldSections[shieldCyclingIndex];

  const handleOpenShieldTab = (tab: string) => {
    setShowShieldRibbon(false);
    window.dispatchEvent(new CustomEvent('open-jam-optimizer', { detail: { tab } }));
  };

  // Sync the child component visibility when central activeTool changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('toggle-jam-chat', { detail: { open: activeTool === 'chat' } }));
    window.dispatchEvent(new CustomEvent('toggle-jam-scratchpad', { detail: { open: activeTool === 'notes' } }));
    window.dispatchEvent(new CustomEvent('toggle-jam-media-player', { detail: { open: activeTool === 'mediaplayer' } }));
    window.dispatchEvent(new CustomEvent('toggle-jam-assistant', { detail: { open: activeTool === 'assistant' } }));
    setIsCalcOpen(activeTool === 'calculator');
  }, [activeTool]);

  // Sync external tool closure back to our central activeTool state
  useEffect(() => {
    const handleToolClosed = (e: Event) => {
      const customEvent = e as CustomEvent;
      const closedTool = customEvent.detail?.tool;
      setActiveTool(current => {
        if (current === closedTool) return null;
        return current;
      });
    };
    
    window.addEventListener('jam-tool-closed', handleToolClosed);
    return () => window.removeEventListener('jam-tool-closed', handleToolClosed);
  }, []);

  // Listen to other components calling global toggles
  useEffect(() => {
    const handleChatToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      const forceOpen = customEvent.detail?.open;
      if (forceOpen === true) {
        setIsDockMinimized(false);
        setActiveTool(curr => curr !== 'chat' ? 'chat' : curr);
      } else if (forceOpen === false) {
        setActiveTool(curr => curr === 'chat' ? null : curr);
      }
    };

    const handleNotesToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      const forceOpen = customEvent.detail?.open;
      if (forceOpen === true) {
        setIsDockMinimized(false);
        setActiveTool(curr => curr !== 'notes' ? 'notes' : curr);
      } else if (forceOpen === false) {
        setActiveTool(curr => curr === 'notes' ? null : curr);
      }
    };

    const handleMediaToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      const forceOpen = customEvent.detail?.open;
      if (forceOpen === true) {
        setIsDockMinimized(false);
        setActiveTool(curr => curr !== 'mediaplayer' ? 'mediaplayer' : curr);
      } else if (forceOpen === false) {
        setActiveTool(curr => curr === 'mediaplayer' ? null : curr);
      }
    };

    const handleAssistantToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      const forceOpen = customEvent.detail?.open;
      if (forceOpen === true) {
        setIsDockMinimized(false);
        setActiveTool(curr => curr !== 'assistant' ? 'assistant' : curr);
      } else if (forceOpen === false) {
        setActiveTool(curr => curr === 'assistant' ? null : curr);
      }
    };

    const handleDockVisibilityToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      const hide = customEvent.detail?.hide;
      if (typeof hide === 'boolean') {
        setIsDockHidden(hide);
        localStorage.setItem('jam_show_floating_dock', hide ? 'false' : 'true');
      } else {
        setIsDockHidden(prev => {
          const next = !prev;
          localStorage.setItem('jam_show_floating_dock', next ? 'false' : 'true');
          return next;
        });
      }
    };

    window.addEventListener('toggle-jam-chat', handleChatToggle);
    window.addEventListener('toggle-jam-scratchpad', handleNotesToggle);
    window.addEventListener('toggle-jam-media-player', handleMediaToggle);
    window.addEventListener('toggle-jam-assistant', handleAssistantToggle);
    window.addEventListener('toggle-jam-floating-dock', handleDockVisibilityToggle);
    
    return () => {
      window.removeEventListener('toggle-jam-chat', handleChatToggle);
      window.removeEventListener('toggle-jam-scratchpad', handleNotesToggle);
      window.removeEventListener('toggle-jam-media-player', handleMediaToggle);
      window.removeEventListener('toggle-jam-assistant', handleAssistantToggle);
      window.removeEventListener('toggle-jam-floating-dock', handleDockVisibilityToggle);
    };
  }, []);

  // Cycle the icon of the FAB every 3 seconds to showcase tools
  useEffect(() => {
    const interval = setInterval(() => {
      setCyclingIndex(prev => (prev + 1) % 5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Get note count from localStorage to display badge
  const updateNoteCount = () => {
    try {
      const saved = localStorage.getItem('jam_quick_notes_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        setNoteCount(Array.isArray(parsed) ? parsed.length : 0);
      } else {
        setNoteCount(0);
      }
    } catch {
      setNoteCount(0);
    }
  };

  useEffect(() => {
    updateNoteCount();
    const handleStorage = () => updateNoteCount();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('click', updateNoteCount);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('click', updateNoteCount);
    };
  }, []);

  const [hoveredTool, setHoveredTool] = useState<'calculator' | 'notes' | 'mediaplayer' | 'chat' | 'assistant' | null>(null);

  const toggleTool = (tool: 'calculator' | 'notes' | 'mediaplayer' | 'chat' | 'assistant') => {
    setActiveTool(current => current === tool ? null : tool);
  };

  const getCyclingInfo = () => {
    switch (cyclingIndex) {
      case 0:
        return {
          id: 'calculator' as const,
          name: 'الحاسبة التجارية',
          icon: <Calculator size={26} className="text-[#ffd700]" />,
          badgeBg: 'bg-amber-950/90 text-amber-300 border-amber-500/40'
        };
      case 1:
        return {
          id: 'notes' as const,
          name: 'ملاحظات المهام',
          icon: <FileText size={26} className="text-teal-400" />,
          badgeBg: 'bg-teal-950/90 text-teal-300 border-teal-500/40'
        };
      case 2:
        return {
          id: 'chat' as const,
          name: 'دردشة ومساندة',
          icon: <MessageCircle size={26} className="text-indigo-400" />,
          badgeBg: 'bg-indigo-950/90 text-indigo-300 border-indigo-500/40'
        };
      case 3:
        return {
          id: 'mediaplayer' as const,
          name: 'المركز التعليمي والميديا',
          icon: <Video size={26} className="text-amber-500 animate-pulse" />,
          badgeBg: 'bg-amber-950/90 text-amber-300 border-amber-500/40'
        };
      case 4:
        return {
          id: 'assistant' as const,
          name: 'المساعد الذكي',
          icon: <Sparkles size={26} className="text-emerald-400 animate-pulse" />,
          badgeBg: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40'
        };
      default:
        return {
          id: 'calculator' as const,
          name: 'الحاسبة التجارية',
          icon: <Calculator size={26} className="text-[#ffd700]" />,
          badgeBg: 'bg-amber-950/90 text-amber-300 border-amber-500/40'
        };
    }
  };

  const currentInfo = getCyclingInfo();

  return (
    <>
      {/* 1. Commercial Calculator Overlay */}
      <CommercialCalculator 
        isOpen={isCalcOpen} 
        onClose={() => {
          setIsCalcOpen(false);
          setActiveTool(null);
        }} 
      />

      {/* 📱 MOBILE FLOATING EDGE HANDLE & SLIDE-IN PANEL */}
      <div className="block lg:hidden">
        {/* Sleek Edge Trigger Handle on Left Screen Border */}
        <button
          type="button"
          onClick={() => setIsMobileEdgeOpen(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-[9998] bg-gradient-to-r from-amber-500/90 to-yellow-600/90 hover:from-amber-400 text-black font-black pl-1.5 pr-2.5 py-3 rounded-r-2xl shadow-[0_5px_20px_rgba(212,175,55,0.4)] border-y border-r border-amber-300/60 flex flex-col items-center gap-1 active:scale-95 transition-all cursor-pointer"
          title="لوحة درع المهام السريعة"
        >
          <Zap size={15} className="animate-pulse" />
          <span className="text-[8px] font-black tracking-tighter" style={{ writingMode: 'vertical-rl' }}>
            درع JAM
          </span>
        </button>

        {/* Mobile Edge Slide-in Drawer */}
        <AnimatePresence>
          {isMobileEdgeOpen && (
            <div className="fixed inset-0 z-[99999] flex" dir="rtl">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileEdgeOpen(false)}
                className="fixed inset-0 bg-black/75 backdrop-blur-sm"
              />

              {/* Edge Side Panel */}
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative z-10 w-[300px] max-w-[85vw] h-full bg-[#05070e] border-r-2 border-amber-400/40 shadow-[10px_0_50px_rgba(0,0,0,0.8)] flex flex-col p-5 overflow-y-auto"
              >
                {/* Panel Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-400/10 border border-amber-400/30 rounded-xl text-amber-400">
                      <Zap size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">لوحة المهام والدرع السريع</h4>
                      <p className="text-[9px] text-amber-400 font-bold">JAM SYSTEM PRO EDGE</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMobileEdgeOpen(false)}
                    className="p-1.5 text-gray-400 hover:text-white rounded-lg bg-white/5"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Section 1: Quick Tasks */}
                <div className="space-y-3 mb-6">
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">
                    ⚡ المهام السريعة
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {/* Media Player */}
                    <button
                      onClick={() => {
                        toggleTool('mediaplayer');
                        setIsMobileEdgeOpen(false);
                      }}
                      className={`p-3 rounded-2xl border text-right flex flex-col items-start gap-1.5 transition-all ${
                        activeTool === 'mediaplayer'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
                      }`}
                    >
                      <Video size={18} className="text-amber-400" />
                      <span className="text-[11px] font-bold">مشغل الميديا</span>
                    </button>

                    {/* Commercial Calculator */}
                    <button
                      onClick={() => {
                        toggleTool('calculator');
                        setIsMobileEdgeOpen(false);
                      }}
                      className={`p-3 rounded-2xl border text-right flex flex-col items-start gap-1.5 transition-all ${
                        activeTool === 'calculator'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
                      }`}
                    >
                      <Calculator size={18} className="text-yellow-400" />
                      <span className="text-[11px] font-bold">الحاسبة التجارية</span>
                    </button>

                    {/* Quick Scratchpad */}
                    <button
                      onClick={() => {
                        toggleTool('notes');
                        setIsMobileEdgeOpen(false);
                      }}
                      className={`p-3 rounded-2xl border text-right flex flex-col items-start gap-1.5 transition-all ${
                        activeTool === 'notes'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
                      }`}
                    >
                      <FileText size={18} className="text-emerald-400" />
                      <span className="text-[11px] font-bold">المفكرة والملاحظات</span>
                    </button>

                    {/* Live Support / Chat */}
                    <button
                      onClick={() => {
                        toggleTool('chat');
                        setIsMobileEdgeOpen(false);
                      }}
                      className={`p-3 rounded-2xl border text-right flex flex-col items-start gap-1.5 transition-all ${
                        activeTool === 'chat'
                          ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300'
                          : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
                      }`}
                    >
                      <MessageCircle size={18} className="text-indigo-400" />
                      <span className="text-[11px] font-bold">الدردشة والمساندة</span>
                    </button>
                  </div>

                  {/* AI Assistant Button */}
                  <button
                    onClick={() => {
                      toggleTool('assistant');
                      setIsMobileEdgeOpen(false);
                    }}
                    className="w-full p-3 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-teal-950/80 border border-emerald-500/40 text-emerald-300 flex items-center justify-between font-bold text-xs hover:brightness-110"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-emerald-400 animate-pulse" />
                      <span>المساعد الذكي التفاعلي</span>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-md">JAM AI</span>
                  </button>
                </div>

                {/* Section 2: Shield & Performance Accelerator */}
                <div className="space-y-3">
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">
                    🛡️ درع وتسريع النظام
                  </span>

                  {/* Cache Cleaner Action */}
                  <button
                    onClick={handlePerformCacheClean}
                    disabled={isCleaningCache}
                    className="w-full p-3 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 flex items-center justify-between text-xs font-bold hover:bg-rose-950/70 active:scale-98 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw size={16} className={isCleaningCache ? 'animate-spin text-rose-400' : 'text-rose-400'} />
                      <span>{cacheCleanedSuccess ? 'تم تنظيف الكاش بنجاح ✓' : 'تنظيف الذاكرة المؤقتة'}</span>
                    </div>
                    <span className="text-[9px] bg-rose-500/20 px-2 py-0.5 rounded text-rose-200">
                      {isCleaningCache ? 'جاري...' : 'تسريع ⚡'}
                    </span>
                  </button>

                  {/* Shield Tools Shortcuts */}
                  <div className="space-y-1.5">
                    {shieldSections.slice(0, 4).map(sec => (
                      <button
                        key={sec.id}
                        onClick={() => handleOpenShieldTab(sec.tab)}
                        className="w-full p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-right flex items-center justify-between text-[11px] font-bold text-gray-300 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="scale-75">{sec.icon}</span>
                          <span>{sec.name}</span>
                        </div>
                        <ChevronLeft size={14} className="text-gray-500" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer Brand Info */}
                <div className="mt-auto pt-6 border-t border-white/5 text-center">
                  <p className="text-[9px] text-gray-500 font-bold">JAM SYSTEM PRO • المحرك المطور</p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Floating Action Dock Widgets */}

      {!isDockHidden && (
        <div 
          className="hidden lg:flex fixed bottom-6 left-6 z-[9990] flex-col items-start gap-3 select-none"
          id="jam-floating-dock-wrapper"
          dir="ltr"
        >
          {/* 🛡️ TOP BUTTON: System Accelerator Shield Button with Dynamic Section Names & Icons */}
          <div className="relative flex items-center gap-2">
            <div className="relative flex items-center">
              {/* Compact Cyclic Shield Button directly opening optimizer window */}
              <button
                onClick={() => handleOpenShieldTab(currentShield.tab)}
                type="button"
                style={{
                  background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.95) 0%, rgba(4, 47, 38, 0.98) 100%)',
                  border: '2px solid rgba(52, 211, 153, 0.85)',
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)'
                }}
                className="w-[42px] h-[42px] sm:w-[54px] sm:h-[54px] rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer shrink-0 z-10 relative group"
                title="انقر لفتح قسم درع ومسرع المنظومة المباشر"
              >
                <span className="absolute -top-1 -right-1 flex h-3 w-3 sm:h-3.5 sm:w-3.5 z-20">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 sm:h-3.5 sm:w-3.5 bg-emerald-400"></span>
                </span>

                {/* Dynamic Icon corresponding to active section */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`shield-icon-${shieldCyclingIndex}`}
                    initial={{ opacity: 0, scale: 0.7, rotate: -20 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.7, rotate: 20 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center justify-center scale-90 sm:scale-100"
                  >
                    {currentShield.icon}
                  </motion.div>
                </AnimatePresence>
              </button>

              {/* Dynamic Section Name Badge displayed to the RIGHT of the Shield button */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`shield-label-${shieldCyclingIndex}`}
                  initial={{ opacity: 0, x: -8, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -8, scale: 0.9 }}
                  transition={{ duration: 0.25 }}
                  className={`absolute left-full ml-2 sm:ml-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md border text-[8px] sm:text-[10px] font-bold whitespace-nowrap backdrop-blur-md cursor-pointer z-20 ${currentShield.badgeBg}`}
                  dir="rtl"
                  onClick={() => handleOpenShieldTab(currentShield.tab)}
                >
                  {currentShield.name}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* ⚡ BOTTOM BUTTON: Quick Task Drawer Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex items-center">
              {/* Enriched Cyclic Floating Action Button for Quick Tasks */}
              <button
                onClick={() => setIsDockMinimized(!isDockMinimized)}
                type="button"
                style={{
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(3, 7, 18, 0.98) 100%)',
                  border: '2px solid rgba(212, 175, 55, 0.75)',
                  boxShadow: '0 8px 28px rgba(0,0,0,0.6)'
                }}
                className="w-[42px] h-[42px] sm:w-[54px] sm:h-[54px] rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer shrink-0 z-10"
                title={isDockMinimized ? "فتح درج المهام السريعة" : "إغلاق الدرج"}
              >
                {isDockMinimized ? (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={cyclingIndex}
                      initial={{ opacity: 0, scale: 0.7, rotate: -20 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.7, rotate: 20 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center justify-center scale-90 sm:scale-100"
                    >
                      {currentInfo.icon}
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <motion.div
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    className="text-[#ffd700] flex items-center justify-center"
                  >
                    <X size={22} className="sm:w-6 sm:h-6" />
                  </motion.div>
                )}
              </button>

            {/* Dynamic Label displayed to the RIGHT of the main button when minimized */}
            <AnimatePresence mode="wait">
              {isDockMinimized && (
                <motion.div
                  key={`fab-label-${cyclingIndex}`}
                  initial={{ opacity: 0, x: -8, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -8, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className={`absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md border shadow-md text-[9px] sm:text-[10px] font-bold whitespace-nowrap pointer-events-none select-none z-20 ${currentInfo.badgeBg}`}
                  dir="rtl"
                >
                  {currentInfo.name}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* List of 5 Interactive Tools inside Quick Task Drawer */}
          <AnimatePresence>
            {!isDockMinimized && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, x: -20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                style={{
                  background: 'linear-gradient(135deg, rgba(9, 15, 30, 0.96) 0%, rgba(3, 7, 18, 0.98) 100%)',
                  border: '1.5px solid rgba(212, 175, 55, 0.4)',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.65), 0 0 20px rgba(212,175,55,0.1)'
                }}
                className="px-3.5 py-2.5 pt-7 pb-3 rounded-2xl flex items-end gap-3.5 backdrop-blur-md relative"
                dir="rtl"
              >
                {/* Button AI: Smart AI Accountant */}
                <div 
                  className="flex flex-col items-center gap-1.5 relative"
                  onMouseEnter={() => setHoveredTool('assistant')}
                  onMouseLeave={() => setHoveredTool(null)}
                >
                  <AnimatePresence>
                    {(hoveredTool === 'assistant') && (
                      <motion.span 
                        initial={{ opacity: 0, y: 4, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.9 }}
                        className="absolute bottom-full mb-2 text-[10px] sm:text-xs font-black text-amber-300 tracking-tight bg-amber-950/90 px-2 py-0.5 rounded-lg border border-amber-500/40 whitespace-nowrap shadow-md pointer-events-none"
                      >
                        المحاسب الذكي 🤖
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('open-smart-ai-accountant'))}
                    type="button"
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 relative group bg-gradient-to-tr from-amber-500/20 via-yellow-400/25 to-amber-500/20 hover:from-amber-500 hover:to-yellow-500 border border-amber-500/50 text-amber-400 hover:text-slate-950 shadow-md"
                    title="المحاسب الذكي والمستشار المالي (نظام العزل والتحليلات)"
                  >
                    <Bot size={24} className="group-hover:rotate-12 transition-transform text-amber-400 group-hover:text-slate-950" />
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full border border-slate-900 animate-pulse" />
                  </button>
                </div>

                {/* Button A: Chat */}
                <div 
                  className="flex flex-col items-center gap-1.5 relative"
                  onMouseEnter={() => setHoveredTool('chat')}
                  onMouseLeave={() => setHoveredTool(null)}
                >
                  <AnimatePresence>
                    {(hoveredTool === 'chat' || activeTool === 'chat') && (
                      <motion.span 
                        initial={{ opacity: 0, y: 4, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.9 }}
                        className="absolute bottom-full mb-2 text-[10px] sm:text-xs font-black text-indigo-300 tracking-tight bg-indigo-950/90 px-2 py-0.5 rounded-lg border border-indigo-500/40 whitespace-nowrap shadow-md pointer-events-none"
                      >
                        دردشة ومساندة
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => toggleTool('chat')}
                    type="button"
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 relative group ${
                      activeTool === 'chat' 
                        ? 'bg-indigo-600 text-white border border-indigo-400 shadow-lg' 
                        : 'bg-indigo-600/15 hover:bg-indigo-600 border border-indigo-500/40 text-indigo-400 hover:text-white'
                    }`}
                    title="الدردشة السريعة والمحادثة"
                  >
                    <MessageCircle size={24} />
                    <span className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-slate-900 animate-pulse" />
                  </button>
                </div>

                {/* Button B: Video Player */}
                <div 
                  className="flex flex-col items-center gap-1.5 relative"
                  onMouseEnter={() => setHoveredTool('mediaplayer')}
                  onMouseLeave={() => setHoveredTool(null)}
                >
                  <AnimatePresence>
                    {(hoveredTool === 'mediaplayer' || activeTool === 'mediaplayer') && (
                      <motion.span 
                        initial={{ opacity: 0, y: 4, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.9 }}
                        className="absolute bottom-full mb-2 text-[10px] sm:text-xs font-black text-amber-300 tracking-tight bg-amber-950/90 px-2 py-0.5 rounded-lg border border-amber-500/40 whitespace-nowrap shadow-md pointer-events-none"
                      >
                        المركز التعليمي والميديا
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => toggleTool('mediaplayer')}
                    type="button"
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 relative group ${
                      activeTool === 'mediaplayer'
                        ? 'bg-[#cf8a3c] text-white border border-[#cf8a3c] shadow-lg'
                        : 'bg-[#cf8a3c]/15 hover:bg-[#cf8a3c] border border-[#cf8a3c]/40 text-amber-500 hover:text-slate-950'
                    }`}
                    title="فتح المجمع التعليمي والتشغيل التلقائي"
                  >
                    <Video size={24} className={activeTool !== 'mediaplayer' ? "animate-pulse" : ""} />
                  </button>
                </div>

                {/* Button C: Quick Notes */}
                <div 
                  className="flex flex-col items-center gap-1.5 relative"
                  onMouseEnter={() => setHoveredTool('notes')}
                  onMouseLeave={() => setHoveredTool(null)}
                >
                  <AnimatePresence>
                    {(hoveredTool === 'notes' || activeTool === 'notes') && (
                      <motion.span 
                        initial={{ opacity: 0, y: 4, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.9 }}
                        className="absolute bottom-full mb-2 text-[10px] sm:text-xs font-black text-teal-300 tracking-tight bg-teal-950/90 px-2 py-0.5 rounded-lg border border-teal-500/40 whitespace-nowrap shadow-md pointer-events-none"
                      >
                        ملاحظات المهام
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => toggleTool('notes')}
                    type="button"
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 relative group ${
                      activeTool === 'notes'
                        ? 'bg-teal-600 text-white border border-teal-400 shadow-lg'
                        : 'bg-teal-600/15 hover:bg-teal-600 border border-teal-500/40 text-teal-400 hover:text-white'
                    }`}
                    title="مفكرة الملحوظات وحفظ المهام"
                  >
                    <FileText size={24} />
                    {noteCount > 0 && (
                      <span className="absolute -top-1.5 -left-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-teal-400 text-slate-950 font-black text-[10px] flex items-center justify-center border border-slate-900 select-none shadow">
                        {noteCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Button D: Commercial Calculator */}
                <div 
                  className="flex flex-col items-center gap-1.5 relative"
                  onMouseEnter={() => setHoveredTool('calculator')}
                  onMouseLeave={() => setHoveredTool(null)}
                >
                  <AnimatePresence>
                    {(hoveredTool === 'calculator' || activeTool === 'calculator') && (
                      <motion.span 
                        initial={{ opacity: 0, y: 4, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.9 }}
                        className="absolute bottom-full mb-2 text-[10px] sm:text-xs font-black text-amber-300 tracking-tight bg-amber-950/90 px-2 py-0.5 rounded-lg border border-amber-500/40 whitespace-nowrap shadow-md pointer-events-none"
                      >
                        الحاسبة التجارية
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => toggleTool('calculator')}
                    type="button"
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 relative group ${
                      activeTool === 'calculator'
                        ? 'bg-amber-400 text-slate-950 border border-amber-300 font-bold shadow-lg'
                        : 'bg-[#ffd700]/15 hover:bg-[#ffd700] border border-[#ffd700]/40 text-[#ffd700] hover:text-slate-950'
                    }`}
                    title="الحاسبة التجارية"
                  >
                    <Calculator size={24} />
                  </button>
                </div>

                {/* Button E: Smart Assistant */}
                <div 
                  className="flex flex-col items-center gap-1.5 relative"
                  onMouseEnter={() => setHoveredTool('assistant')}
                  onMouseLeave={() => setHoveredTool(null)}
                >
                  <AnimatePresence>
                    {(hoveredTool === 'assistant' || activeTool === 'assistant') && (
                      <motion.span 
                        initial={{ opacity: 0, y: 4, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.9 }}
                        className="absolute bottom-full mb-2 text-[10px] sm:text-xs font-black text-emerald-300 tracking-tight bg-emerald-950/90 px-2 py-0.5 rounded-lg border border-emerald-500/40 whitespace-nowrap shadow-md pointer-events-none"
                      >
                        المساعد الذكي
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => toggleTool('assistant')}
                    type="button"
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 relative group ${
                      activeTool === 'assistant'
                        ? 'bg-emerald-600 text-white border border-emerald-400 shadow-lg'
                        : 'bg-emerald-600/15 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-400 hover:text-white'
                    }`}
                    title="المساعد الذكي التفاعلي"
                  >
                    <Sparkles size={24} className={activeTool !== 'assistant' ? "animate-pulse" : ""} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      )}
    </>
  );
}
