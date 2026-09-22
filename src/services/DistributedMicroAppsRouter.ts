import { ProjectTier, PROJECT_TIER_CONFIGS, FirebaseProjectRouter } from './FirebaseProjectRouter';

export interface MicroAppConfig {
  appId: string;
  tier: ProjectTier;
  projectId: string;
  nameAr: string;
  nameEn: string;
  badge: string;
  primaryColor: string;
  targetUserRoles: string[];
  defaultRoute: string;
  allowedRoutes: string[];
  features: string[];
}

export const DISTRIBUTED_MICRO_APPS: Record<string, MicroAppConfig> = {
  // 1. B2C Customer Portal App
  customer_portal: {
    appId: 'JAM_MICRO_APP_CUSTOMER',
    tier: 'customer',
    projectId: 'joad772315106',
    nameAr: 'تطبيق الزبائن العامة وتسوق المحلات',
    nameEn: 'B2C Customer & Client Portal',
    badge: 'B2C Client',
    primaryColor: '#059669', // Emerald
    targetUserRoles: ['customer', 'RETAIL_CUSTOMER', 'Client', 'guest'],
    defaultRoute: '/portal',
    allowedRoutes: ['/portal', '/client-login', '/chat', '/market'],
    features: ['Shopping Basket', 'Debt Statement', 'Direct Merchant Chat', 'Market Offers']
  },

  // 2. Retail POS & Shop Management App
  retail_pos: {
    appId: 'JAM_MICRO_APP_RETAIL',
    tier: 'retailer',
    projectId: 'joad7723151',
    nameAr: 'تطبيق نقطة بيع التجزئة والمحل والموظفين',
    nameEn: 'Retail POS & Store Operations',
    badge: 'Retail POS',
    primaryColor: '#2563EB', // Blue
    targetUserRoles: ['retailer', 'shop_owner', 'cashier', 'technician'],
    defaultRoute: '/',
    allowedRoutes: ['/', '/sales', '/inventory', '/customers', '/maintenance', '/chat', '/market'],
    features: ['Retail Sales', 'Barcode Cashier', 'Customer Ledgers', 'Maintenance Workshop']
  },

  // 3. Wholesaler POS & Merchant App
  wholesaler_app: {
    appId: 'JAM_MICRO_APP_WHOLESALE',
    tier: 'wholesaler',
    projectId: 'joad772315',
    nameAr: 'تطبيق تجار الجملة والمبيعات وتصفية الحسابات',
    nameEn: 'Wholesale Merchant & Sales Suite',
    badge: 'Wholesale POS',
    primaryColor: '#D97706', // Amber
    targetUserRoles: ['wholesaler', 'jumla', 'wholesale_salesman'],
    defaultRoute: '/',
    allowedRoutes: ['/', '/wholesale-pos', '/sales', '/inventory', '/suppliers', '/customers', '/accounting'],
    features: ['Wholesale POS', 'Quantity Tiers', 'B2B Sales', 'Debt Ledger']
  },

  // 4. Master Wholesale & Distributors App
  master_wholesale: {
    appId: 'JAM_MICRO_APP_MASTER_WHOLESALE',
    tier: 'wholesale_master',
    projectId: 'joad77231',
    nameAr: 'تطبيق جملة الجملة والموزعين الميدانيين',
    nameEn: 'Master Wholesale & Distributor Suite',
    badge: 'Master Wholesale',
    primaryColor: '#7C3AED', // Purple
    targetUserRoles: ['wholesale_master', 'jumlajumla', 'distributor'],
    defaultRoute: '/',
    allowedRoutes: ['/', '/distributor', '/wholesale-pos', '/inventory', '/smart-import', '/operations'],
    features: ['Distributor Fleet', 'Master Quantities', 'Stock Distribution', 'B2B Settlement']
  },

  // 5. Importer Agency & SuperAdmin Control App
  importer_agency: {
    appId: 'JAM_MICRO_APP_IMPORTER',
    tier: 'importer',
    projectId: 'joad7723',
    nameAr: 'تطبيق المستوردين والتوكيلات والتحكم الأقصى',
    nameEn: 'Importer Agency & Master System Control',
    badge: 'Importer Agency',
    primaryColor: '#DC2626', // Red
    targetUserRoles: ['importer', 'main_importer', 'super_admin', 'master_owner', 'developer'],
    defaultRoute: '/',
    allowedRoutes: ['*', '/', '/smart-import', '/super-admin', '/inventory', '/operations', '/market'],
    features: ['Shipment Tracking', 'International Currency Reconcile', 'Global B2B Market', 'Master System Seal']
  }
};

export class DistributedMicroAppsRouterEngine {
  /**
   * Identifies appropriate micro app for user based on profile role or tier
   */
  public resolveAppForUser(profile: any): MicroAppConfig {
    if (!profile) return DISTRIBUTED_MICRO_APPS.customer_portal;

    const role = (profile.role || '').toLowerCase();
    const tier = profile.businessTier || FirebaseProjectRouter.resolveTier(role, profile);

    // Super Admin / Developer -> Full Importer Agency access
    if (role === 'super_admin' || role === 'developer' || role === 'master_owner') {
      return DISTRIBUTED_MICRO_APPS.importer_agency;
    }

    switch (tier) {
      case 'customer':
        return DISTRIBUTED_MICRO_APPS.customer_portal;
      case 'retailer':
        return DISTRIBUTED_MICRO_APPS.retail_pos;
      case 'wholesaler':
        return DISTRIBUTED_MICRO_APPS.wholesaler_app;
      case 'wholesale_master':
        return DISTRIBUTED_MICRO_APPS.master_wholesale;
      case 'importer':
      default:
        return DISTRIBUTED_MICRO_APPS.importer_agency;
    }
  }

  private projectIdCache = new Map<string, MicroAppConfig>();
  private shieldCache = new Map<string, { nameAr: string; badge: string; color: string }>();

  /**
   * Resolves target MicroApp by explicit App ID or project ID (0ms cached)
   */
  public getAppByProjectId(projectId: string): MicroAppConfig {
    if (this.projectIdCache.has(projectId)) {
      return this.projectIdCache.get(projectId)!;
    }
    const entry = Object.values(DISTRIBUTED_MICRO_APPS).find(a => a.projectId === projectId) || DISTRIBUTED_MICRO_APPS.importer_agency;
    this.projectIdCache.set(projectId, entry);
    return entry;
  }

  /**
   * ⚡ 0ms Cached lookup for Shield name, badge & color by commercial tier
   */
  public getShieldInfoByTier(tier: string): { nameAr: string; badge: string; color: string } {
    if (this.shieldCache.has(tier)) {
      return this.shieldCache.get(tier)!;
    }

    let config: MicroAppConfig = DISTRIBUTED_MICRO_APPS.retail_pos;
    if (tier === 'importer') config = DISTRIBUTED_MICRO_APPS.importer_agency;
    else if (tier === 'mega_wholesale' || tier === 'wholesale_master') config = DISTRIBUTED_MICRO_APPS.master_wholesale;
    else if (tier === 'wholesale' || tier === 'wholesaler') config = DISTRIBUTED_MICRO_APPS.wholesaler_app;
    else if (tier === 'customer') config = DISTRIBUTED_MICRO_APPS.customer_portal;

    const info = {
      nameAr: config.nameAr,
      badge: config.badge,
      color: config.primaryColor
    };
    this.shieldCache.set(tier, info);
    return info;
  }

  /**
   * Fast 0ms switcher saving target active app context to session & localStorage
   */
  public setActiveMicroApp(appKey: string): void {
    if (DISTRIBUTED_MICRO_APPS[appKey]) {
      const config = DISTRIBUTED_MICRO_APPS[appKey];
      sessionStorage.setItem('jam_active_micro_app', JSON.stringify(config));
      localStorage.setItem('jam_active_micro_app_id', config.appId);
    }
  }

  /**
   * Retrieves active cached micro-app configuration or null
   */
  public getActiveMicroApp(): MicroAppConfig | null {
    try {
      const cached = sessionStorage.getItem('jam_active_micro_app');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return null;
  }
}

export const DistributedMicroAppsRouter = new DistributedMicroAppsRouterEngine();
