import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { DevicePermissionsService } from '../services/DevicePermissionsService';
import { backgroundMediaService } from '../services/BackgroundMediaService';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Music, 
  Video, 
  Trash2, 
  Upload, 
  Volume2, 
  VolumeX,
  Tv, 
  Maximize, 
  FolderOpen, 
  Minus,
  Maximize2,
  CheckSquare,
  Square,
  ListChecks,
  PlayCircle
} from 'lucide-react';

interface LocalTrack {
  id: string;
  name: string;
  type: string; // 'audio/' or 'video/'
  url: string;
  size: string;
}

export const LocalMediaPlayer: React.FC = () => {
  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(() => {
    const cached = localStorage.getItem('jam_media_volume');
    return cached ? parseFloat(cached) : 0.8;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [preMuteVolume, setPreMuteVolume] = useState<number>(0.8);
  const [isVideoMode, setIsVideoMode] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isBackgroundPlayEnabled, setIsBackgroundPlayEnabled] = useState<boolean>(true);
  
  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);

  // References
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);

  const activeTrack = currentTrackIndex >= 0 ? tracks[currentTrackIndex] : null;

  const isNative = Capacitor.isNativePlatform();

  // Synchronize with background service & notification bar mediaSession
  useEffect(() => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      if (activeTrack) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: activeTrack.name,
          artist: 'JAM System Pro - مشغل الميديا',
          album: activeTrack.type.startsWith('video/') ? 'فيديو' : 'صوتيات',
          artwork: [
            {
              src: '/app_icon_master_source/jam_app_icon_512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        });
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

        try {
          navigator.mediaSession.setActionHandler('play', () => {
            setIsPlaying(true);
          });
          navigator.mediaSession.setActionHandler('pause', () => {
            setIsPlaying(false);
          });
          navigator.mediaSession.setActionHandler('previoustrack', () => {
            handleSkip('backward');
          });
          navigator.mediaSession.setActionHandler('nexttrack', () => {
            handleSkip('forward');
          });
        } catch (e) {
          console.warn('MediaSession handler error:', e);
        }
      } else {
        navigator.mediaSession.playbackState = 'none';
      }
    }
  }, [activeTrack, isPlaying]);

  // Request native storage permission safely prior to querying MediaStore or Directories
  const requestNativePermissions = async (): Promise<boolean> => {
    if (!isNative) return false;
    try {
      const status = await Filesystem.checkForPermissions();
      if (status.publicStorage === 'granted') {
        return true;
      }
      const reqStatus = await Filesystem.requestPermissions();
      return reqStatus.publicStorage === 'granted';
    } catch (e) {
      console.error('Failed to resolve / request public storage permission:', e);
      return false;
    }
  };

  // Perform performance-optimized native recursive scan of documents and files
  const scanMediaDirectory = async (directory: Directory, path: string = ''): Promise<LocalTrack[]> => {
    try {
      const result = await Filesystem.readdir({
        directory,
        path
      });
      
      let localTracks: LocalTrack[] = [];
      const validExtensions = ['.mp3', '.mp4', '.wav', '.ogg', '.m4a', '.webm', '.mov', '.avi', '.mkv', '.flac'];

      for (const file of result.files) {
        if (file.type === 'directory') {
          // Asynchronous recursive traverse
          const subTracks = await scanMediaDirectory(directory, path ? `${path}/${file.name}` : file.name);
          localTracks = [...localTracks, ...subTracks];
        } else {
          const name = file.name.toLowerCase();
          const pathSuffix = path ? `${path}/${file.name}` : file.name;
          if (validExtensions.some(ext => name.endsWith(ext))) {
            let srcUrl = '';
            try {
              const uriResult = await Filesystem.getUri({
                directory,
                path: pathSuffix
              });
              srcUrl = Capacitor.convertFileSrc(uriResult.uri);
            } catch (err) {
              console.warn('Error fetching URI for track:', pathSuffix, err);
            }

            if (srcUrl) {
              localTracks.push({
                id: Math.random().toString(36).substring(7),
                name: file.name,
                type: file.name.toLowerCase().endsWith('.mp4') || file.name.toLowerCase().endsWith('.mkv') ? 'video/mp4' : 'audio/mp3',
                url: srcUrl,
                size: 'محلي'
              });
            }
          }
        }
      }
      return localTracks;
    } catch (e) {
      console.warn(`Local directory auto-scan bypassed for path ${path}:`, e);
      return [];
    }
  };

  // Auto-scan on mount when permission status is positive on mobile
  useEffect(() => {
    let active = true;
    if (isNative) {
      const runMediaScan = async () => {
        const granted = await requestNativePermissions();
        if (granted && active) {
          console.log('📡 JAM PRO: Commencing native media scan...');
          const fetchedTracks = await scanMediaDirectory(Directory.Documents);
          if (fetchedTracks.length > 0 && active) {
            setTracks(prev => {
              const merged = [...prev];
              fetchedTracks.forEach(newTrack => {
                if (!merged.some(t => t.name === newTrack.name)) {
                  merged.push(newTrack);
                }
              });
              if (prev.length === 0 && merged.length > 0) {
                setCurrentTrackIndex(0);
                setIsPlaying(true);
              }
              return merged;
            });
          }
        }
      };
      runMediaScan();
    }
    return () => {
      active = false;
    };
  }, []);

  // Cleanup ObjectURLs on unmount
  useEffect(() => {
    return () => {
      tracks.forEach(track => {
        try {
          URL.revokeObjectURL(track.url);
        } catch (e) {
          console.warn('Cleanup ObjectURL warning:', e);
        }
      });
    };
  }, [tracks]);

  // Handle single/multiple file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    
    const newTracks: LocalTrack[] = filesArray.map(file => {
      const url = URL.createObjectURL(file);
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
      return {
        id: Math.random().toString(36).substring(7),
        name: file.name,
        type: file.type || (file.name.toLowerCase().endsWith('.mp4') || file.name.toLowerCase().endsWith('.mkv') ? 'video/mp4' : 'audio/mp3'),
        url,
        size: sizeMB
      };
    });

    setTracks(prev => {
      const updated = [...prev, ...newTracks];
      if (prev.length === 0 && updated.length > 0) {
        setCurrentTrackIndex(0);
        setIsPlaying(true);
      }
      return updated;
    });

    e.target.value = '';
  };

  // Handle directory/folder selection (Recursively searches files in folder)
  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    
    const validExtensions = ['.mp3', '.mp4', '.wav', '.ogg', '.m4a', '.webm', '.mov', '.avi', '.mkv', '.flac'];
    const filteredFiles = filesArray.filter(file => {
      const type = file.type;
      if (type.startsWith('audio/') || type.startsWith('video/')) return true;
      const name = file.name.toLowerCase();
      return validExtensions.some(ext => name.endsWith(ext));
    });

    if (filteredFiles.length === 0) {
      console.warn("No compatible audio/video files found in directory.");
      return;
    }

    const newTracks: LocalTrack[] = filteredFiles.map(file => {
      const url = URL.createObjectURL(file);
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
      return {
        id: Math.random().toString(36).substring(7),
        name: file.name,
        type: file.type || (file.name.toLowerCase().endsWith('.mp4') || file.name.toLowerCase().endsWith('.mkv') ? 'video/mp4' : 'audio/mp3'),
        url,
        size: sizeMB
      };
    });

    setTracks(prev => {
      const updated = [...prev, ...newTracks];
      if (prev.length === 0 && updated.length > 0) {
        setCurrentTrackIndex(0);
        setIsPlaying(true);
      }
      return updated;
    });

    e.target.value = '';
  };

  // Multi-selection management helpers
  const toggleSelectTrack = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === tracks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tracks.map(t => t.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const remaining = tracks.filter(t => !selectedIds.has(t.id));
    tracks.forEach(t => {
      if (selectedIds.has(t.id)) {
        try { URL.revokeObjectURL(t.url); } catch (e) {}
      }
    });
    setTracks(remaining);
    setSelectedIds(new Set());
    if (remaining.length === 0) {
      setCurrentTrackIndex(-1);
      setIsPlaying(false);
    } else {
      setCurrentTrackIndex(0);
    }
  };

  const handlePlaySelectedQueue = () => {
    if (selectedIds.size === 0) return;
    const firstSelectedIdx = tracks.findIndex(t => selectedIds.has(t.id));
    if (firstSelectedIdx !== -1) {
      setCurrentTrackIndex(firstSelectedIdx);
      setIsPlaying(true);
    }
  };

  // Toggle play / pause
  const togglePlay = () => {
    if (!activeTrack) return;
    setIsPlaying(prev => !prev);
  };

  // Skip tracks forward or backward
  const handleSkip = (direction: 'forward' | 'backward') => {
    if (tracks.length === 0) return;
    
    // If selective queue is active
    if (selectedIds.size > 0) {
      const selectedIndices = tracks
        .map((t, idx) => (selectedIds.has(t.id) ? idx : -1))
        .filter(idx => idx !== -1);
      
      const currentPos = selectedIndices.indexOf(currentTrackIndex);
      if (direction === 'forward') {
        const nextPos = (currentPos + 1) % selectedIndices.length;
        setCurrentTrackIndex(selectedIndices[nextPos]);
      } else {
        const prevPos = (currentPos - 1 + selectedIndices.length) % selectedIndices.length;
        setCurrentTrackIndex(selectedIndices[prevPos]);
      }
      setIsPlaying(true);
      return;
    }

    let nextIndex = currentTrackIndex;
    if (direction === 'forward') {
      nextIndex = (currentTrackIndex + 1) % tracks.length;
    } else {
      nextIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    }
    setCurrentTrackIndex(nextIndex);
    setIsPlaying(true);
  };

  // Delete single track safely
  const handleDeleteTrack = (id: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      URL.revokeObjectURL(tracks[index].url);
    } catch (err) {}

    setTracks(prev => {
      const filtered = prev.filter(t => t.id !== id);
      if (filtered.length === 0) {
        setCurrentTrackIndex(-1);
        setIsPlaying(false);
      } else if (index === currentTrackIndex) {
        setCurrentTrackIndex(0);
        setIsPlaying(isPlaying);
      } else if (index < currentTrackIndex) {
        setCurrentTrackIndex(currentTrackIndex - 1);
      }
      return filtered;
    });

    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // HTML5 Fullscreen API
  const toggleFullscreen = () => {
    const el = isVideoMode ? videoRef.current : playerContainerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request rejected or not supported in frame:', err);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Keyboard binding listener hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement).tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') {
        return;
      }

      const activeMedia = isVideoMode ? videoRef.current : audioRef.current;
      if (!activeMedia) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (activeMedia.paused) {
          activeMedia.play().then(() => setIsPlaying(true)).catch(() => {});
        } else {
          activeMedia.pause();
          setIsPlaying(false);
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        activeMedia.currentTime = Math.min(activeMedia.currentTime + 10, activeMedia.duration || 0);
        setCurrentTime(activeMedia.currentTime);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        activeMedia.currentTime = Math.max(activeMedia.currentTime - 10, 0);
        setCurrentTime(activeMedia.currentTime);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVideoMode]);

  // Audio Playback & element controllers
  useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;

    if (!activeTrack) {
      if (audio) audio.pause();
      if (video) video.pause();
      return;
    }

    const isVideo = activeTrack.type.startsWith('video/');
    setIsVideoMode(isVideo);

    const activeVolume = isMuted ? 0 : volume;

    if (isVideo) {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
      if (video) {
        if (video.src !== activeTrack.url) {
          video.src = activeTrack.url;
          video.load();
        }
        if (isPlaying) {
          video.play().catch(() => setIsPlaying(false));
        } else {
          video.pause();
        }
        video.volume = activeVolume;
      }
    } else {
      if (video) {
        video.pause();
        video.src = '';
      }
      if (audio) {
        if (audio.src !== activeTrack.url) {
          audio.src = activeTrack.url;
          audio.load();
        }
        if (isPlaying) {
          audio.play().catch(() => setIsPlaying(false));
          setupVisualizer();
        } else {
          audio.pause();
        }
        audio.volume = activeVolume;
      }
    }
  }, [currentTrackIndex, isPlaying, activeTrack]);

  // Sync volume state across audio and video elements
  useEffect(() => {
    const activeVolume = isMuted ? 0 : volume;
    if (audioRef.current) audioRef.current.volume = activeVolume;
    if (videoRef.current) videoRef.current.volume = activeVolume;
    localStorage.setItem('jam_media_volume', volume.toString());
  }, [volume, isMuted]);

  // Element event callbacks
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement | HTMLVideoElement>) => {
    setCurrentTime(e.currentTarget.currentTime);
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement | HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration || 0);
  };

  const handleMediaEnded = () => {
    if (tracks.length > 1) {
      handleSkip('forward');
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  // Live scrubbing bar
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (isVideoMode) {
      if (videoRef.current) videoRef.current.currentTime = val;
    } else {
      if (audioRef.current) audioRef.current.currentTime = val;
    }
  };

  // Toggle Mute / Unmute state
  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(preMuteVolume);
    } else {
      setPreMuteVolume(volume);
      setIsMuted(true);
    }
  };

  // Web Audio Context visualizer
  const setupVisualizer = () => {
    if (!audioRef.current || isVideoMode) return;
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        
        const ctx = new AudioCtx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        
        audioContextRef.current = ctx;
        analyserRef.current = analyser;
      }

      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      drawVisualizer();
    } catch (e) {
      console.warn('Web Audio node already established or unsupported:', e);
    }
  };

  const drawVisualizer = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser || isVideoMode) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const length = analyser.frequencyBinCount;
    const array = new Uint8Array(length);

    const draw = () => {
      if (!isPlaying || isVideoMode) return;
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(array);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = (canvas.width / length) * 1.5;
      let x = 0;

      for (let i = 0; i < length; i++) {
        const height = array[i] / 2.5;
        ctx.fillStyle = `rgba(212, 175, 55, ${height / 100 + 0.15})`;
        ctx.fillRect(x, canvas.height - height, width - 1, height);
        x += width;
      }
    };
    draw();
  };

  useEffect(() => {
    if (isPlaying && !isVideoMode) {
      drawVisualizer();
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, isVideoMode]);

  const formatSecs = (val: number) => {
    if (isNaN(val)) return '00:00';
    const mins = Math.floor(val / 60);
    const secs = Math.floor(val % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div id="jam_integrated_media_module" ref={playerContainerRef} className="relative z-[99999] overflow-visible">
      {/* Hidden Native Audio Element */}
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleMediaEnded}
        preload="auto"
      />

      <AnimatePresence mode="wait">
        {isMinimized ? (
          /* MINIMIZED AUDIO PILOT COLLAPSIBLE MODE */
          <motion.div
            id="media_player_minimized_pill"
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            className="fixed bottom-24 left-6 z-[99999] bg-[#001122]/95 backdrop-blur-3xl border-2 border-royal-gold/40 px-4 py-2.5 rounded-full flex items-center gap-3 shadow-[0_15px_40px_rgba(0,0,0,0.6)] text-right"
            dir="rtl"
          >
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                id="minimized_play"
                onClick={togglePlay}
                disabled={!activeTrack}
                className="w-8 h-8 rounded-full bg-royal-gold text-deep-navy flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all text-sm font-bold disabled:opacity-40"
              >
                {isPlaying ? <Pause size={12} /> : <Play size={12} className="translate-x-[-0.5px]" />}
              </button>
              <button
                onClick={() => handleSkip('forward')}
                disabled={tracks.length < 2}
                className="w-7 h-7 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center cursor-pointer hover:bg-white/10 disabled:opacity-40"
              >
                <SkipForward size={10} />
              </button>
            </div>

            <div className="max-w-[120px] overflow-hidden truncate">
              <p className="text-[10px] font-black text-white truncate leading-tight">
                {activeTrack ? activeTrack.name : 'لا يوجد ملف'}
              </p>
              <span className="text-[8px] text-royal-gold font-bold">
                {activeTrack ? formatSecs(currentTime) : 'مشغل الوسائط ميني'}
              </span>
            </div>

            <button
              id="minimized_restore"
              onClick={() => setIsMinimized(false)}
              className="w-7 h-7 rounded-full bg-royal-gold/10 hover:bg-royal-gold/25 border border-royal-gold/30 text-royal-gold flex items-center justify-center cursor-pointer transition-all ml-1"
              title="تكبير مشغل الوسائط"
            >
              <Maximize2 size={10} />
            </button>
          </motion.div>
        ) : (
          /* MASTER FULL MEDIA SUITE CONTROLLER */
          <motion.div
            id="media_player_premium_deck"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="bg-[#001122]/95 border-2 border-royal-gold/20 rounded-[2.5rem] p-6 text-right space-y-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-visible"
            dir="rtl"
          >
            {/* Header section with toggle and action triggers */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 overflow-visible">
              <div className="flex items-center gap-3">
                <div className="bg-royal-gold/10 p-2.5 rounded-xl text-royal-gold shrink-0">
                  <Tv size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">مشغل الوسائط الرقمي المطور (Media Player)</h3>
                  <p className="text-[10px] text-gray-400 font-bold">دعم التحديد المتعدد والتشغيل بالخلفية وإشعارات النظام 🔔</p>
                </div>
              </div>

              {/* Action Buttons Hub */}
              <div className="flex items-center gap-1.5 shrink-0 overflow-visible relative z-[999999]">
                {/* Background Play Toggle */}
                <button
                  type="button"
                  onClick={async () => {
                    const nextState = !isBackgroundPlayEnabled;
                    if (nextState) {
                      const granted = await DevicePermissionsService.requestOnDemand('background_play');
                      if (granted) {
                        setIsBackgroundPlayEnabled(true);
                      } else {
                        alert('⚠️ يرجى منح إذن التشغيل في الخلفية لتشغيل الصوت عند إغلاق الشاشة.');
                      }
                    } else {
                      setIsBackgroundPlayEnabled(false);
                    }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-black border transition-all cursor-pointer ${
                    isBackgroundPlayEnabled 
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                      : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                  }`}
                  title="تفعيل التشغيل في الخلفية عند قفل الشاشة أو التنقل"
                >
                  <Music size={10} />
                  <span>{isBackgroundPlayEnabled ? 'الخلفية مفعلة ✓' : 'تشغيل بالخلفية 🎧'}</span>
                </button>

                {/* File picker with storage permission check */}
                <label 
                  onClick={async (e) => {
                    const granted = await DevicePermissionsService.requestOnDemand('files');
                    if (!granted) {
                      e.preventDefault();
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-royal-gold/10 hover:bg-royal-gold/20 border border-royal-gold/30 rounded-xl text-[9px] font-black text-royal-gold cursor-pointer transition-all"
                >
                  <Upload size={10} />
                  <span>ملفات متعددة</span>
                  <input 
                    type="file" 
                    multiple 
                    accept="video/*,audio/*" 
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                </label>

                {/* Directory Folder picker or Native Auto-Scan trigger */}
                {isNative ? (
                  <button
                    onClick={async () => {
                      const granted = await requestNativePermissions();
                      if (granted) {
                        const fetchedTracks = await scanMediaDirectory(Directory.Documents);
                        if (fetchedTracks.length > 0) {
                          setTracks(prev => {
                            const merged = [...prev];
                            fetchedTracks.forEach(newTrack => {
                              if (!merged.some(t => t.name === newTrack.name)) {
                                merged.push(newTrack);
                              }
                            });
                            if (prev.length === 0 && merged.length > 0) {
                              setCurrentTrackIndex(0);
                              setIsPlaying(true);
                            }
                            return merged;
                          });
                        }
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-[9px] font-black text-cyan-400 cursor-pointer transition-all"
                    title="مسح تلقائي لذاكرة الهاتف"
                  >
                    <FolderOpen size={10} />
                    <span>مسح تلقائي 📲</span>
                  </button>
                ) : (
                  <label className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-[9px] font-black text-cyan-400 cursor-pointer transition-all">
                    <FolderOpen size={10} />
                    <span>مجلد كامل 📂</span>
                    <input 
                      type="file" 
                      multiple 
                      {...({ webkitdirectory: "", directory: "" } as any)}
                      accept="video/*,audio/*" 
                      className="hidden" 
                      onChange={handleFolderChange}
                      ref={folderInputRef}
                    />
                  </label>
                )}

                {/* Hide / Minimize control */}
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 cursor-pointer"
                  title="تصغير المشغل"
                >
                  <Minus size={14} />
                </button>
              </div>
            </div>

            {/* Immersive Responsive Media Screen / Virtualizer Zone */}
            <div className="relative bg-black/60 rounded-[1.8rem] overflow-hidden aspect-video border border-white/5 flex items-center justify-center">
              {isVideoMode && activeTrack ? (
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={handleMediaEnded}
                  playsInline
                  controls={false}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 space-y-4 relative">
                  <div className="relative flex items-center justify-center z-10">
                    <div className="absolute inset-0 bg-royal-gold/10 rounded-full blur-xl animate-pulse scale-110" />
                    <div className="w-16 h-16 bg-royal-gold/10 border-2 border-royal-gold/20 rounded-full flex items-center justify-center text-royal-gold">
                      <Music size={28} className={isPlaying ? "rotate-12 transition-transform duration-500" : ""} />
                    </div>
                  </div>
                  <div className="text-center max-w-[80%] space-y-1 z-10">
                    <p className="text-xs font-black text-white truncate px-4">
                      {activeTrack ? activeTrack.name : 'اختر ملفات أو مجلد كامل للبدء 📂'}
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold">
                      {activeTrack ? `صوت رقمي • ${activeTrack.size}` : 'يدعم التحديد المتعدد، والتشغيل في الخلفية، وإشعارات النظام 🔔'}
                    </p>
                  </div>
                  <canvas 
                    ref={canvasRef} 
                    className="absolute bottom-0 inset-x-0 h-16 w-full opacity-60 pointer-events-none"
                    width={400}
                    height={64}
                  />
                </div>
              )}

              {/* Screen Badges & Layer tools */}
              {activeTrack && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
                  <div className="px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[9px] font-black text-royal-gold flex items-center gap-1">
                    {isVideoMode ? <Video size={10} /> : <Music size={10} />}
                    <span>{isVideoMode ? 'فيديو' : 'مسموع'}</span>
                  </div>
                  <button
                    onClick={toggleFullscreen}
                    className="p-1 px-1.5 bg-black/60 hover:bg-black/80 text-white border border-white/10 rounded-lg text-xs"
                    title="شاشة كاملة"
                  >
                    <Maximize size={10} />
                  </button>
                </div>
              )}
            </div>

            {/* Media details, timelines, scrubbing bar */}
            {activeTrack && (
              <div className="space-y-4">
                {/* Touch interactive timeline */}
                <div className="flex items-center justify-between gap-3 text-xs text-gray-400 font-mono">
                  <span className="tabular-nums">{formatSecs(currentTime)}</span>
                  <input 
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 accent-royal-gold bg-white/10 h-2 rounded-lg cursor-pointer outline-none hover:h-2.5 transition-all"
                    title="تتبع الشريط"
                  />
                  <span className="tabular-nums">{formatSecs(duration)}</span>
                </div>

                {/* Primary navigation controllers */}
                <div className="flex items-center justify-between bg-black/20 p-3 rounded-2xl border border-white/5 gap-4">
                  {/* Left segment: Skip, Play/Pause, Step triggers */}
                  <div className="flex items-center gap-2.5">
                    <button 
                      onClick={() => handleSkip('backward')}
                      className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white cursor-pointer active:scale-95 transition-all"
                      title="الملف السابق"
                    >
                      <SkipBack size={16} />
                    </button>

                    <button 
                      id="fullmedia_play"
                      onClick={togglePlay}
                      className="p-3.5 bg-royal-gold text-deep-navy rounded-xl shadow-lg shadow-royal-gold/15 cursor-pointer active:scale-95 transition-all flex items-center justify-center font-bold"
                      title={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
                    >
                      {isPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-[-1px]" />}
                    </button>

                    <button 
                      onClick={() => handleSkip('forward')}
                      className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white cursor-pointer active:scale-95 transition-all"
                      title="الملف التالي"
                    >
                      <SkipForward size={16} />
                    </button>
                  </div>

                  {/* Right Segment: Mute driver and tactile volume slider */}
                  <div className="flex items-center gap-2 max-w-[140px] mb-0 ml-0 mr-auto">
                    <button
                      onClick={toggleMute}
                      className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 cursor-pointer"
                      title={isMuted ? "إلغاء الكتم" : "كتم الصوت"}
                    >
                      {isMuted || volume === 0 ? <VolumeX size={14} className="text-red-400 animate-pulse" /> : <Volume2 size={14} />}
                    </button>
                    <input 
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        setVolume(parseFloat(e.target.value));
                        if (isMuted) setIsMuted(false);
                      }}
                      className="w-16 accent-royal-gold bg-white/10 h-1.5 rounded-lg cursor-pointer outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Local Playlist collection with Multi-Select toolbar */}
            {tracks.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap justify-between items-center px-1 gap-2 border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-300 font-extrabold uppercase tracking-wider">
                      قائمة الملفات النشطة ({tracks.length})
                    </span>
                    {selectedIds.size > 0 && (
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        محدد ({selectedIds.size})
                      </span>
                    )}
                  </div>

                  {/* Multi-Select Toolbar buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsSelectMode(!isSelectMode)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                        isSelectMode ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                      }`}
                    >
                      <ListChecks size={12} className="inline ml-1" />
                      تحديد متعدد
                    </button>

                    {isSelectMode && (
                      <>
                        <button
                          onClick={handleSelectAll}
                          className="text-[10px] font-bold text-gray-300 hover:text-white underline"
                        >
                          {selectedIds.size === tracks.length ? 'إلغاء التحديد' : 'تحديد الكل'}
                        </button>

                        {selectedIds.size > 0 && (
                          <>
                            <button
                              onClick={handlePlaySelectedQueue}
                              className="text-[10px] font-bold text-emerald-400 hover:underline flex items-center gap-1"
                            >
                              <PlayCircle size={12} />
                              تشغيل المحدد
                            </button>
                            <button
                              onClick={handleDeleteSelected}
                              className="text-[10px] text-red-400 font-bold hover:underline flex items-center gap-1"
                            >
                              <Trash2 size={12} />
                              حذف المحدد
                            </button>
                          </>
                        )}
                      </>
                    )}

                    <button 
                      onClick={() => {
                        tracks.forEach(t => {
                          try { URL.revokeObjectURL(t.url); } catch(err) {}
                        });
                        setTracks([]);
                        setSelectedIds(new Set());
                        setCurrentTrackIndex(-1);
                        setIsPlaying(false);
                      }}
                      className="text-[10px] text-red-400/80 font-bold hover:text-red-400 hover:underline mr-1"
                    >
                      تصفية الكل
                    </button>
                  </div>
                </div>

                <div className="max-h-[180px] overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/10 pr-1">
                  <AnimatePresence mode="popLayout">
                    {tracks.map((track, idx) => {
                      const isActive = idx === currentTrackIndex;
                      const isSelected = selectedIds.has(track.id);
                      return (
                        <motion.div
                          key={track.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -30 }}
                          onClick={() => {
                            if (isSelectMode) {
                              toggleSelectTrack(track.id, {} as any);
                            } else {
                              setCurrentTrackIndex(idx);
                              setIsPlaying(true);
                            }
                          }}
                          className={`flex items-center justify-between p-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                            isActive 
                              ? 'bg-royal-gold/10 border-royal-gold/30 text-royal-gold shadow-md' 
                              : isSelected
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                              : 'bg-white/5 border-transparent text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 text-right truncate max-w-[80%]">
                            {isSelectMode && (
                              <button
                                type="button"
                                onClick={(e) => toggleSelectTrack(track.id, e)}
                                className="text-amber-400 hover:scale-110 transition-transform"
                              >
                                {isSelected ? <CheckSquare size={14} /> : <Square size={14} className="text-gray-500" />}
                              </button>
                            )}
                            <span className="text-[10px] text-gray-500 mr-1 font-mono">{idx + 1}</span>
                            {track.type.startsWith('video/') ? (
                              <Video size={12} className="shrink-0 text-amber-500" />
                            ) : (
                              <Music size={12} className="shrink-0 text-emerald-400" />
                            )}
                            <span className="truncate leading-tight">{track.name}</span>
                          </div>
                          
                          <button
                            onClick={(e) => handleDeleteTrack(track.id, idx, e)}
                            className="p-1.5 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded-lg transition-all"
                            title="إزالة من القائمة"
                          >
                            <Trash2 size={12} />
                          </button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

