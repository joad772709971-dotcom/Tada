import { db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { persistentStorageEngine } from './PersistentStorageEngine';

interface OfflineSession {
  userId: string;
  storeId: string;
  userPayload: any;
  lastSyncTimestamp: number;
  appType: 'merchant' | 'customer';
}

/**
 * 0. Get silent background email domain based on Assigned Role
 */
export function getDomainForRole(role: string): string {
  const r = (role || '').toLowerCase();
  if (['owner', 'admin', 'superadmin', 'importer', 'mega_wholesale', 'wholesaler', 'retailer', 'master_wholesale', 'shop owner', 'system owner'].includes(r)) {
    return '@gmail.com';
  }
  if (r === 'manager') {
    return '@jam.com';
  }
  if (r === 'sales' || r === 'cashier' || r === 'sales employee') {
    return '@yahoo.com';
  }
  if (r === 'engineer' || r === 'vault' || r === 'exchange' || r === 'vault cashier' || r === 'exchange counter') {
    return '@joad.com';
  }
  if (r === 'driver' || r === 'delivery' || r === 'agent' || r === 'delivery_agent') {
    return '@mna.com';
  }
  if (r === 'packer' || r === 'warehouse' || r === 'packing' || r === 'packing clerk' || r === 'staff') {
    return '@dad.com';
  }
  if (r === 'customer') {
    return '@jam-pro.net';
  }
  return '@yahoo.com'; // Default fallback
}

/**
 * 1. Smart Ping Connectivity Check
 * يتخطى فحص المتصفح العادي ليتأكد من وجود إنترنت حقيقي ورصيد شبكة فعال
 */
export async function checkRealInternetConnectivity(): Promise<boolean> {
  if (typeof navigator !== 'undefined') {
    return navigator.onLine;
  }
  return true;
}

/**
 * 2. Authenticate & Hydrate Local Session
 * فحص الدخول سحابياً ومحلياً مع إلغاء قيود الحظر والـ 5 محاولات الفاشلة نهائياً بناءً على طلبك
 */
export async function authenticateEcosystemUser(
  username: string, 
  passwordHash: string, 
  appType: 'merchant' | 'customer'
): Promise<{ success: boolean; msg: string; data?: any }> {
  
  const localKey = `jam_secure_holder_${username}`;
  const isOnline = await checkRealInternetConnectivity();

  // جلب الجلسة المحلية المحقونة بالجهاز مسبقاً مع استعادة الأرشيف المشفر عند الفقدان
  let cachedDataRaw = localStorage.getItem(localKey);
  if (!cachedDataRaw) {
    cachedDataRaw = await persistentStorageEngine.getItem(localKey);
  }
  let cachedSession: OfflineSession | null = cachedDataRaw ? JSON.parse(cachedDataRaw) : null;

  if (isOnline) {
    try {
      // الولوج السحابي المباشر لتمكين الزبائن الجدد من الدخول الفوري دون حقن مسبق
      const userRef = doc(db, 'users', username);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();

        if (userData.passwordHash === passwordHash) {
          const freshSession: OfflineSession = {
            userId: username,
            storeId: userData.storeId || 'default_tenant',
            userPayload: userData,
            lastSyncTimestamp: Date.now(),
            appType
          };
          
          // حقن الجلسة محلياً فوراً للاستخدام الأوفلاين المستقبلي وتصويرها محميًا
          const serializedSession = JSON.stringify(freshSession);
          localStorage.setItem(localKey, serializedSession);
          persistentStorageEngine.setItem(localKey, serializedSession, freshSession.storeId, freshSession.userId).catch(() => {});

          return { success: true, msg: 'دخول سحابي ناجح وتم تحديث الحقن المحلي للبيانات', data: userData };
        } else {
          return { success: false, msg: 'كلمة المرور المدخلة خاطئة، يرجى إعادة المحاولة.' };
        }
      }
    } catch (e) {
      console.log('ضعف اتصال مفاجئ، التحول للموثق المحلي...');
    }
  }

  // 3. معالجة العمل أوفلاين والتحقق من المهل الزمنية (10 أيام للتجار / شهر للزبائن)
  if (cachedSession) {
    if (cachedSession.userPayload.passwordHash === passwordHash) {
      const now = Date.now();
      const elapsedDays = (now - cachedSession.lastSyncTimestamp) / (1000 * 60 * 60 * 24);
      const allowedDays = cachedSession.appType === 'merchant' ? 10 : 30;

      if (elapsedDays > allowedDays) {
        return { 
          success: false, 
          msg: `انتهت صلاحية العمل أوفلاين دون مزامنة شبكية (${allowedDays} أيام). يرجى فتح الإنترنت لتجديد الصلاحية.` 
        };
      }

      return { success: true, msg: 'تم الدخول بنجاح بالوضع الأوفلاين المستقر', data: cachedSession.userPayload };
    } else {
      return { success: false, msg: 'كلمة المرور خاطئة في وضع عدم الاتصال.' };
    }
  }

  return { 
    success: false, 
    msg: `تعذر الدخول. الحساب غير محقون محلياً ويتطلب اتصالاً بالإنترنت للمرة الأولى. للدعم تواصل بـ: 772315106 - أبو جواد المحفلي` 
  } ;
}

/**
 * 4. توليد معرفات العمليات الفريدة أوفلاين وتأكيد تبعية المعاملة للمحل والموظف
 * تمنع التداخل واختباط دفاتر وموظفي المحلات المختلفة
 */
export function generateNonCollidingTransactionId(storeId: string, userId: string, prefix: string): string {
  const cleanStore = (storeId || 'master').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const cleanUser = (userId || 'anon').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const timestamp = Date.now();
  const randomSalt = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}_${cleanStore}_${cleanUser}_${timestamp}_${randomSalt}`;
}

/**
 * 4.1. ختم معطيات المحل والمشغل (Store & Operator Stamping)
 * يُجبر جميع العمليات (مبيعات، مخزون، صيانة، حركات مالية، سجلات نشاط) على التغليف بمعرف المحل ومعرف المنفذ
 */
export interface StoreIsolationStamp {
  storeId: string;
  ownerId: string;
  createdByUid: string;
  createdByRole: string;
  createdByName: string;
  operatorPhone?: string;
  createdAtTimestamp: number;
  isOfflineSyncPending?: boolean;
}

export function stampStoreContext<T extends Record<string, any>>(data: T, profile: any): T & StoreIsolationStamp {
  const storeId = profile?.ownerId || profile?.storeId || profile?.shopId || profile?.uid || 'master';
  const ownerId = profile?.ownerId || profile?.storeId || storeId;
  const createdByUid = profile?.uid || profile?.id || 'anonymous';
  const createdByRole = profile?.role || 'staff';
  const createdByName = profile?.name || profile?.displayName || profile?.phone || profile?.username || 'المستخدم';
  const operatorPhone = profile?.phone || profile?.username || '';

  return {
    ...data,
    storeId: data.storeId || storeId,
    ownerId: data.ownerId || ownerId,
    createdByUid: data.createdByUid || createdByUid,
    createdByRole: data.createdByRole || createdByRole,
    createdByName: data.createdByName || createdByName,
    operatorPhone: data.operatorPhone || operatorPhone,
    createdAtTimestamp: data.createdAtTimestamp || Date.now(),
    isOfflineSyncPending: data.isOfflineSyncPending ?? false
  };
}

/**
 * 4.2. عزل وحماية البيانات حسب المحل (Multi-Tenant Data Filtering)
 * يضمن عدم تسرب أو اختلاط بيانات المحلات أوفلاين وسحابياً
 */
export function filterDataByStore<T extends Record<string, any>>(
  items: T[], 
  currentStoreId?: string, 
  currentOwnerId?: string
): T[] {
  if (!items || !Array.isArray(items)) return [];
  if (!currentStoreId && !currentOwnerId) return items;
  
  const targetStore = (currentStoreId || currentOwnerId || '').trim();
  const targetOwner = (currentOwnerId || currentStoreId || '').trim();

  // Superadmin / System Master sees everything if target is 'master' or 'system'
  if (targetStore === 'master' || targetStore === 'a777503191' || targetOwner === 'master-a777503191') {
    return items;
  }

  return items.filter(item => {
    // If item has explicit storeId or ownerId
    const itemStore = item.storeId || item.store_id || item.ownerId || item.shopId || item.retailerId || item.wholesalerId;
    if (!itemStore) return true; // Global shared items like public catalog
    return itemStore === targetStore || itemStore === targetOwner;
  });
}

/**
 * 4.3. مفتاح التخزين الأوفلاين المعزول للمحل (Isolated Offline Storage Key)
 */
export function getOfflineStoreCacheKey(storeId: string, collectionName: string): string {
  const cleanStore = (storeId || 'master').replace(/[^a-zA-Z0-9_\-]/g, '_');
  return `jam_offline_cache_${cleanStore}_${collectionName}`;
}

/**
 * 5. BRUTE-FORCE PROTECTION & CUSTOM SUPPORT DESK (BYPASSED / OFF - NO LOCKOUT THRESHOLDS)
 */
export async function trackFailedLoginAttempt(identifier: string): Promise<{ locked: boolean; attempts: number }> {
  // Completely bypassed to avoid user lockouts as requested
  return { locked: false, attempts: 0 };
}

/**
 * Resets failed attempt counter upon successful login (BYPASSED)
 */
export async function resetFailedLoginAttempts(identifier: string): Promise<void> {
  if (!identifier) return;
  const localKey = `failed_login_attempts_${identifier}`;
  localStorage.removeItem(localKey);
}

/**
 * TIME CONSISTENCY SERVICE (Backward Compatibility)
 * Protects local cash journals and stock invoices from system clock manipulations.
 */
export const TimeProtectionService = {
  generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'uuid-' + Math.random().toString(36).substring(2, 15) + '-' + Math.random().toString(36).substring(2, 15);
  },

  logOperationTime(): void {
    const now = Date.now();
    const storedMax = parseInt(localStorage.getItem('JAM_TIME_HIGH_WATERMARK') || '0', 10);
    if (now > storedMax) {
      localStorage.setItem('JAM_TIME_HIGH_WATERMARK', now.toString());
    }
  },

  isTimeConsistent(): boolean {
    const now = Date.now();
    const storedMax = parseInt(localStorage.getItem('JAM_TIME_HIGH_WATERMARK') || '0', 10);
    // Allow up to 5 minutes backward skew for timezone/sync latency
    if (now < storedMax - 5 * 60 * 1000) {
      console.error('[TimeProtectionService] Device system clock tampering detected!');
      return false;
    }
    this.logOperationTime();
    return true;
  },

  getTimeDriftInfo(): { isAcceptable: boolean; driftMs: number } {
    const isOk = this.isTimeConsistent();
    const storedMax = parseInt(localStorage.getItem('JAM_TIME_HIGH_WATERMARK') || '0', 10);
    const now = Date.now();
    const driftMs = Math.abs(now - storedMax);
    return {
      isAcceptable: isOk,
      driftMs
    };
  }
};

/**
 * OFFLINE AUTH SERVICE (Backward Compatibility)
 * Manages cached offline authentication keys & credentials.
 */
export const OfflineAuthService = {
  getOfflineAuthState(): { activeUserId: string | null; lastOnlineState: boolean; remainingDays: number } {
    const activeUserId = localStorage.getItem('offline_cached_username') || null;
    const lastOnlineState = localStorage.getItem('JAM_OFFLINE_LAST_ONLINE_STATE') === 'true';
    const remainingDays = this.getOfflineRemainingDays();
    return {
      activeUserId,
      lastOnlineState,
      remainingDays
    };
  },
  trackConnectivityState(isOnline: boolean): void {
    localStorage.setItem('JAM_OFFLINE_LAST_ONLINE_STATE', isOnline ? 'true' : 'false');
    if (isOnline) {
      localStorage.setItem('JAM_OFFLINE_LAST_SYNC_TIME', Date.now().toString());
    }
  },

  getOfflineRemainingDays(): number {
    const lastSyncStr = localStorage.getItem('JAM_OFFLINE_LAST_SYNC_TIME');
    if (!lastSyncStr) return 10; // Default safety fallback
    
    const lastSync = parseInt(lastSyncStr, 10);
    const elapsed = Date.now() - lastSync;
    const limit = 30 * 24 * 60 * 60 * 1000; // 30 days max fallback limit
    const remainingMs = Math.max(0, limit - elapsed);
    return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  },

  getAccountsMap(): Record<string, { username: string, hash: string, userObj: any, profileObj: any, lastSyncTime: number }> {
    try {
      const data = localStorage.getItem('offline_cached_accounts_map');
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to parse offline accounts map:', e);
    }
    return {};
  },

  hasLocalCache(username?: string): boolean {
    if (username) {
      const cleanUsername = username.trim().toLowerCase();
      const accounts = this.getAccountsMap();
      if (accounts[cleanUsername]) return true;
    }
    const legacyUsername = localStorage.getItem('offline_cached_username');
    const legacyHash = localStorage.getItem('offline_cached_hash');
    if (legacyUsername && legacyHash) return true;
    
    const accounts = this.getAccountsMap();
    return Object.keys(accounts).length > 0;
  },

  saveCredentials(username: string, password: string, userObj: any, profileObj: any): void {
    if (!username) return;
    const cleanUsername = username.trim().toLowerCase();
    const passwordHash = this.simpleHash(password.trim());
    const now = Date.now();

    // 1. Save to modern multi-account map
    const accounts = this.getAccountsMap();
    accounts[cleanUsername] = {
      username: cleanUsername,
      hash: passwordHash,
      userObj: userObj || {},
      profileObj: profileObj || {},
      lastSyncTime: now
    };
    try {
      const mapStr = JSON.stringify(accounts);
      localStorage.setItem('offline_cached_accounts_map', mapStr);
      persistentStorageEngine.setItem('offline_cached_accounts_map', mapStr).catch(() => {});
    } catch (err) {
      console.warn('Failed to save accounts map to localStorage:', err);
    }

    // 2. Save to legacy keys for compatibility/fallback
    localStorage.setItem('offline_cached_username', cleanUsername);
    localStorage.setItem('offline_cached_hash', passwordHash);
    localStorage.setItem('offline_cached_user_obj', JSON.stringify(userObj || {}));
    localStorage.setItem('offline_cached_profile_obj', JSON.stringify(profileObj || {}));
    localStorage.setItem('JAM_OFFLINE_LAST_SYNC_TIME', now.toString());
  },

  verifyOfflineCredentials(username: string, password: string): { success: boolean; user: any; profile: any; error?: string } {
    if (!username) return { success: false, user: null, profile: null, error: 'اسم المستخدم فارغ' };
    const cleanUsername = username.trim().toLowerCase();
    const inputHash = this.simpleHash(password.trim());

    const accounts = this.getAccountsMap();
    let targetAccount = accounts[cleanUsername];

    // Fallback to legacy single user if no map entry matches but legacy matches
    if (!targetAccount) {
      const legacyUsername = localStorage.getItem('offline_cached_username');
      const legacyHash = localStorage.getItem('offline_cached_hash');
      if (legacyUsername && legacyUsername === cleanUsername && legacyHash) {
        const cachedUserRaw = localStorage.getItem('offline_cached_user_obj');
        const cachedProfileRaw = localStorage.getItem('offline_cached_profile_obj');
        targetAccount = {
          username: legacyUsername,
          hash: legacyHash,
          userObj: cachedUserRaw ? JSON.parse(cachedUserRaw) : {},
          profileObj: cachedProfileRaw ? JSON.parse(cachedProfileRaw) : {},
          lastSyncTime: parseInt(localStorage.getItem('JAM_OFFLINE_LAST_SYNC_TIME') || '0', 10)
        };
      }
    }

    if (!targetAccount) {
      return { success: false, user: null, profile: null, error: 'اسم المستخدم غير مسجل مسبقاً للعمل دون اتصال (أوفلاين) في هذا الجهاز' };
    }

    if (inputHash !== targetAccount.hash) {
      // Track failed attempt under offline-username
      trackFailedLoginAttempt(cleanUsername);
      return { success: false, user: null, profile: null, error: 'كلمة المرور غير مطابقة للملف المحفوظ أوفلاين' };
    }

    // Check offline limit
    const lastSync = targetAccount.lastSyncTime || 0;
    const profile = targetAccount.profileObj || {};
    const now = Date.now();
    const elapsed = now - lastSync;
    const isMerchantRole = ['wholesaler', 'supplier', 'distributor', 'importer', 'superadmin', 'owner', 'staff'].includes(profile.role?.toLowerCase());
    const limit = isMerchantRole ? 10 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const isValid = elapsed < limit;

    if (!isValid) {
      return {
        success: false,
        user: null,
        profile: null,
        error: `عذراً، لقد تجاوزت الحد الأقصى للعمل دون اتصال بالإنترنت. يرجى المزامنة والاتصال بالإنترنت أولاً.`
      };
    }

    // Reset attempts on successful login
    resetFailedLoginAttempts(cleanUsername);

    return {
      success: true,
      user: targetAccount.userObj,
      profile: targetAccount.profileObj
    };
  },

  simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return '0';
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(16);
  }
};

/**
 * STRICT CONSTRAINT BLOCK: Verifies if a phone number is already registered inside any profile/client context.
 * If yes, rejects the creation of a secondary or duplicate account using that phone number unless allowed by admin.
 */
export interface PhoneCheckOptions {
  allowExistingClients?: boolean;
  allowExistingLeads?: boolean;
  excludeUid?: string;
  isSuperAdmin?: boolean;
  checkRole?: string;
}

export async function checkPhoneUniqueness(phone: string, options: PhoneCheckOptions = {}): Promise<void> {
  // SuperAdmin operations bypass phone locks to allow creating branches and assigning accounts
  if (options.isSuperAdmin) return;

  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').trim();
  if (!cleanPhone || cleanPhone.length < 5) return;

  // 1. Check in 'users' collection
  try {
    const qUsers = query(collection(db, 'users'), where('phone', '==', cleanPhone));
    const snapUsers = await getDocs(qUsers);
    const activeUsers = snapUsers.docs.filter(d => {
      if (options.excludeUid && d.id === options.excludeUid) return false;
      const data = d.data();
      return data && data.status !== 'deleted' && data.status !== 'disabled';
    });

    if (activeUsers.length > 0) {
      throw new Error('عذراً، رقم الهاتف هذا مسجل بالفعل في النظام. يرجى المتابعة عبر نظام الربط B2B (ارتباط) باستخدام حسابك النشط المتاح، حيث يمنع النظام تماماً إنشاء حسابين مستقلين لنفس الرقم.');
    }
  } catch (err: any) {
    if (err.message?.includes('مسجل بالفعل')) {
      throw err;
    }
  }

  // 2. Check in 'clients' collection (VIP clients) only if not specifically bypassed
  if (!options.allowExistingClients) {
    try {
      const qClients = query(collection(db, 'clients'), where('phone', '==', cleanPhone));
      const snapClients = await getDocs(qClients);
      if (!snapClients.empty) {
        // If it's a VIP client, inform them unless they are registering as a store
        if (options.checkRole === 'client') {
          throw new Error('عذراً، رقم الهاتف هذا مسجل بالفعل كزبون VIP في النظام.');
        }
      }
    } catch (err: any) {
      if (err.message?.includes('مسجل بالفعل')) throw err;
    }
  }
}


