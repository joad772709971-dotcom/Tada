export interface LinkedStoreProfile {
  id: string;
  storeId: string;
  shopName: string;
  logoUrl?: string;
  phone?: string;
  address?: string;
  ownerId?: string;
  primaryColor?: string;
  currency?: string;
  debtBalance?: number;
  linkedAt: string;
}

export class CustomerStoreLinkRouterEngine {
  private STORAGE_KEY_STORE_ID = 'current_shop_id';
  private STORAGE_KEY_STORE_PROFILE = 'jam_linked_store_info';
  private STORAGE_KEY_CUSTOMER_STORES = 'jam_customer_linked_stores_list';

  constructor() {
    if (typeof window !== 'undefined') {
      this.initStoreLinkFromURL();
    }
  }

  /**
   * Automatically parses URL query strings & hash params for store links (e.g. ?shop=al_mashraqi or ?storeId=xyz)
   * Saves detected link into localStorage & sessionStorage immediately (0ms routing)
   */
  public initStoreLinkFromURL(): string | null {
    if (typeof window === 'undefined') return null;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const hashString = window.location.hash.includes('?') 
        ? window.location.hash.substring(window.location.hash.indexOf('?')) 
        : '';
      const hashParams = new URLSearchParams(hashString);

      const storeIdParam = urlParams.get('store') || 
                           urlParams.get('shop') || 
                           urlParams.get('storeId') || 
                           urlParams.get('merchant') || 
                           urlParams.get('s') ||
                           hashParams.get('store') || 
                           hashParams.get('shop') || 
                           hashParams.get('storeId') ||
                           hashParams.get('merchant');

      if (storeIdParam) {
        const cleanStoreId = storeIdParam.trim();
        this.saveStoreLink(cleanStoreId);
        return cleanStoreId;
      }
    } catch (err) {
      console.warn('⚠️ [CustomerStoreLinkRouter] URL parse warning:', err);
    }

    return this.getLinkedStoreId();
  }

  /**
   * Saves linked store ID and initializes fast-track customer routing context
   */
  public saveStoreLink(storeId: string, storeName?: string, logoUrl?: string): void {
    if (!storeId) return;

    try {
      localStorage.setItem(this.STORAGE_KEY_STORE_ID, storeId);
      localStorage.setItem('jam_linked_store_id', storeId);
      sessionStorage.setItem('current_shop_id', storeId);

      if (storeName) {
        localStorage.setItem('jam_last_logged_in_shop_name', storeName);
      }

      const existingProfile = this.getLinkedStoreProfile();
      const updatedProfile: LinkedStoreProfile = {
        id: storeId,
        storeId: storeId,
        shopName: storeName || existingProfile?.shopName || `متجر (${storeId})`,
        logoUrl: logoUrl || existingProfile?.logoUrl || '',
        phone: existingProfile?.phone || '',
        address: existingProfile?.address || '',
        ownerId: existingProfile?.ownerId || storeId,
        linkedAt: new Date().toISOString()
      };

      localStorage.setItem(this.STORAGE_KEY_STORE_PROFILE, JSON.stringify(updatedProfile));
      sessionStorage.setItem(this.STORAGE_KEY_STORE_PROFILE, JSON.stringify(updatedProfile));

      // Append to list of stores linked to this customer
      this.appendCustomerStoreOption(updatedProfile);
    } catch (e) {
      console.warn('⚠️ Failed to save store link:', e);
    }
  }

  /**
   * Returns current linked store ID or fallback
   */
  public getLinkedStoreId(): string {
    if (typeof window === 'undefined') return 'main_store';
    return localStorage.getItem(this.STORAGE_KEY_STORE_ID) || 
           localStorage.getItem('jam_linked_store_id') || 
           sessionStorage.getItem('current_shop_id') || 
           'main_store';
  }

  /**
   * Returns active linked store profile metadata (0ms speed)
   */
  public getLinkedStoreProfile(): LinkedStoreProfile | null {
    if (typeof window === 'undefined') return null;
    try {
      const cached = sessionStorage.getItem(this.STORAGE_KEY_STORE_PROFILE) || 
                     localStorage.getItem(this.STORAGE_KEY_STORE_PROFILE);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}
    
    const storeId = this.getLinkedStoreId();
    if (storeId) {
      return {
        id: storeId,
        storeId: storeId,
        shopName: localStorage.getItem('jam_last_logged_in_shop_name') || `المتجر المرتبط (${storeId})`,
        linkedAt: new Date().toISOString()
      };
    }
    return null;
  }

  /**
   * Fast Customer Portal Route Guard
   * Directs user immediately to portal with store context
   */
  public getFastCustomerRoutePath(storeId?: string): string {
    const activeStoreId = storeId || this.getLinkedStoreId();
    return `/portal?shop=${encodeURIComponent(activeStoreId)}`;
  }

  /**
   * Stores list of linked stores for customer store-switching menu
   */
  private appendCustomerStoreOption(profile: LinkedStoreProfile): void {
    try {
      const existingStr = localStorage.getItem(this.STORAGE_KEY_CUSTOMER_STORES);
      let list: LinkedStoreProfile[] = existingStr ? JSON.parse(existingStr) : [];
      
      const index = list.findIndex(s => s.storeId === profile.storeId);
      if (index >= 0) {
        list[index] = { ...list[index], ...profile };
      } else {
        list.push(profile);
      }
      localStorage.setItem(this.STORAGE_KEY_CUSTOMER_STORES, JSON.stringify(list));
    } catch (e) {}
  }

  /**
   * Retrieves list of all stores linked to this customer account
   */
  public getCustomerLinkedStores(): LinkedStoreProfile[] {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem(this.STORAGE_KEY_CUSTOMER_STORES);
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    
    const active = this.getLinkedStoreProfile();
    return active ? [active] : [];
  }
}

export const CustomerStoreLinkRouter = new CustomerStoreLinkRouterEngine();
