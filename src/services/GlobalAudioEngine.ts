/**
 * 🎵 Global Persistent Audio/Media Engine for JAM SYSTEM PRO
 * Singleton engine maintaining a continuous, uninterrupted playback lifecycle
 * completely immune to React route transitions, component unmounts, or UI layout switches.
 * Supports background notification control on mobile / Android APK via MediaSession.
 */

export interface PlaylistItem {
  id: string;
  name: string;
  file?: File;
  url: string;
  isVideo: boolean;
  type: string;
  size?: string;
}

export interface GlobalAudioState {
  hasMedia: boolean;
  fileName: string;
  fileType: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  allowBackground: boolean;
  isVideo: boolean;
  rotationAngle: number;
  playlist: PlaylistItem[];
  currentIndex: number;
  repeatMode: 'off' | 'all' | 'one';
  isShuffle: boolean;
}

type AudioListener = (state: GlobalAudioState) => void;

class GlobalAudioEngineService {
  private static instance: GlobalAudioEngineService | null = null;

  private audioEl: HTMLAudioElement | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private activeMediaEl: HTMLMediaElement | null = null;
  private mediaUrl: string | null = null;
  private isVideo: boolean = false;
  private listeners: Set<AudioListener> = new Set();

  private wakeLock: any = null;
  private audioCtx: AudioContext | null = null;
  private keepAliveOsc: OscillatorNode | null = null;
  private keepAliveGain: GainNode | null = null;

  private state: GlobalAudioState = {
    hasMedia: false,
    fileName: '',
    fileType: '',
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.85,
    isMuted: false,
    playbackRate: 1,
    allowBackground: true,
    isVideo: false,
    rotationAngle: 0,
    playlist: [],
    currentIndex: -1,
    repeatMode: 'all',
    isShuffle: false,
  };

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initMediaElements();
      this.initVisibilityListener();
    }
  }

  public static getInstance(): GlobalAudioEngineService {
    if (!GlobalAudioEngineService.instance) {
      GlobalAudioEngineService.instance = new GlobalAudioEngineService();
    }
    return GlobalAudioEngineService.instance;
  }

  private initMediaElements() {
    try {
      // 1. Permanent background audio element attached to document root
      this.audioEl = document.createElement('audio');
      this.audioEl.id = 'jam-persistent-audio-engine';
      this.audioEl.style.display = 'none';
      this.audioEl.preload = 'auto';
      this.audioEl.setAttribute('playsinline', 'true');
      this.audioEl.setAttribute('webkit-playsinline', 'true');

      this.audioEl.addEventListener('play', () => this.onPlayStateChange(true));
      this.audioEl.addEventListener('pause', () => this.onPlayStateChange(false));
      this.audioEl.addEventListener('timeupdate', () => this.onTimeUpdate());
      this.audioEl.addEventListener('loadedmetadata', () => this.onMetadataLoaded());
      this.audioEl.addEventListener('ended', () => this.onEnded());
      this.audioEl.addEventListener('error', (e) => console.warn('Audio engine error:', e));

      document.body.appendChild(this.audioEl);
      this.activeMediaEl = this.audioEl;
    } catch (e) {
      console.warn('Failed to append global audio element:', e);
    }
  }

  private initVisibilityListener() {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (this.state.isPlaying && this.state.allowBackground && this.activeMediaEl) {
          if (this.activeMediaEl.paused) {
            this.activeMediaEl.play().catch((err) => console.warn('Background resume:', err));
          }
        }
      } else if (document.visibilityState === 'visible') {
        if (this.state.isPlaying) {
          this.requestWakeLock();
        }
      }
    });
  }

  private startAudioKeepAlive() {
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          this.audioCtx = new AudioCtxClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      if (this.audioCtx && !this.keepAliveOsc) {
        this.keepAliveOsc = this.audioCtx.createOscillator();
        this.keepAliveGain = this.audioCtx.createGain();
        this.keepAliveOsc.frequency.setValueAtTime(40, this.audioCtx.currentTime);
        this.keepAliveGain.gain.setValueAtTime(0.00001, this.audioCtx.currentTime);
        this.keepAliveOsc.connect(this.keepAliveGain);
        this.keepAliveGain.connect(this.audioCtx.destination);
        this.keepAliveOsc.start();
      }
    } catch (err) {
      console.warn('Keep-alive oscillator error:', err);
    }
  }

  private stopAudioKeepAlive() {
    try {
      if (this.keepAliveOsc) {
        this.keepAliveOsc.stop();
        this.keepAliveOsc.disconnect();
        this.keepAliveOsc = null;
      }
    } catch (e) {
      console.warn('Stop keep-alive error:', e);
    }
  }

  private async requestWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && this.state.allowBackground) {
      try {
        if (!this.wakeLock) {
          this.wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('WakeLock skipped:', err);
      }
    }
  }

  private releaseWakeLock() {
    try {
      if (this.wakeLock) {
        this.wakeLock.release();
        this.wakeLock = null;
      }
    } catch (err) {
      console.warn('WakeLock release error:', err);
    }
  }

  private updateMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      const isCustomer = typeof window !== 'undefined' && (
        localStorage.getItem('JAM_APP_VARIANT')?.includes('CUSTOMER') ||
        localStorage.getItem('JAM_APP_VARIANT') === 'store_pro'
      );
      const iconPath = isCustomer 
        ? '/assets/icons/customer-vip-icon.png' 
        : '/app_icon_master_source/jam_app_icon_512.png';

      const playlistCount = this.state.playlist.length;
      const albumTitle = playlistCount > 1 
        ? `قائمة تشغيل (${this.state.currentIndex + 1}/${playlistCount}) 🟢`
        : (this.state.allowBackground ? 'تشغيل مستمر بالخلفية 🟢' : 'مشغل الوسائط');

      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.state.fileName || 'مشغل الصوتيات والميديا',
        artist: isCustomer ? 'تطبيق Store pro - مشغل الميديا' : 'منظومة JAM SYSTEM PRO',
        album: albumTitle,
        artwork: [
          { src: iconPath, sizes: '512x512', type: 'image/png' },
          { src: iconPath, sizes: '256x256', type: 'image/png' },
          { src: iconPath, sizes: '192x192', type: 'image/png' },
          { src: iconPath, sizes: '96x96', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => this.seekBy(-10));
      navigator.mediaSession.setActionHandler('seekforward', () => this.seekBy(10));
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextTrack());
      navigator.mediaSession.setActionHandler('stop', () => this.stopAndClose());

      try {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined && details.seekTime !== null) {
            this.seek(details.seekTime);
          }
        });
      } catch {
        // seekto not supported on older browsers
      }

      this.updatePositionState();
    } catch (e) {
      console.warn('MediaSession config error:', e);
    }
  }

  private updatePositionState() {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      try {
        if (this.state.duration && !isNaN(this.state.duration) && this.state.duration > 0) {
          navigator.mediaSession.setPositionState({
            duration: this.state.duration,
            playbackRate: this.state.playbackRate || 1,
            position: Math.max(0, Math.min(this.state.currentTime, this.state.duration))
          });
        }
      } catch (err) {
        // Invalid state ignore
      }
    }
  }

  private onPlayStateChange(playing: boolean) {
    this.state.isPlaying = playing;
    if (playing) {
      this.startAudioKeepAlive();
      this.requestWakeLock();
    } else {
      this.releaseWakeLock();
    }
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
    this.updatePositionState();
    this.notify();
  }

  private onTimeUpdate() {
    if (this.activeMediaEl) {
      this.state.currentTime = this.activeMediaEl.currentTime;
      this.updatePositionState();
      this.notify();
    }
  }

  private onMetadataLoaded() {
    if (this.activeMediaEl) {
      this.state.duration = this.activeMediaEl.duration || 0;
      this.updatePositionState();
      this.notify();
    }
  }

  private onEnded() {
    if (this.state.repeatMode === 'one') {
      this.seek(0);
      this.play();
      return;
    }

    if (this.state.playlist.length > 1) {
      const nextIdx = this.state.currentIndex + 1;
      if (nextIdx < this.state.playlist.length) {
        this.playTrackAtIndex(nextIdx);
      } else if (this.state.repeatMode === 'all') {
        this.playTrackAtIndex(0);
      } else {
        this.state.isPlaying = false;
        this.notify();
      }
    } else if (this.state.repeatMode === 'all') {
      this.seek(0);
      this.play();
    } else {
      this.state.isPlaying = false;
      this.notify();
    }
  }

  private notify() {
    const cloned = { ...this.state, playlist: [...this.state.playlist] };
    this.listeners.forEach((cb) => cb(cloned));
  }

  // --- Public API Controls ---

  public subscribe(listener: AudioListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state, playlist: [...this.state.playlist] });
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): GlobalAudioState {
    return { ...this.state, playlist: [...this.state.playlist] };
  }

  private formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Load a list of files as a new playlist and start playing the first file
   */
  public loadFiles(files: File[]) {
    if (!files || files.length === 0) return;

    // Clean old URLs
    this.state.playlist.forEach(item => {
      if (item.url && item.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
    });

    const newPlaylist: PlaylistItem[] = files.map((file, idx) => {
      const isVid = file.type.startsWith('video') || /\.(mp4|mkv|webm|avi|mov|wmv|3gp|ts)$/i.test(file.name);
      return {
        id: `track-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        name: file.name,
        file: file,
        url: URL.createObjectURL(file),
        isVideo: isVid,
        type: file.type || (isVid ? 'video/mp4' : 'audio/mp3'),
        size: this.formatFileSize(file.size)
      };
    });

    this.state.playlist = newPlaylist;
    this.playTrackAtIndex(0);
  }

  /**
   * Add files to current playlist without interrupting if already playing
   */
  public addFilesToPlaylist(files: File[]) {
    if (!files || files.length === 0) return;

    const addedItems: PlaylistItem[] = files.map((file, idx) => {
      const isVid = file.type.startsWith('video') || /\.(mp4|mkv|webm|avi|mov|wmv|3gp|ts)$/i.test(file.name);
      return {
        id: `track-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        name: file.name,
        file: file,
        url: URL.createObjectURL(file),
        isVideo: isVid,
        type: file.type || (isVid ? 'video/mp4' : 'audio/mp3'),
        size: this.formatFileSize(file.size)
      };
    });

    this.state.playlist = [...this.state.playlist, ...addedItems];

    // If nothing was playing, start the first newly added item
    if (!this.state.hasMedia || this.state.currentIndex === -1) {
      this.playTrackAtIndex(0);
    } else {
      this.updateMediaSession();
      this.notify();
    }
  }

  public loadFile(file: File) {
    this.loadFiles([file]);
  }

  public playTrackAtIndex(index: number) {
    if (index < 0 || index >= this.state.playlist.length) return;

    const track = this.state.playlist[index];
    this.state.currentIndex = index;
    this.mediaUrl = track.url;
    this.isVideo = track.isVideo;

    this.state.hasMedia = true;
    this.state.fileName = track.name;
    this.state.fileType = track.type;
    this.state.isVideo = track.isVideo;
    this.state.currentTime = 0;
    this.state.duration = 0;
    this.state.rotationAngle = 0;

    if (this.isVideo && this.videoEl) {
      this.bindVideoElement(this.videoEl);
    } else if (this.audioEl) {
      this.audioEl.src = this.mediaUrl;
      this.audioEl.volume = this.state.volume;
      this.audioEl.playbackRate = this.state.playbackRate;
      this.activeMediaEl = this.audioEl;
    }

    this.updateMediaSession();
    this.notify();
    this.play();
  }

  public nextTrack() {
    if (this.state.playlist.length <= 1) {
      this.seek(0);
      this.play();
      return;
    }

    if (this.state.isShuffle) {
      let randIdx = Math.floor(Math.random() * this.state.playlist.length);
      if (randIdx === this.state.currentIndex && this.state.playlist.length > 1) {
        randIdx = (randIdx + 1) % this.state.playlist.length;
      }
      this.playTrackAtIndex(randIdx);
      return;
    }

    const nextIdx = (this.state.currentIndex + 1) % this.state.playlist.length;
    this.playTrackAtIndex(nextIdx);
  }

  public prevTrack() {
    if (this.state.playlist.length <= 1) {
      this.seek(0);
      this.play();
      return;
    }

    if (this.state.currentTime > 3) {
      this.seek(0);
      return;
    }

    const prevIdx = (this.state.currentIndex - 1 + this.state.playlist.length) % this.state.playlist.length;
    this.playTrackAtIndex(prevIdx);
  }

  public removeFromPlaylist(id: string) {
    const itemToRemove = this.state.playlist.find(i => i.id === id);
    if (itemToRemove && itemToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(itemToRemove.url);
    }

    const itemIdx = this.state.playlist.findIndex(i => i.id === id);
    const newPlaylist = this.state.playlist.filter(i => i.id !== id);
    this.state.playlist = newPlaylist;

    if (newPlaylist.length === 0) {
      this.stopAndClose();
      return;
    }

    if (itemIdx === this.state.currentIndex) {
      const nextIdx = Math.min(itemIdx, newPlaylist.length - 1);
      this.playTrackAtIndex(nextIdx);
    } else if (itemIdx < this.state.currentIndex) {
      this.state.currentIndex = this.state.currentIndex - 1;
      this.notify();
    } else {
      this.notify();
    }
  }

  public clearPlaylist() {
    this.state.playlist.forEach(item => {
      if (item.url && item.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
    });
    this.stopAndClose();
  }

  public toggleRepeat() {
    const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
    const nextMode = modes[(modes.indexOf(this.state.repeatMode) + 1) % modes.length];
    this.state.repeatMode = nextMode;
    this.notify();
  }

  public toggleShuffle() {
    this.state.isShuffle = !this.state.isShuffle;
    this.notify();
  }

  public bindVideoElement(videoEl: HTMLVideoElement | null) {
    this.videoEl = videoEl;
    if (this.isVideo && videoEl && this.mediaUrl) {
      const wasPlaying = this.state.isPlaying;
      const currentPos = this.state.currentTime;

      // Transfer source to video element
      if (this.audioEl) {
        this.audioEl.pause();
      }

      videoEl.src = this.mediaUrl;
      videoEl.currentTime = currentPos;
      videoEl.volume = this.state.volume;
      videoEl.playbackRate = this.state.playbackRate;
      this.activeMediaEl = videoEl;

      if (wasPlaying) {
        videoEl.play().catch(() => {});
      }
    }
  }

  public async play() {
    if (!this.activeMediaEl) return;
    try {
      this.startAudioKeepAlive();
      await this.activeMediaEl.play();
      this.state.isPlaying = true;
      this.requestWakeLock();
      this.notify();
    } catch (err) {
      console.warn('Playback start error:', err);
    }
  }

  public pause() {
    if (!this.activeMediaEl) return;
    this.activeMediaEl.pause();
    this.state.isPlaying = false;
    this.releaseWakeLock();
    this.notify();
  }

  public togglePlay() {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public seek(seconds: number) {
    if (!this.activeMediaEl) return;
    const target = Math.max(0, Math.min(seconds, this.state.duration || 99999));
    this.activeMediaEl.currentTime = target;
    this.state.currentTime = target;
    this.updatePositionState();
    this.notify();
  }

  public seekBy(deltaSeconds: number) {
    if (!this.activeMediaEl) return;
    const target = Math.max(0, Math.min(this.activeMediaEl.currentTime + deltaSeconds, this.state.duration || 99999));
    this.activeMediaEl.currentTime = target;
    this.state.currentTime = target;
    this.updatePositionState();
    this.notify();
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.state.volume = clamped;
    if (this.activeMediaEl) {
      this.activeMediaEl.volume = clamped;
    }
    if (clamped > 0 && this.state.isMuted) {
      this.state.isMuted = false;
    }
    this.notify();
  }

  public toggleMute() {
    const nextMute = !this.state.isMuted;
    this.state.isMuted = nextMute;
    if (this.activeMediaEl) {
      this.activeMediaEl.muted = nextMute;
    }
    this.notify();
  }

  public setPlaybackRate(rate: number) {
    this.state.playbackRate = rate;
    if (this.activeMediaEl) {
      this.activeMediaEl.playbackRate = rate;
    }
    this.notify();
  }

  public cycleSpeed() {
    const speeds = [1, 1.25, 1.5, 2, 0.5, 0.75];
    const nextIdx = (speeds.indexOf(this.state.playbackRate) + 1) % speeds.length;
    this.setPlaybackRate(speeds[nextIdx]);
  }

  public rotateVideo() {
    this.state.rotationAngle = (this.state.rotationAngle + 90) % 360;
    this.notify();
  }

  public setAllowBackground(allow: boolean) {
    this.state.allowBackground = allow;
    localStorage.setItem('jam_bg_play', allow ? 'true' : 'false');
    this.notify();
  }

  public stopAndClose() {
    if (this.activeMediaEl) {
      this.activeMediaEl.pause();
      this.activeMediaEl.currentTime = 0;
    }
    if (this.mediaUrl && this.mediaUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.mediaUrl);
      this.mediaUrl = null;
    }
    this.stopAudioKeepAlive();
    this.releaseWakeLock();

    this.state.hasMedia = false;
    this.state.fileName = '';
    this.state.isPlaying = false;
    this.state.currentTime = 0;
    this.state.duration = 0;
    this.state.playlist = [];
    this.state.currentIndex = -1;
    this.notify();

    window.dispatchEvent(new CustomEvent('jam-media-player-closed'));
  }

  public getMediaUrl(): string | null {
    return this.mediaUrl;
  }
}

export const globalAudioEngine = GlobalAudioEngineService.getInstance();
