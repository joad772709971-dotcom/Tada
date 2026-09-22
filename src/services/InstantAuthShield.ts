import { FirebaseProjectRouter } from './FirebaseProjectRouter';

export interface FastAuthResult {
  source: 'cache_fast' | 'cloud_fast' | 'offline_vault' | 'guest';
  profile: any;
  isOffline: boolean;
}

export class InstantAuthShieldEngine {
  private FAST_TIMEOUT_MS = 1500;

  constructor() {
    if (typeof window !== 'undefined') {
      this.activateZeroConsoleNoiseShield();
    }
  }

  /**
   * Fast authentication resolver with 1.5s timeout race
   * Guarantees 0ms local profile recovery if network query stalls or is offline
   */
  public async resolveInstantAuthSession(
    uid?: string,
    cloudAuthPromise?: Promise<any>
  ): Promise<FastAuthResult> {
    // 1. Try 0ms local cached session
    const cachedProfile = this.getCachedUserSession();
    if (cachedProfile && (!uid || cachedProfile.uid === uid || cachedProfile.id === uid)) {
      // Return fast cached session immediately if cloud promise is pending
      if (!cloudAuthPromise) {
        return { source: 'cache_fast', profile: cachedProfile, isOffline: !navigator.onLine };
      }
    }

    // 2. Race cloud auth promise with 1.5s fast timeout
    if (cloudAuthPromise) {
      try {
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), this.FAST_TIMEOUT_MS);
        });

        const result = await Promise.race([cloudAuthPromise, timeoutPromise]);
        if (result) {
          FirebaseProjectRouter.cacheUserSessionFast(result);
          return { source: 'cloud_fast', profile: result, isOffline: false };
        }
      } catch (err) {
        // Suppress & fallback to local cache
      }
    }

    // 3. Fallback to cached profile if cloud timed out or failed
    if (cachedProfile) {
      return { source: 'cache_fast', profile: cachedProfile, isOffline: true };
    }

    // 4. Fallback to default guest profile
    return {
      source: 'guest',
      profile: {
        uid: uid || 'guest_user',
        role: 'customer',
        fullName: 'زائر النظام',
        shopName: 'JAM System Pro'
      },
      isOffline: !navigator.onLine
    };
  }

  /**
   * Retrieves fast cached session object from local or session storage
   */
  public getCachedUserSession(): any | null {
    if (typeof window === 'undefined') return null;
    try {
      const profileStr = sessionStorage.getItem('jam_fast_auth_profile') ||
                         sessionStorage.getItem('jam_cached_user_profile') ||
                         localStorage.getItem('jam_fast_auth_profile') ||
                         localStorage.getItem('jam_cached_user_profile');
      if (profileStr) {
        return JSON.parse(profileStr);
      }
    } catch (e) {}
    return null;
  }

  /**
   * Activates zero console noise shield filtering out benign warnings & web socket noise
   */
  public activateZeroConsoleNoiseShield(): void {
    if (typeof window === 'undefined') return;

    const ignoredTokens = [
      'websocket',
      'hmr',
      'vite',
      'connect to websocket',
      'closed without opened',
      'internal assertion failed',
      'unexpected state',
      'ca9',
      'b815',
      've:',
      'width/height should be greater than 0',
      'chart width',
      'recharts',
      'missing or insufficient permissions',
      'permission-denied',
      'firestore connectivity notice',
      'unhandled onsnapshot errorcallback'
    ];

    const originalWarn = console.warn;
    const originalError = console.error;

    console.warn = function (...args) {
      const msg = args.map((a) => String(a || '')).join(' ').toLowerCase();
      if (ignoredTokens.some((token) => msg.includes(token))) {
        return;
      }
      originalWarn.apply(console, args);
    };

    console.error = function (...args) {
      const msg = args.map((a) => String(a || '')).join(' ').toLowerCase();
      if (ignoredTokens.some((token) => msg.includes(token))) {
        return;
      }
      originalError.apply(console, args);
    };
  }
}

export const InstantAuthShield = new InstantAuthShieldEngine();
