import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  Upload, 
  Video, 
  Music, 
  FastForward, 
  RotateCw, 
  X, 
  Sparkles, 
  Radio, 
  Layers, 
  Smartphone,
  ChevronDown,
  ListMusic,
  Plus,
  Trash2,
  SkipForward,
  SkipBack,
  Repeat,
  Repeat1,
  Shuffle,
  FolderOpen
} from 'lucide-react';
import { globalAudioEngine, GlobalAudioState } from '../services/GlobalAudioEngine';

interface UniversalMediaPlayerProps {
  isDark?: boolean;
}

export default function UniversalMediaPlayer({ isDark = true }: UniversalMediaPlayerProps) {
  const [audioState, setAudioState] = useState<GlobalAudioState>(() => globalAudioEngine.getState());
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'icon_bubble' | 'compact' | 'full'>('full');
  const [isTrueFullscreen, setIsTrueFullscreen] = useState(false);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendFileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Subscribe to persistent GlobalAudioEngine
  useEffect(() => {
    const unsubscribe = globalAudioEngine.subscribe((state) => {
      setAudioState(state);
    });
    return () => unsubscribe();
  }, []);

  // Bind video element whenever it mounts or changes
  useEffect(() => {
    if (audioState.isVideo && videoRef.current) {
      globalAudioEngine.bindVideoElement(videoRef.current);
    }
  }, [audioState.isVideo, isWidgetOpen, viewMode, audioState.currentIndex]);

  // Listen to open/close/toggle events from anywhere in the app (Dock, Header, Customer Portal, Keyboard shortcuts)
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      const forceOpen = customEvent.detail?.open;
      setIsWidgetOpen((prev) => (forceOpen !== undefined ? forceOpen : !prev));
      if (forceOpen === true || forceOpen === undefined) {
        setViewMode('full');
      }
    };

    window.addEventListener('toggle-jam-media-player', handleToggle);
    return () => window.removeEventListener('toggle-jam-media-player', handleToggle);
  }, []);

  // Format time utility
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  // Initial media file selection (replaces playlist)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      globalAudioEngine.loadFiles(Array.from(files));
      setIsWidgetOpen(true);
      setViewMode('full');
    }
    // reset input so same file can be selected again
    e.target.value = '';
  };

  // Add more files to existing playlist
  const handleAppendFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      globalAudioEngine.addFilesToPlaylist(Array.from(files));
      setIsPlaylistOpen(true);
    }
    e.target.value = '';
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      if (audioState.hasMedia) {
        globalAudioEngine.addFilesToPlaylist(files);
        setIsPlaylistOpen(true);
      } else {
        globalAudioEngine.loadFiles(files);
      }
      setIsWidgetOpen(true);
      setViewMode('full');
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
        setIsTrueFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsTrueFullscreen(false);
      }
    } catch (e) {
      console.warn('Fullscreen error:', e);
    }
  };

  const enablePictureInPicture = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      } catch (err) {
        console.warn('PiP error:', err);
      }
    }
  };

  // If player is closed and has no active playing track, hide completely
  if (!isWidgetOpen && !audioState.isPlaying && !audioState.hasMedia) {
    return null;
  }

  // Safe portal container target: if document is in fullscreen mode, mount to the fullscreen element
  // so the media player is NEVER obscured by fullscreen wrappers or native APK layers!
  const portalTarget = typeof document !== 'undefined' 
    ? (document.fullscreenElement || document.body) 
    : null;

  if (!portalTarget) return null;

  // --- 1. ANDROID APP-ICON FLOATING BUBBLE (حجم ومظهر أيقونة تطبيق أندرويد) ---
  if (viewMode === 'icon_bubble') {
    const progressPercent = audioState.duration > 0 ? (audioState.currentTime / audioState.duration) * 100 : 0;

    const bubbleContent = (
      <div 
        id="jam-audio-android-icon-bubble"
        dir="rtl"
        className="fixed bottom-6 left-6 z-[9999999] group select-none animate-in zoom-in-75 duration-300"
      >
        {/* Floating Android Icon Widget */}
        <div className="relative flex items-center">
          {/* Main 56px x 56px Android App Icon */}
          <div 
            onClick={() => setViewMode('full')}
            className={`w-14 h-14 rounded-[1.25rem] bg-gradient-to-br from-[#0c182a] to-[#040812] border-2 ${
              audioState.isPlaying ? 'border-[#d4af37] shadow-[0_0_25px_rgba(212,175,55,0.45)]' : 'border-white/20 shadow-xl'
            } flex items-center justify-center cursor-pointer relative overflow-hidden transition-all duration-300 hover:scale-110 active:scale-95`}
            title={`${audioState.fileName || 'مشغل الميديا'} - انقر للتكبير والتنقل`}
          >
            {/* Fixed Disc / Luxury Vinyl Artwork */}
            <div 
              className="w-10 h-10 rounded-full border border-[#d4af37]/40 flex items-center justify-center bg-radial from-[#1e293b] to-black"
            >
              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-400 to-[#d4af37] flex items-center justify-center shadow-inner">
                {audioState.isVideo ? (
                  <Video size={9} className="text-slate-950 font-black" />
                ) : (
                  <Music size={9} className="text-slate-950 font-black" />
                )}
              </div>
            </div>

            {/* Circular Progress Ring Overlay */}
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 56 56">
              <circle
                cx="28"
                cy="28"
                r="25"
                stroke="currentColor"
                strokeWidth="2"
                fill="transparent"
                className="text-white/5"
              />
              <circle
                cx="28"
                cy="28"
                r="25"
                stroke="#d4af37"
                strokeWidth="2.5"
                strokeDasharray="157"
                strokeDashoffset={157 - (157 * progressPercent) / 100}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-200"
              />
            </svg>

            {/* Live Wave Pulsing Equalizer Badge (Top Corner) */}
            {audioState.isPlaying && (
              <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-black"></span>
              </span>
            )}
          </div>

          {/* Quick Play/Pause Badge Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              globalAudioEngine.togglePlay();
            }}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 flex items-center justify-center shadow-lg border-2 border-[#09152b] cursor-pointer transition-transform hover:scale-110 active:scale-90"
            title={audioState.isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
          >
            {audioState.isPlaying ? <Pause size={10} className="fill-current" /> : <Play size={10} className="fill-current translate-x-[0.5px]" />}
          </button>

          {/* Hover / Slide-out Mini Controls Pill on desktop */}
          <div className="hidden group-hover:flex items-center gap-2 bg-[#09152b]/95 backdrop-blur-md border border-[#d4af37]/30 px-3 py-1.5 rounded-2xl shadow-2xl mr-3 text-xs text-white animate-in fade-in slide-in-from-left-2 duration-200">
            <span className="text-[11px] font-bold text-[#d4af37] max-w-[130px] truncate" title={audioState.fileName}>
              {audioState.fileName || 'مشغل الميديا'}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">
              {formatTime(audioState.currentTime)}
            </span>
            <button
              onClick={() => setViewMode('full')}
              className="p-1 hover:bg-white/10 rounded-lg text-sky-400"
              title="تكبير المشغل"
            >
              <Maximize2 size={12} />
            </button>
            <button
              onClick={() => globalAudioEngine.stopAndClose()}
              className="p-1 hover:bg-rose-500/20 text-rose-400 rounded-lg"
              title="إغلاق نهائي"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      </div>
    );

    return createPortal(bubbleContent, portalTarget);
  }

  // --- 2. COMPACT / FULL INTERACTIVE PLAYER MODAL / FLOATING CARD ---
  const playerContent = (
    <div 
      ref={containerRef}
      dir="rtl"
      id="jam-universal-media-player"
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`fixed z-[9999999] transition-all duration-300 select-none ${
        isTrueFullscreen
          ? 'inset-0 w-screen h-screen bg-black flex flex-col justify-between p-6'
          : 'bottom-4 left-4 sm:left-6 max-w-[calc(100vw-2rem)] w-[390px] sm:w-[460px] rounded-3xl bg-gradient-to-b from-[#0a182d] via-[#050e1d] to-[#020710] border-2 border-[#d4af37]/45 shadow-[0_20px_60px_rgba(0,0,0,0.92)] p-4 text-white overflow-hidden backdrop-blur-2xl'
      } ${isDragOver ? 'ring-4 ring-amber-400/60 ring-dashed scale-[1.01]' : ''}`}
    >
      {/* Hidden File Inputs for Primary & Appending Media */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        multiple
        accept="audio/*,video/*,.mp3,.mp4,.m4a,.wav,.ogg,.webm,.flac,.aac,.opus,.weba,.mkv,.avi,.mov,.wmv,.3gp,.ts,.m3u8" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={appendFileInputRef} 
        onChange={handleAppendFiles} 
        multiple
        accept="audio/*,video/*,.mp3,.mp4,.m4a,.wav,.ogg,.webm,.flac,.aac,.opus,.weba,.mkv,.avi,.mov,.wmv,.3gp,.ts,.m3u8" 
        className="hidden" 
      />

      {/* Top Action & Navigation Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className={`p-2 rounded-xl shrink-0 ${audioState.isPlaying ? 'bg-[#d4af37]/20 text-[#d4af37] animate-pulse' : 'bg-white/5 text-gray-400'}`}>
            {audioState.isVideo ? <Video size={16} /> : <Music size={16} />}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-black text-[#d4af37] truncate max-w-[170px] sm:max-w-[200px]" title={audioState.fileName || 'مشغل الميديا الشامل'}>
              {audioState.fileName || 'مشغل الميديا الشامل'}
            </span>
            <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>إشعارات الخلفية ونظام الستارة 📱🟢</span>
            </div>
          </div>
        </div>

        {/* Header Action Buttons with Safe Spacing and Tooltips */}
        <div className="flex items-center gap-1.5">
          {/* Fullscreen Button for Video */}
          {audioState.isVideo && (
            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-white/10 text-gray-300 rounded-xl transition"
              title="ملء الشاشة 🗖"
            >
              {isTrueFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}

          {/* Picture-in-Picture for Video */}
          {audioState.isVideo && (
            <button
              onClick={enablePictureInPicture}
              className="p-1.5 hover:bg-white/10 text-gray-300 rounded-xl transition"
              title="نافذة عائمة بالفيديو (PiP)"
            >
              <FastForward size={14} className="rotate-90" />
            </button>
          )}

          {/* Playlist Toggle Button */}
          <button
            onClick={() => setIsPlaylistOpen(!isPlaylistOpen)}
            className={`p-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 transition cursor-pointer border ${
              isPlaylistOpen 
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md' 
                : 'bg-white/5 hover:bg-white/15 text-amber-300 border-white/10'
            }`}
            title="قائمة التشغيل والملفات المضافة 📋"
          >
            <ListMusic size={14} />
            {audioState.playlist.length > 0 && (
              <span className="text-[9px] font-mono px-1 rounded bg-black/40">
                {audioState.playlist.length}
              </span>
            )}
          </button>

          {/* 🌟 Button: Minimize to Android Floating App Icon (Spaced with clear tooltip) */}
          <div className="relative pl-1.5 pr-1 border-r border-white/20">
            <button
              onClick={() => setViewMode('icon_bubble')}
              className="p-1.5 bg-[#d4af37]/20 hover:bg-[#d4af37]/40 text-[#d4af37] rounded-xl text-[10px] font-bold flex items-center gap-1 transition cursor-pointer border border-[#d4af37]/40 shadow-sm active:scale-95 group/min"
              title="تصغير المشغل إلى أيقونة عائمة (استمرار التشغيل بالخلفية)"
            >
              <Smartphone size={13} className="text-amber-400" />
              <span className="text-[10px]">تصغير</span>
            </button>
          </div>

          {/* Close and Stop Button (Safe Distance with Red Accent) */}
          <button
            onClick={() => {
              globalAudioEngine.stopAndClose();
              setIsWidgetOpen(false);
            }}
            className="p-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 rounded-xl transition active:scale-95 cursor-pointer mr-0.5"
            title="إيقاف وإغلاق المشغل نهائياً ✕"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Media Content Display */}
      {audioState.hasMedia ? (
        <div className="space-y-3">
          {/* Video Preview Canvas if file is a video */}
          {audioState.isVideo && (
            <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                playsInline
                webkit-playsinline="true"
                style={{ transform: `rotate(${audioState.rotationAngle}deg)` }}
                onClick={() => globalAudioEngine.togglePlay()}
              />
              <button
                onClick={() => globalAudioEngine.rotateVideo()}
                className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black/90 text-[#d4af37] rounded-lg text-xs backdrop-blur-md border border-white/10 shadow"
                title="تدوير الفيديو 90°"
              >
                <RotateCw size={13} />
              </button>
            </div>
          )}

          {/* Audio Visualizer & Wave Animation if audio */}
          {!audioState.isVideo && (
            <div className="w-full py-3.5 px-4 bg-white/[0.04] border border-white/10 rounded-2xl flex items-center justify-between shadow-inner">
              {/* Fixed Disc Avatar Artwork */}
              <div className="flex items-center gap-3 overflow-hidden">
                <div 
                  className="w-11 h-11 rounded-full border-2 border-[#d4af37]/60 shrink-0 flex items-center justify-center bg-radial from-[#1e293b] to-black shadow-lg"
                >
                  <Music size={16} className="text-[#ffd700]" />
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-xs font-black text-white truncate max-w-[150px] sm:max-w-[180px]" title={audioState.fileName}>
                    {audioState.fileName}
                  </h4>
                  <p className="text-[10px] text-gray-400 font-mono">
                    {audioState.playlist.length > 1 ? `المسار ${audioState.currentIndex + 1} من ${audioState.playlist.length}` : 'تشغيل مستمر'}
                  </p>
                </div>
              </div>

              {/* Animated Audio Equalizer Bars */}
              <div className="flex items-end gap-1 h-7 shrink-0">
                {[40, 75, 100, 60, 90, 45, 80, 55].map((height, idx) => (
                  <div
                    key={idx}
                    className={`w-1 bg-gradient-to-t from-amber-500 to-yellow-300 rounded-full transition-all duration-300 ${
                      audioState.isPlaying ? 'animate-pulse' : 'opacity-30'
                    }`}
                    style={{
                      height: audioState.isPlaying ? `${height}%` : '20%',
                      animationDelay: `${idx * 0.15}s`
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Progress Timeline Slider */}
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={audioState.duration || 100}
              step={0.1}
              value={audioState.currentTime}
              onChange={(e) => globalAudioEngine.seek(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#d4af37]"
            />
            <div className="flex justify-between text-[10px] font-mono text-gray-400">
              <span>{formatTime(audioState.currentTime)}</span>
              <span>{formatTime(audioState.duration)}</span>
            </div>
          </div>

          {/* Center Playback Controls */}
          <div className="flex items-center justify-between pt-1">
            {/* Left Controls: Repeat & Shuffle */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => globalAudioEngine.toggleRepeat()}
                className={`p-1.5 rounded-xl border transition ${
                  audioState.repeatMode !== 'off' 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                    : 'text-gray-400 border-transparent hover:bg-white/5'
                }`}
                title={`وضع التكرار: ${audioState.repeatMode === 'one' ? 'تكرار نفس المسار' : audioState.repeatMode === 'all' ? 'تكرار الكل' : 'إيقاف التكرار'}`}
              >
                {audioState.repeatMode === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
              </button>
              <button
                onClick={() => globalAudioEngine.toggleShuffle()}
                className={`p-1.5 rounded-xl border transition ${
                  audioState.isShuffle 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                    : 'text-gray-400 border-transparent hover:bg-white/5'
                }`}
                title={`تشغيل عشوائي: ${audioState.isShuffle ? 'مفعل' : 'معطل'}`}
              >
                <Shuffle size={14} />
              </button>
            </div>

            {/* Center Buttons: Prev - SeekBack - Play/Pause - SeekForward - Next */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => globalAudioEngine.prevTrack()}
                className="p-1.5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl transition active:scale-90"
                title="المسار السابق ⏮"
              >
                <SkipBack size={16} />
              </button>

              <button
                onClick={() => globalAudioEngine.seekBy(-10)}
                className="p-1.5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl transition text-[11px] font-mono font-bold active:scale-90"
                title="رجوع 10 ثوانٍ"
              >
                -10s
              </button>

              <button
                onClick={() => globalAudioEngine.togglePlay()}
                className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 text-slate-950 flex items-center justify-center shadow-lg shadow-yellow-500/25 active:scale-95 transition cursor-pointer"
                title={audioState.isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
              >
                {audioState.isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current translate-x-[1px]" />}
              </button>

              <button
                onClick={() => globalAudioEngine.seekBy(10)}
                className="p-1.5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl transition text-[11px] font-mono font-bold active:scale-90"
                title="تقدم 10 ثوانٍ"
              >
                +10s
              </button>

              <button
                onClick={() => globalAudioEngine.nextTrack()}
                className="p-1.5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl transition active:scale-90"
                title="المسار التالي ⏭"
              >
                <SkipForward size={16} />
              </button>
            </div>

            {/* Right Controls: Speed & Volume */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => globalAudioEngine.cycleSpeed()}
                className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-mono font-bold text-yellow-400"
                title="تغيير سرعة التشغيل"
              >
                {audioState.playbackRate}x
              </button>
              <button
                onClick={() => globalAudioEngine.toggleMute()}
                className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl"
                title={audioState.isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
              >
                {audioState.isMuted || audioState.volume === 0 ? <VolumeX size={15} className="text-rose-400" /> : <Volume2 size={15} />}
              </button>
            </div>
          </div>

          {/* 📋 Expandable Playlist Panel */}
          {isPlaylistOpen && (
            <div className="mt-3 pt-3 border-t border-white/10 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#d4af37] flex items-center gap-1.5">
                  <ListMusic size={14} />
                  <span>قائمة التشغيل ({audioState.playlist.length})</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => appendFileInputRef.current?.click()}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1 transition"
                    title="إضافة المزيد من الملفات للقائمة"
                  >
                    <Plus size={12} />
                    <span>إضافة ملفات</span>
                  </button>
                  <button
                    onClick={() => globalAudioEngine.clearPlaylist()}
                    className="px-2 py-1 hover:bg-rose-500/20 text-rose-400 rounded-lg text-[10px] transition"
                    title="مسح القائمة بالكامل"
                  >
                    مسح
                  </button>
                </div>
              </div>

              {/* Playlist items scrollable container */}
              <div className="max-h-44 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {audioState.playlist.map((track, idx) => {
                  const isCurrent = idx === audioState.currentIndex;
                  return (
                    <div
                      key={track.id}
                      onClick={() => globalAudioEngine.playTrackAtIndex(idx)}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition ${
                        isCurrent 
                          ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300' 
                          : 'bg-white/[0.03] hover:bg-white/10 text-gray-300 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        <span className="font-mono text-[10px] text-gray-400 w-4 text-center">
                          {isCurrent ? '▶' : idx + 1}
                        </span>
                        {track.isVideo ? <Video size={13} className="shrink-0 text-sky-400" /> : <Music size={13} className="shrink-0 text-yellow-400" />}
                        <span className="truncate font-medium text-[11px]" title={track.name}>
                          {track.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {track.size && (
                          <span className="text-[9px] text-gray-500 font-mono hidden sm:inline">
                            {track.size}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            globalAudioEngine.removeFromPlaylist(track.id);
                          }}
                          className="p-1 hover:bg-rose-500/30 text-gray-400 hover:text-rose-400 rounded-lg transition"
                          title="حذف من القائمة"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty State / Upload Picker */
        <div className="py-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-[#d4af37] shadow-inner">
            <Upload size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-white">اختر ملفات صوتية أو فيديو للتشغيل</h3>
            <p className="text-[11px] text-gray-400">
              يدعم كافة الصيغ (MP3, MP4, WAV, M4A, FLAC, OGG, MKV, WebM...) مع دعم قوائم التشغيل والإشعارات في الستارة.
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-2xl text-xs shadow-lg transition active:scale-95 cursor-pointer inline-flex items-center gap-2"
          >
            <FolderOpen size={16} />
            <span>📂 فتح ملفات من الجهاز / إضافة قائمة</span>
          </button>
        </div>
      )}
    </div>
  );

  return createPortal(playerContent, portalTarget);
}
