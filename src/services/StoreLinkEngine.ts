import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  serverTimestamp, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../firebase';

export type StoreLinkStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
export type PaymentMethodType = 'CASH' | 'DEBT' | 'JAM_PAY';

export interface StoreLinkPermissions {
  allowDebt: boolean;
  creditLimit: number;
  allowedPaymentMethods: PaymentMethodType[];
  viewCatalog: boolean;
}

export interface StoreLinkContract {
  linkId: string; // link_{sourceStoreId}_{targetId}
  sourceStore: string;
  targetEntity: string;
  status: StoreLinkStatus;
  validUntil: string; // ISO_TIMESTAMP
  createdAt: string;
  updatedAt?: string;
  permissions: StoreLinkPermissions;
  metadata?: Record<string, any>;
}

export type StoreTierType = 'IMPORT' | 'WHOLESALE_2' | 'WHOLESALE_1' | 'RETAIL' | 'CUSTOMER';

/**
 * Helper to build deterministic Store ID according to tier architecture:
 * store-1-X (مستورد IMPORT)
 * store-2-X (جملة الجملة WHOLESALE_2)
 * store-3-X (جملة WHOLESALE_1)
 * store-4-X (تجزئة RETAIL)
 */
export function formatStoreId(tier: StoreTierType | string, identifier: string): string {
  const cleanId = (identifier || 'default').replace(/^store-[1-4]-/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const upperTier = (tier || '').toUpperCase();

  if (upperTier === 'IMPORT' || upperTier === 'IMPORTER' || upperTier === '1' || upperTier === 'مستورد') {
    return `store-1-${cleanId}`;
  }
  if (upperTier === 'WHOLESALE_2' || upperTier === 'WHOLESALE_MASTER' || upperTier === '2' || upperTier === 'جملة الجملة') {
    return `store-2-${cleanId}`;
  }
  if (upperTier === 'WHOLESALE_1' || upperTier === 'WHOLESALE' || upperTier === '3' || upperTier === 'جملة') {
    return `store-3-${cleanId}`;
  }
  return `store-4-${cleanId}`; // Default RETAIL
}

export function parseStoreTier(storeId: string): StoreTierType {
  if (storeId.startsWith('store-1-')) return 'IMPORT';
  if (storeId.startsWith('store-2-')) return 'WHOLESALE_2';
  if (storeId.startsWith('store-3-')) return 'WHOLESALE_1';
  if (storeId.startsWith('store-4-')) return 'RETAIL';
  return 'RETAIL';
}

export class StoreLinkEngineClass {
  private activeLinksCache = new Map<string, StoreLinkContract>();
  private listeners = new Map<string, () => void>();

  /**
   * Generates standard link ID: link_{sourceStoreId}_{targetId}
   */
  public generateLinkId(sourceStore: string, targetEntity: string): string {
    const cleanSource = sourceStore.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanTarget = targetEntity.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `link_${cleanSource}_${cleanTarget}`;
  }

  /**
   * Creates or updates a store link contract
   */
  public async createOrUpdateContract(
    sourceStore: string,
    targetEntity: string,
    validDays: number = 365,
    permissions: Partial<StoreLinkPermissions> = {},
    metadata?: Record<string, any>
  ): Promise<StoreLinkContract> {
    const linkId = this.generateLinkId(sourceStore, targetEntity);
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + validDays);

    const defaultPermissions: StoreLinkPermissions = {
      allowDebt: true,
      creditLimit: 1000000,
      allowedPaymentMethods: ['CASH', 'DEBT', 'JAM_PAY'],
      viewCatalog: true,
      ...permissions
    };

    const contract: StoreLinkContract = {
      linkId,
      sourceStore,
      targetEntity,
      status: 'ACTIVE',
      validUntil: validUntilDate.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      permissions: defaultPermissions,
      metadata: metadata || {}
    };

    const docRef = doc(db, 'store_links', linkId);
    await setDoc(docRef, {
      ...contract,
      updatedAt: serverTimestamp()
    }, { merge: true });

    this.activeLinksCache.set(linkId, contract);
    return contract;
  }

  /**
   * Retrieves a contract directly, validating active status and expiration time
   */
  public async getContract(sourceStore: string, targetEntity: string): Promise<StoreLinkContract | null> {
    const linkId = this.generateLinkId(sourceStore, targetEntity);
    
    // Check in-memory cache first
    const cached = this.activeLinksCache.get(linkId);
    if (cached) {
      if (this.isContractValid(cached)) {
        return cached;
      }
    }

    try {
      const docRef = doc(db, 'store_links', linkId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as StoreLinkContract;
        this.activeLinksCache.set(linkId, data);
        return data;
      }
    } catch (err) {
      console.warn(`[StoreLinkEngine] Failed to fetch contract ${linkId}:`, err);
    }

    return null;
  }

  /**
   * Validates whether a contract is strictly ACTIVE and NOT expired
   */
  public isContractValid(contract: StoreLinkContract | null | undefined): boolean {
    if (!contract) return false;
    if (contract.status !== 'ACTIVE') return false;

    const expiryTime = new Date(contract.validUntil).getTime();
    if (isNaN(expiryTime) || expiryTime <= Date.now()) {
      return false; // Contract has expired
    }

    return true;
  }

  /**
   * Check if debt operations are allowed under this contract
   */
  public canIssueDebt(contract: StoreLinkContract | null, requestedAmount: number = 0, currentBalance: number = 0): {
    allowed: boolean;
    reason?: string;
  } {
    if (!contract || !this.isContractValid(contract)) {
      return { allowed: false, reason: 'عقد الارتباط غير مفعل أو منتهي الصلاحية.' };
    }

    if (!contract.permissions.allowDebt) {
      return { allowed: false, reason: 'البيع بالآجل (المديونية) غير مصرح به بموجب عقد الارتباط.' };
    }

    if (contract.permissions.creditLimit > 0) {
      if ((currentBalance + requestedAmount) > contract.permissions.creditLimit) {
        return { 
          allowed: false, 
          reason: `تجاوز سقف الائتمان المحدد بالعقد (${contract.permissions.creditLimit.toLocaleString()} ر.ي).` 
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Terminates or suspends a contract safely without deleting any financial records or archive
   */
  public async setContractStatus(linkId: string, status: StoreLinkStatus): Promise<void> {
    const docRef = doc(db, 'store_links', linkId);
    await setDoc(docRef, {
      status,
      updatedAt: serverTimestamp()
    }, { merge: true });

    const cached = this.activeLinksCache.get(linkId);
    if (cached) {
      cached.status = status;
      this.activeLinksCache.set(linkId, cached);
    }
  }

  /**
   * Listens to active links for a given store
   */
  public subscribeToStoreLinks(storeId: string, callback: (links: StoreLinkContract[]) => void): () => void {
    const q = query(collection(db, 'store_links'), where('sourceStore', '==', storeId));
    const unsubscribe = onSnapshot(q, (snap) => {
      const links: StoreLinkContract[] = [];
      snap.forEach(d => {
        const item = d.data() as StoreLinkContract;
        this.activeLinksCache.set(item.linkId, item);
        links.push(item);
      });
      callback(links);
    }, (err) => {
      console.warn('[StoreLinkEngine] Subscription notice:', err);
    });

    return unsubscribe;
  }
}

export const storeLinkEngine = new StoreLinkEngineClass();
