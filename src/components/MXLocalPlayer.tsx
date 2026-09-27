import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  RotateCcw, 
  RotateCw, 
  Upload, 
  Sliders, 
  Settings, 
  FolderOpen, 
  Lock, 
  Unlock, 
  Activity, 
  Repeat, 
  Clock, 
  Gauge, 
  Sparkles, 
  FileText, 
  Video, 
  Music,
  Trash2,
  Tv
} from 'lucide-react';

interface RecentFile {
  name: string;
  size: string;
  type: 'video' | 'audio';
  duration: number;
  progress: number;
  lastPlayed: number;
}

export default function MXLocalPlayer() {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [mediaType, setMediaType] = useState<'video' | 'audio' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [isLocked, setIsLocked] = useState(false);
  const [loop, setLoop] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'fit' | 'fill' | '16-9' | '4-3'>('fit');
  const [showControls, setShowControls] = useState(true);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [subtitlesFile, setSubtitlesFile] = useState<File | null>(null);
  const [subtitlesUrl, setSubtitlesUrl] = useState<string>('');
  const [equalizerPreset, setEqualizerPreset] = useState<'normal' | 'bass' | 'vocal' | 'theater'>('normal');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [resumeAction, setResumeAction] = useState<{ show: boolean; time: number; formatted: string } | null>(null);
  const [hasError, setHasError] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 5000);
  };

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load recently played files tracking
  useEffect(() => {
    const saved = localStorage.getItem('mx_recent_local_files');
    if (saved) {
      try {
        setRecentFiles(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Save recently played files
  const saveRecentFiles = (list: RecentFile[]) => {
    setRecentFiles(list);
    localStorage.setItem('mx_recent_local_files', JSON.stringify(list));
  };

  // Add current file to recent list or update it
  const updateRecentFileProgress = (time: number) => {
    if (!mediaFile) return;
    const existing = recentFiles.find(f => f.name === mediaFile.name);
    let updatedList = [...recentFiles];
    
    const fileItem: RecentFile = {
      name: mediaFile.name,
      size: (mediaFile.size / (1024 * 1024)).toFixed(1) + ' MB',
      type: mediaFile.type.startsWith('audio/') ? 'audio' : 'video',
      duration: duration || 0,
      progress: time,
      lastPlayed: Date.now()
    };

    if (existing) {
      updatedList = updatedList.map(f => f.name === mediaFile.name ? { ...f, progress: time, lastPlayed: Date.now(), duration: duration || f.duration } : f);
    } else {
      updatedList = [fileItem, ...updatedList].slice(0, 8); // keep last 8 files
    }
    saveRecentFiles(updatedList);
  };

  // Handle files selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadMediaFile(file);
    }
  };

  const loadMediaFile = (file: File) => {
    if (mediaUrl) {
      URL.revokeObjectURL(mediaUrl);
    }
    const url = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaUrl(url);
    setHasError(false);
    
    // Check extension fallback if type is empty or generic
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isAudioExt = ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'flac', 'wma', 'opus', 'amr'].includes(ext);
    const type = (file.type.startsWith('audio/') || isAudioExt) ? 'audio' : 'video';
    
    setMediaType(type);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLocked(false);
    setResumeAction(null);

    // Check if we have recent progress to resume
    const recent = recentFiles.find(f => f.name === file.name);
    
    setTimeout(() => {
      if (mediaRef.current) {
        try {
          mediaRef.current.load(); // Force browser reload of local ObjectURL src
        } catch (e) {
          console.warn("Failed to load source:", e);
        }

        if (recent && recent.progress > 0 && recent.progress < (recent.duration - 5)) {
          // Auto-resume for seamless user experience in iframe
          mediaRef.current.currentTime = recent.progress;
          setCurrentTime(recent.progress);
          setResumeAction({
            show: true,
            time: recent.progress,
            formatted: formatTime(recent.progress)
          });
        } else {
          showToast(`تم فتح الملف بنجاح: ${file.name}`);
        }

        mediaRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.warn("Autoplay/play call was prevented or failed:", err);
          // Try to play on next user tap, ensure state is clean
        });
      }
    }, 300);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('video/') || file.type.startsWith('audio/'))) {
      loadMediaFile(file);
    }
  };

  // Subtitle loader
  const handleSubtitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (subtitlesUrl) {
        URL.revokeObjectURL(subtitlesUrl);
      }
      setSubtitlesFile(file);
      setSubtitlesUrl(URL.createObjectURL(file));
    }
  };

  // Playback control functions
  const togglePlay = () => {
    if (isLocked) return;
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.pause();
      setIsPlaying(false);
    } else {
      mediaRef.current.play().then(() => {
        setIsPlaying(true);
      });
    }
  };

  const skipForward = () => {
    if (isLocked || !mediaRef.current) return;
    mediaRef.current.currentTime = Math.min(mediaRef.current.currentTime + 10, duration);
  };

  const skipBackward = () => {
    if (isLocked || !mediaRef.current) return;
    mediaRef.current.currentTime = Math.max(mediaRef.current.currentTime - 10, 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked || !mediaRef.current) return;
    const time = parseFloat(e.target.value);
    mediaRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);
    if (mediaRef.current) {
      mediaRef.current.volume = vol;
    }
  };

  const toggleMute = () => {
    if (isLocked || !mediaRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    mediaRef.current.volume = nextMute ? 0 : volume;
  };

  const changeSpeed = (speed: number) => {
    if (isLocked || !mediaRef.current) return;
    setPlaybackSpeed(speed);
    mediaRef.current.playbackRate = speed;
  };

  const toggleFullscreen = () => {
    if (isLocked) return;
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Keyboard shortcut handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!mediaRef.current || isLocked) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        skipForward();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        skipBackward();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isLocked, duration]);

  // Handle auto-hiding controls
  const handleMouseMove = () => {
    if (isLocked) return;
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Update time tracker & save progress on unmount/play
  useEffect(() => {
    const timer = setInterval(() => {
      if (mediaRef.current && isPlaying) {
        const time = mediaRef.current.currentTime;
        setCurrentTime(time);
        updateRecentFileProgress(time);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlaying, mediaFile, duration]);

  const handleMediaLoaded = () => {
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const hrs = Math.floor(time / 3600);
    const mins = Math.floor((time % 3600) / 60);
    const secs = Math.floor(time % 60);
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const clearRecentList = () => {
    saveRecentFiles([]);
  };

  const handleRemoveRecentFile = (e: React.MouseEvent, fileName: string) => {
    e.stopPropagation();
    const filtered = recentFiles.filter(f => f.name !== fileName);
    saveRecentFiles(filtered);
  };

  // CSS class helper for aspect ratio
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'fill': return 'w-full h-full object-fill';
      case '16-9': return 'aspect-video w-full object-cover';
      case '4-3': return 'aspect-[4/3] max-w-full object-cover mx-auto';
      case 'fit':
      default: return 'max-h-full max-w-full object-contain mx-auto';
    }
  };

  return (
    <div className="space-y-6 relative" dir="rtl">
      {/* Toast Overlay */}
      {toastMessage && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white border border-indigo-500/40 px-6 py-4 rounded-3xl text-xs font-black shadow-2xl z-[999] flex items-center gap-2.5 max-w-md text-center">
          <Sparkles size={16} className="text-yellow-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-6 rounded-3xl border border-white/5">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2.5">
            <span className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl text-white shadow-lg">
              <Tv size={20} />
            </span>
            مشغل MX البطل للملفات المحلية
          </h2>
          <p className="text-xs text-gray-400 font-bold mt-1">
            شغّل فيديوهاتك وملفاتك الصوتية المحلية مع تحكم متقدم في السرعة والترجمة والإضاءة والارتفاع.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 font-black px-2.5 py-1 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              يعمل بالكامل بدون اتصال بالإنترنت (Offline 100%)
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-400 font-black px-2.5 py-1 rounded-full border border-blue-500/20">
              تشغيل آمن ومحلي لجميع الصيغ والأحجام ⚡
            </span>
          </div>
        </div>

        {/* Input Trigger Button */}
        <label className="flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 active:scale-95 transition-all text-white text-xs font-black rounded-2xl cursor-pointer shadow-lg shadow-indigo-500/10">
          <FolderOpen size={16} />
          <span>اختر ملف ميديا محلي 📁</span>
          <input 
            type="file" 
            accept="video/*,audio/*,.mp4,.mkv,.avi,.3gp,.mov,.webm,.flv,.mp3,.wav,.ogg,.m4a,.flac,.wma" 
            onChange={handleFileChange} 
            className="hidden" 
          />
        </label>
      </div>

      {/* Main Player Display Area */}
      {mediaUrl ? (
        <div 
          ref={containerRef}
          onMouseMove={handleMouseMove}
          className="relative bg-black rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl flex items-center justify-center select-none"
          style={{ height: '560px' }}
        >
          {/* Custom Brightness Overlay Layer */}
          <div 
            className="absolute inset-0 bg-black pointer-events-none z-[1]" 
            style={{ opacity: Math.max(0, 1 - brightness / 100) }}
          />

          {/* Auto Resume Floating Notification Banner */}
          {resumeAction && resumeAction.show && (
            <div className="absolute top-20 right-5 left-5 bg-slate-950/95 border border-indigo-500/40 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-2xl z-[50] animate-bounce text-right">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-indigo-400 shrink-0" />
                <div>
                  <h5 className="text-[11px] font-black text-white">تم استئناف المقطع من حيث توقفت تلقائياً</h5>
                  <p className="text-[9px] text-gray-400 font-bold mt-0.5">توقف تشغيل هذا الملف سابقاً عند الدقيقة {resumeAction.formatted}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (mediaRef.current) {
                    mediaRef.current.currentTime = 0;
                    setCurrentTime(0);
                  }
                  setResumeAction(null);
                  showToast("تمت إعادة التشغيل من البداية ⏪");
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[9px] font-black rounded-xl transition cursor-pointer"
              >
                ⏪ البدء من البداية
              </button>
            </div>
          )}

          {/* Render Audio-Only Visualizer */}
          {mediaType === 'audio' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#091124] to-[#030712] z-0 p-8">
              <div className="w-24 h-24 bg-indigo-500/10 border border-indigo-500/20 rounded-[2rem] flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-500/5">
                <Music size={44} className={isPlaying ? 'animate-bounce' : ''} />
              </div>
              <div className="text-center max-w-md">
                <h3 className="text-base font-black text-white truncate">{mediaFile?.name}</h3>
                <p className="text-xs text-indigo-400 font-bold mt-1">تنسيق صوتي محلي</p>
              </div>

              {/* Dynamic beat visualizer waves */}
              <div className="flex items-end justify-center gap-1 h-14 mt-4 px-8">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="w-1.5 bg-gradient-to-t from-blue-500 to-indigo-400 rounded-full transition-all duration-300"
                    style={{ 
                      height: isPlaying ? `${Math.floor(Math.random() * 85) + 15}%` : '8%',
                      animation: isPlaying ? `pulse 1.2s ease-in-out infinite alternate` : 'none',
                      animationDelay: `${i * 0.05}s`
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* HTML5 Video or Audio Element */}
          {mediaType === 'video' ? (
            <video
              ref={el => { mediaRef.current = el; }}
              src={mediaUrl}
              className={`w-full h-full z-0 pointer-events-auto ${getAspectRatioClass()}`}
              onLoadedMetadata={handleMediaLoaded}
              onClick={togglePlay}
              loop={loop}
              onEnded={() => setIsPlaying(false)}
              onError={() => setHasError(true)}
              crossOrigin="anonymous"
            >
              {subtitlesUrl && (
                <track 
                  src={subtitlesUrl} 
                  kind="subtitles" 
                  srcLang="ar" 
                  label="ترجمة عربية" 
                  default 
                />
              )}
            </video>
          ) : (
            <audio
              ref={el => { mediaRef.current = el; }}
              src={mediaUrl}
              onLoadedMetadata={handleMediaLoaded}
              loop={loop}
              onEnded={() => setIsPlaying(false)}
              onError={() => setHasError(true)}
            />
          )}

          {/* Playback Error Helper Overlay */}
          {hasError && (
            <div className="absolute inset-0 bg-[#060a13]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-[12] space-y-4">
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-400">
                <AlertTriangle size={32} />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="text-sm font-black text-white">تنسيق ميديا غير مدعوم مباشرة بالمتصفح</h4>
                <p className="text-[11px] text-gray-400 font-bold leading-relaxed">
                  قد لا يدعم محرك الويب الحالي ترميز هذا الملف (مثل بعض مقاطع MKV/AVI ذات الصوت AC3). يمكنك تبديل نمط التشغيل إلى صوت فقط أو تجربة متصفح آخر.
                </p>
              </div>
              <div className="flex gap-2.5">
                <button 
                  onClick={() => {
                    setMediaType('audio');
                    setHasError(false);
                    showToast("تم التحويل لتشغيل الصوت فقط 🎧");
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer"
                >
                  🎧 تشغيل كصوت فقط
                </button>
                <button 
                  onClick={() => {
                    setHasError(false);
                    showToast("تمت إعادة المحاولة 🔄");
                  }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-black rounded-xl border border-white/10 transition-all cursor-pointer"
                >
                  🔄 إعادة المحاولة
                </button>
              </div>
            </div>
          )}

          {/* Smart Screen-Lock Overlay Screen */}
          {isLocked && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[15]">
              <button 
                onClick={() => setIsLocked(false)}
                className="p-5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:scale-110 active:scale-95 text-slate-950 font-black rounded-full shadow-2xl transition-all cursor-pointer flex flex-col items-center gap-2 border border-yellow-400/30"
              >
                <Unlock size={24} />
                <span className="text-[10px]">اضغط لإلغاء القفل 🔓</span>
              </button>
            </div>
          )}

          {/* MX Advanced Overlay Custom Controls */}
          {showControls && !isLocked && (
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 flex flex-col justify-between p-5 z-10">
              
              {/* Header Info */}
              <div className="flex justify-between items-center bg-black/40 backdrop-blur-md p-3 px-5 rounded-2xl border border-white/5">
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-extrabold px-2 py-0.5 rounded-full border border-indigo-500/30 shrink-0">
                    {mediaType === 'video' ? 'فيديو' : 'صوت'}
                  </span>
                  <button 
                    onClick={() => {
                      const nextType = mediaType === 'video' ? 'audio' : 'video';
                      setMediaType(nextType);
                      showToast(`تم تحويل نمط التشغيل يدوياً إلى: ${nextType === 'video' ? 'فيديو' : 'صوت'} 🔄`);
                    }}
                    className="text-[9px] bg-white/10 hover:bg-white/20 active:scale-95 text-white font-black px-2 py-0.5 rounded-full border border-white/10 transition"
                    title="تحويل نمط التشغيل يدوياً"
                  >
                    تشغيل كـ {mediaType === 'video' ? 'صوت' : 'فيديو'} 🔄
                  </button>
                  <h4 className="text-xs font-bold text-white truncate max-w-[120px] sm:max-w-xs">{mediaFile?.name}</h4>
                </div>
                
                {/* Advanced Settings Row */}
                <div className="flex items-center gap-2.5">
                  {/* Aspect Ratio Switcher */}
                  {mediaType === 'video' && (
                    <select 
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value as any)}
                      className="bg-white/5 border border-white/10 rounded-lg text-white text-[10px] py-1 px-2 font-black cursor-pointer hover:bg-white/10"
                    >
                      <option value="fit" className="bg-slate-950">ملاءمة (Fit)</option>
                      <option value="fill" className="bg-slate-950">تعبئة (Fill)</option>
                      <option value="16-9" className="bg-slate-950">16:9 widescreen</option>
                      <option value="4-3" className="bg-slate-950">4:3 classic</option>
                    </select>
                  )}

                  {/* Lock Controller Button */}
                  <button 
                    onClick={() => { setIsLocked(true); setShowControls(false); }}
                    className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-amber-400 transition cursor-pointer"
                    title="قفل الشاشة للتأمين"
                  >
                    <Lock size={14} />
                  </button>
                </div>
              </div>

              {/* Center Quick Gesture Control Toggles */}
              <div className="flex justify-between items-center px-10 self-center w-full max-w-2xl">
                {/* Left Side: Brightness Quick Adjust Slider */}
                <div className="flex flex-col items-center gap-2 bg-black/60 backdrop-blur-md p-3 py-4 rounded-2xl border border-white/5 w-14">
                  <span className="text-[9px] text-gray-400 font-black">إضاءة</span>
                  <input 
                    type="range"
                    min="10"
                    max="100"
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                    className="h-20 accent-amber-400"
                    style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
                  />
                  <span className="text-[9px] font-bold text-amber-400">{brightness}%</span>
                </div>

                {/* Big play center trigger */}
                <button 
                  onClick={togglePlay}
                  className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white rounded-full flex items-center justify-center shadow-2xl transition active:scale-90 cursor-pointer border border-white/10"
                >
                  {isPlaying ? <Pause size={28} className="mr-0.5" /> : <Play size={28} className="ml-1" />}
                </button>

                {/* Right Side: Volume Boost Slider */}
                <div className="flex flex-col items-center gap-2 bg-black/60 backdrop-blur-md p-3 py-4 rounded-2xl border border-white/5 w-14">
                  <span className="text-[9px] text-gray-400 font-black">صوت</span>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="h-20 accent-blue-500"
                    style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
                  />
                  <span className="text-[9px] font-bold text-blue-400">{isMuted ? 0 : Math.round(volume * 100)}%</span>
                </div>
              </div>

              {/* Bottom Multi-functional Controls Panel */}
              <div className="space-y-3 bg-black/70 backdrop-blur-md p-4 rounded-2xl border border-white/5">
                {/* Seekbar and Timing info */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-300 font-mono font-bold shrink-0">{formatTime(currentTime)}</span>
                  <input 
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 accent-indigo-500 bg-white/20 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-[10px] text-indigo-400 font-mono font-bold shrink-0">{formatTime(duration)}</span>
                </div>

                {/* Controls Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  
                  {/* Left segment: Skip, loop and mute */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={skipBackward}
                      className="p-2 hover:bg-white/10 rounded-xl text-white transition-all cursor-pointer"
                      title="تراجع 10 ثوانٍ"
                    >
                      <RotateCcw size={15} />
                    </button>
                    <button 
                      onClick={skipForward}
                      className="p-2 hover:bg-white/10 rounded-xl text-white transition-all cursor-pointer"
                      title="تقديم 10 ثوانٍ"
                    >
                      <RotateCw size={15} />
                    </button>
                    <button 
                      onClick={() => setLoop(!loop)}
                      className={`p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[9px] font-black ${loop ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-400 hover:text-white'}`}
                      title="تكرار العرض تلقائياً"
                    >
                      <Repeat size={14} />
                      <span>{loop ? 'مفعّل' : 'تكرار'}</span>
                    </button>
                  </div>

                  {/* Middle segment: Playback Speed */}
                  <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/5 gap-1.5">
                    <span className="text-[8px] text-gray-400 font-black px-1.5 flex items-center gap-1"><Gauge size={10} /> سرعة:</span>
                    {[0.5, 1.0, 1.5, 2.0].map(speed => (
                      <button
                        key={speed}
                        onClick={() => changeSpeed(speed)}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-black transition-all cursor-pointer ${playbackSpeed === speed ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  {/* Right segment: External Subtitles & Fullscreen */}
                  <div className="flex items-center gap-2">
                    {mediaType === 'video' && (
                      <label className="flex items-center gap-1 px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-[9px] font-black text-amber-400 cursor-pointer">
                        <FileText size={12} />
                        <span>{subtitlesFile ? 'تغيير الترجمة 📜' : 'أضف ملف ترجمة SRT 📜'}</span>
                        <input 
                          type="file" 
                          accept=".srt,.vtt" 
                          onChange={handleSubtitleChange} 
                          className="hidden" 
                        />
                      </label>
                    )}

                    <button 
                      onClick={toggleFullscreen}
                      className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/20 cursor-pointer"
                      title="شاشة كاملة"
                    >
                      <Maximize size={15} />
                    </button>
                  </div>

                </div>
              </div>

            </div>
          )}
        </div>
      ) : (
        /* Dynamic Drop Zone when No Media Loaded */
        <div 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="h-80 border-2 border-dashed border-white/10 hover:border-indigo-500/30 rounded-[2.5rem] bg-gradient-to-b from-slate-900/10 via-slate-900/30 to-slate-900/60 flex flex-col items-center justify-center p-8 text-center transition-all group"
        >
          <div className="w-20 h-20 bg-indigo-500/5 border border-indigo-500/10 rounded-[2rem] flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500/10 transition-all duration-300 shadow-xl shadow-indigo-500/5">
            <Upload size={32} className="animate-pulse" />
          </div>
          <h3 className="text-base font-black text-white mt-5">اسحب وأفلت أي ملف فيديو أو صوت هنا 📁</h3>
          <p className="text-xs text-gray-500 font-bold max-w-sm mt-2 leading-relaxed">
            يدعم مشغل MX جميع صيغ الميديا المحلية الشهيرة (MP4, MKV, MP3, WAV). كل بياناتك تظل محلية وآمنة 100% داخل جهازك.
          </p>

          <label className="mt-5 flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-[#d4af37]/30 rounded-2xl text-xs font-black text-white transition-all cursor-pointer">
            <FolderOpen size={14} />
            <span>تصفّح ملفاتك المحلية</span>
            <input 
              type="file" 
              accept="video/*,audio/*,.mp4,.mkv,.avi,.3gp,.mov,.webm,.flv,.mp3,.wav,.ogg,.m4a,.flac,.wma" 
              onChange={handleFileChange} 
              className="hidden" 
            />
          </label>
        </div>
      )}

      {/* Playback History Tracker */}
      <div className="bg-[#0b1222] border border-white/5 rounded-[2rem] p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Clock size={16} className="text-indigo-400" />
            تاريخ المشاهدة والملفات المحلية الأخيرة ({recentFiles.length})
          </h3>
          {recentFiles.length > 0 && (
            <button 
              onClick={clearRecentList}
              className="flex items-center gap-1 text-[10px] text-rose-500 hover:text-rose-400 font-black cursor-pointer bg-rose-500/10 px-2.5 py-1 rounded-xl transition"
            >
              <Trash2 size={12} />
              <span>حذف السجل</span>
            </button>
          )}
        </div>

        {recentFiles.length === 0 ? (
          <div className="text-center p-8 bg-white/5 border border-dashed border-white/10 rounded-2xl text-gray-400 text-xs font-bold">
            سجل التشغيل فارغ حالياً. بمجرد اختيار ملف وبدء تشغيله، سيتم حفظه هنا لاستئنافه لاحقاً في أي وقت.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {recentFiles.map((file, idx) => (
              <div 
                key={idx}
                onClick={() => {
                  showToast(`لتشغيل "${file.name}" مجدداً، اضغط على تصفح واختر الملف نفسه. سنتذكر ونستأنف التشغيل تلقائياً من ${formatTime(file.progress)}!`);
                }}
                className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 hover:border-white/10 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 bg-indigo-500/5 rounded-xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/10 shrink-0">
                    {file.type === 'video' ? <Video size={18} /> : <Music size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-black text-white truncate">{file.name}</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-bold">
                      تم التوقف عند: <span className="text-indigo-400 font-mono">{formatTime(file.progress)}</span> / {formatTime(file.duration)} ({file.size})
                    </p>
                  </div>
                </div>
                <button 
                  onClick={(e) => handleRemoveRecentFile(e, file.name)}
                  className="p-1 text-gray-500 hover:text-rose-400 transition cursor-pointer"
                  title="إزالة من السجل"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
