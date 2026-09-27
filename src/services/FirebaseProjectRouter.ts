import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeFirestore, memoryLocalCache, getFirestore, Firestore, doc, getDoc } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { db as defaultDb, auth as defaultAuth, app as defaultApp } from '../firebase';

export type ProjectTier = 
  | 'importer'           // joad7723
  | 'wholesale_master'   // joad77231
  | 'wholesaler'         // joad772315
  | 'retailer'           // joad7723151
  | 'customer'           // joad772315106
  | 'super_admin';       // joad7723_master

export interface FirebaseProjectConfig {
  projectId: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  apiKey: string;
}

// Default base keys template (derived from resilient primary project setup)
const BASE_API_KEY = "AIzaSyDwa1Ov1a5tokg99-OwLURJgmUp3WGjxSs";
const SENDER_ID = "1036814343169";

export const PROJECT_TIER_CONFIGS: Record<ProjectTier, FirebaseProjectConfig> = {
  importer: {
    projectId: 'joad7723',
    authDomain: 'joad7723.firebaseapp.com',
    storageBucket: 'joad7723.appspot.com',
    messagingSenderId: SENDER_ID,
    appId: '1:1036814343169:web:joad7723importer',
    apiKey: BASE_API_KEY
  },
  wholesale_master: {
    projectId: 'joad77231',
    authDomain: 'joad77231.firebaseapp.com',
    storageBucket: 'joad77231.appspot.com',
    messagingSenderId: SENDER_ID,
    appId: '1:1036814343169:web:joad77231master',
    apiKey: BASE_API_KEY
  },
  wholesaler: {
    projectId: 'joad772315',
    authDomain: 'joad772315.firebaseapp.com',
    storageBucket: 'joad772315.appspot.com',
    messagingSenderId: SENDER_ID,
    appId: '1:1036814343169:web:joad772315wholesaler',
    apiKey: BASE_API_KEY
  },
  retailer: {
    projectId: 'joad7723151',
    authDomain: 'joad7723151.firebaseapp.com',
    storageBucket: 'joad7723151.appspot.com',
    messagingSenderId: SENDER_ID,
    appId: '1:1036814343169:web:joad7723151retailer',
    apiKey: BASE_API_KEY
  },
  customer: {
    projectId: 'joad772315106',
    authDomain: 'joad772315106.firebaseapp.com',
    storageBucket: 'joad772315106.appspot.com',
    messagingSenderId: SENDER_ID,
    appId: '1:1036814343169:web:joad772315106customer',
    apiKey: BASE_API_KEY
  },
  super_admin: {
    projectId: 'joad7723-master',
    authDomain: 'joad7723-master.firebaseapp.com',
    storageBucket: 'joad7723-master.appspot.com',
    messagingSenderId: SENDER_ID,
    appId: '1:1036814343169:web:joad7723masteradmin',
    apiKey: BASE_API_KEY
  }
};

class FirebaseProjectRouterEngine {
  private appsMap = new Map<ProjectTier, FirebaseApp>();
  private firestoreMap = new Map<ProjectTier, Firestore>();
  private authMap = new Map<ProjectTier, Auth>();

  constructor() {
    // Register default primary app instance to importer/default
    this.appsMap.set('importer', defaultApp);
    this.firestoreMap.set('importer', defaultDb);
    this.authMap.set('importer', defaultAuth);
  }

  /**
   * Determine project tier based on user role or merchant classification
   */
  public resolveTier(role?: string, profile?: any): ProjectTier {
    const rawRole = (role || profile?.role || profile?.userRole || '').toLowerCase();
    const rawTier = (profile?.businessTier || profile?.userTier || profile?.tier || '').toLowerCase();

    if (rawTier === 'wholesale_master' || rawTier === 'mega_wholesale' || rawTier === 'master_wholesale' || rawTier === 'جملة الجملة') {
      return 'wholesale_master';
    }
    if (rawTier === 'importer' || rawTier === 'مستورد') {
      return 'importer';
    }
    if (rawTier === 'wholesaler' || rawTier === 'wholesale' || rawTier === 'جملة') {
      return 'wholesaler';
    }
    if (rawTier === 'retail' || rawTier === 'retailer' || rawTier === 'تجزئة') {
      return 'retailer';
    }
    if (rawTier === 'individual' || rawTier === 'customer' || rawTier === 'أفراد') {
      return 'customer';
    }

    switch (rawRole) {
      case 'super_admin':
      case 'superadmin':
      case 'developer':
      case 'master_owner':
        return 'super_admin';

      case 'importer':
      case 'main_importer':
        return 'importer';

      case 'wholesale_master':
      case 'master_wholesale':
      case 'mega_wholesale':
      case 'jumlajumla':
        return 'wholesale_master';

      case 'wholesaler':
      case 'wholesale':
      case 'jumla':
      case 'distributor':
        return 'wholesaler';

      case 'retailer':
      case 'retail':
      case 'tajzeah':
      case 'owner':
      case 'manager':
      case 'shop_owner':
      case 'cashier':
      case 'technician':
      case 'sales':
      case 'staff':
        return 'retailer';

      case 'customer':
      case 'client':
      case 'retail_customer':
      case 'b2c_client':
      case 'guest':
        return 'customer';

      default:
        return 'importer'; // Primary default tier
    }
  }

  /**
   * Lazily initializes and retrieves FirebaseApp for a given tier
   */
  public getAppForTier(tier: ProjectTier): FirebaseApp {
    if (this.appsMap.has(tier)) {
      return this.appsMap.get(tier)!;
    }

    const appName = `JAM_APP_${tier.toUpperCase()}`;
    const existingApps = getApps();
    let app = existingApps.find(a => a.name === appName);

    if (!app) {
      const config = PROJECT_TIER_CONFIGS[tier];
      try {
        app = initializeApp(config, appName);
      } catch (err) {
        console.warn(`[FirebaseProjectRouter] Fallback to default app for tier ${tier}:`, err);
        app = defaultApp;
      }
    }

    this.appsMap.set(tier, app);
    return app;
  }

  /**
   * Retrieves Firestore instance for a specific tier with persistent cache support
   */
  public getFirestoreForTier(tier: ProjectTier): Firestore {
    if (this.firestoreMap.has(tier)) {
      return this.firestoreMap.get(tier)!;
    }

    const app = this.getAppForTier(tier);
    if (app === defaultApp) {
      return defaultDb;
    }

    let dbInstance: Firestore;
    try {
      dbInstance = getFirestore(app);
    } catch {
      try {
        dbInstance = initializeFirestore(app, {
          localCache: memoryLocalCache()
        });
      } catch {
        dbInstance = getFirestore(app);
      }
    }

    this.firestoreMap.set(tier, dbInstance);
    return dbInstance;
  }

  /**
   * Retrieves Auth instance for a specific tier
   */
  public getAuthForTier(tier: ProjectTier): Auth {
    if (this.authMap.has(tier)) {
      return this.authMap.get(tier)!;
    }

    const app = this.getAppForTier(tier);
    if (app === defaultApp) {
      return defaultAuth;
    }

    const authInstance = getAuth(app);
    this.authMap.set(tier, authInstance);
    return authInstance;
  }

  /**
   * Get all initialized or configured tier IDs
   */
  public getAllTiers(): ProjectTier[] {
    return ['importer', 'wholesale_master', 'wholesaler', 'retailer', 'customer', 'super_admin'];
  }

  /**
   * Fast parallel resolution of user session from primary/super_admin and importer tiers simultaneously
   */
  public async resolveParallelUserSession(uid: string): Promise<any | null> {
    try {
      const superAdminDb = this.getFirestoreForTier('super_admin');
      const importerDb = this.getFirestoreForTier('importer');

      const [superAdminSnap, importerSnap] = await Promise.allSettled([
        getDoc(doc(superAdminDb, 'users', uid)),
        getDoc(doc(importerDb, 'users', uid))
      ]);

      if (superAdminSnap.status === 'fulfilled' && superAdminSnap.value.exists()) {
        return superAdminSnap.value.data();
      }
      if (importerSnap.status === 'fulfilled' && importerSnap.value.exists()) {
        return importerSnap.value.data();
      }
    } catch (err) {
      console.warn('⚠️ [FirebaseProjectRouter] Fast parallel auth query warning:', err);
    }
    return null;
  }

  /**
   * Immediate 0ms fast-track caching for user profile and session
   */
  public cacheUserSessionFast(profile: any): void {
    if (!profile) return;
    try {
      const profileStr = JSON.stringify(profile);
      sessionStorage.setItem('jam_fast_auth_profile', profileStr);
      sessionStorage.setItem('jam_cached_user_profile', profileStr);
      sessionStorage.setItem('jam_fast_user_session', profileStr);
      sessionStorage.setItem('jam_session_verified', 'true');
      
      localStorage.setItem('jam_fast_auth_profile', profileStr);
      localStorage.setItem('jam_cached_user_profile', profileStr);
      localStorage.setItem('jam_session_verified', 'true');
      if (profile.shopName) {
        localStorage.setItem('jam_last_logged_in_shop_name', profile.shopName);
      }
    } catch (e) {
      console.warn('Failed to fast-track cache user session:', e);
    }
  }

  /**
   * Complete 0ms clearing for user profile and session caches
   */
  public clearUserSessionFast(): void {
    try {
      sessionStorage.removeItem('jam_fast_auth_profile');
      sessionStorage.removeItem('jam_cached_user_profile');
      sessionStorage.removeItem('jam_fast_user_session');
      sessionStorage.removeItem('jam_session_verified');
      
      localStorage.removeItem('jam_fast_auth_profile');
      localStorage.removeItem('jam_cached_user_profile');
      localStorage.removeItem('jam_session_verified');
      localStorage.removeItem('jam_user_profile');
      localStorage.removeItem('jam_device_trusted');
      localStorage.removeItem('jam_persistent_device_verified');
    } catch (e) {
      console.warn('Failed to clear fast user session cache:', e);
    }
  }
}

export const FirebaseProjectRouter = new FirebaseProjectRouterEngine();
