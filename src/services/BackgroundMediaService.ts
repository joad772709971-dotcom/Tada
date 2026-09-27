export interface MediaTrack {
  id: string;
  name: string;
  type: string; // 'audio/' or 'video/'
  url: string;
  size: string;
  artist?: string;
  album?: string;
  artwork?: string;
}

class BackgroundMediaService {
  private static instance: BackgroundMediaService;
  private audioElement: HTMLAudioElement | null = null;
  private playlist: MediaTrack[] = [];
  private selectedTrackIds: Set<string> = new Set();
  private currentIndex: number = -1;
  private isPlaying: boolean = false;
  private isBackgroundPlayEnabled: boolean = true;
  private listeners: ((track: MediaTrack | null, isPlaying: boolean, playlist: MediaTrack[]) => void)[] = [];

  private constructor() {
    if (typeof window !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.preload = 'auto';

      this.audioElement.addEventListener('ended', () => this.playNext());
      this.audioElement.addEventListener('play', () => {
        this.isPlaying = true;
        this.updateMediaSession();
        this.notifyListeners();
      });
      this.audioElement.addEventListener('pause', () => {
        this.isPlaying = false;
        this.updateMediaSession();
        this.notifyListeners();
      });

      this.setupMediaSessionActionHandlers();
    }
  }

  public static getInstance(): BackgroundMediaService {
    if (!BackgroundMediaService.instance) {
      BackgroundMediaService.instance = new BackgroundMediaService();
    }
    return BackgroundMediaService.instance;
  }

  public getAudioElement(): HTMLAudioElement | null {
    return this.audioElement;
  }

  public setPlaylist(tracks: MediaTrack[]) {
    this.playlist = tracks;
    this.notifyListeners();
  }

  public getPlaylist(): MediaTrack[] {
    return this.playlist;
  }

  public toggleTrackSelection(id: string) {
    if (this.selectedTrackIds.has(id)) {
      this.selectedTrackIds.delete(id);
    } else {
      this.selectedTrackIds.add(id);
    }
    this.notifyListeners();
  }

  public selectAllTracks() {
    this.playlist.forEach(t => this.selectedTrackIds.add(t.id));
    this.notifyListeners();
  }

  public clearTrackSelection() {
    this.selectedTrackIds.clear();
    this.notifyListeners();
  }

  public getSelectedTrackIds(): Set<string> {
    return new Set(this.selectedTrackIds);
  }

  public playSelectedQueue() {
    const selected = this.playlist.filter(t => this.selectedTrackIds.has(t.id));
    if (selected.length > 0) {
      const firstIndex = this.playlist.findIndex(t => t.id === selected[0].id);
      if (firstIndex >= 0) {
        this.playTrack(firstIndex);
      }
    }
  }

  public playTrack(index: number) {
    if (index < 0 || index >= this.playlist.length || !this.audioElement) return;
    this.currentIndex = index;
    const track = this.playlist[this.currentIndex];

    // Only handle audio directly in background service; video uses HTML video element
    if (track.type.startsWith('audio/') || !track.type.startsWith('video/')) {
      if (this.audioElement.src !== track.url) {
        this.audioElement.src = track.url;
        this.audioElement.load();
      }
      this.audioElement.play().catch(err => {
        console.warn('⚡ [BackgroundMediaService] Play was intercepted:', err);
      });
    }

    this.updateMediaSession();
    this.notifyListeners();
  }

  public togglePlayPause() {
    if (!this.audioElement || this.currentIndex < 0) return;
    if (this.audioElement.paused) {
      this.audioElement.play().catch(() => {});
    } else {
      this.audioElement.pause();
    }
  }

  public playNext() {
    if (this.playlist.length === 0) return;
    // If we have selected items, play next among selected
    if (this.selectedTrackIds.size > 0) {
      const selectedIndices = this.playlist
        .map((t, idx) => (this.selectedTrackIds.has(t.id) ? idx : -1))
        .filter(idx => idx !== -1);
      
      const currentPos = selectedIndices.indexOf(this.currentIndex);
      if (currentPos !== -1 && currentPos < selectedIndices.length - 1) {
        this.playTrack(selectedIndices[currentPos + 1]);
        return;
      } else if (selectedIndices.length > 0) {
        this.playTrack(selectedIndices[0]);
        return;
      }
    }

    const nextIndex = (this.currentIndex + 1) % this.playlist.length;
    this.playTrack(nextIndex);
  }

  public playPrevious() {
    if (this.playlist.length === 0) return;
    if (this.selectedTrackIds.size > 0) {
      const selectedIndices = this.playlist
        .map((t, idx) => (this.selectedTrackIds.has(t.id) ? idx : -1))
        .filter(idx => idx !== -1);
      
      const currentPos = selectedIndices.indexOf(this.currentIndex);
      if (currentPos > 0) {
        this.playTrack(selectedIndices[currentPos - 1]);
        return;
      } else if (selectedIndices.length > 0) {
        this.playTrack(selectedIndices[selectedIndices.length - 1]);
        return;
      }
    }

    const prevIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
    this.playTrack(prevIndex);
  }

  public getCurrentTrack(): MediaTrack | null {
    return this.currentIndex >= 0 && this.currentIndex < this.playlist.length
      ? this.playlist[this.currentIndex]
      : null;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setBackgroundPlayEnabled(enabled: boolean) {
    this.isBackgroundPlayEnabled = enabled;
  }

  public getIsBackgroundPlayEnabled(): boolean {
    return this.isBackgroundPlayEnabled;
  }

  // Update MediaSession for Android Notification Bar & Lock Screen Controls
  public updateMediaSession() {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    const track = this.getCurrentTrack();
    if (!track) {
      navigator.mediaSession.playbackState = 'none';
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name || 'مقطع وسائط',
      artist: track.artist || 'JAM System Pro',
      album: track.album || 'مشغل الميديا المطور',
      artwork: [
        {
          src: track.artwork || '/app_icon_master_source/jam_app_icon_512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    });

    navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
  }

  private setupMediaSessionActionHandlers() {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => this.togglePlayPause());
      navigator.mediaSession.setActionHandler('pause', () => this.togglePlayPause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrevious());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext());
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        if (this.audioElement) {
          this.audioElement.currentTime = Math.max(0, this.audioElement.currentTime - 10);
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        if (this.audioElement) {
          this.audioElement.currentTime = Math.min(
            this.audioElement.duration || 0,
            this.audioElement.currentTime + 10
          );
        }
      });
    } catch (err) {
      console.warn('⚡ [BackgroundMediaService] MediaSession actions error:', err);
    }
  }

  public subscribe(cb: (track: MediaTrack | null, isPlaying: boolean, playlist: MediaTrack[]) => void) {
    this.listeners.push(cb);
    cb(this.getCurrentTrack(), this.isPlaying, this.playlist);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notifyListeners() {
    const current = this.getCurrentTrack();
    this.listeners.forEach(cb => cb(current, this.isPlaying, this.playlist));
  }
}

export const backgroundMediaService = BackgroundMediaService.getInstance();
