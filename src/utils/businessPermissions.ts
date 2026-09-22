export interface UserProfileInfo {
  businessType?: string;
  businessLevel?: string;
  role?: string;
  rank?: string;
  hierarchyLevel?: number;
  businessTier?: string;
  tier?: string;
  userTier?: string;
  email?: string;
  enabledModules?: string[];
  hiddenPages?: string[];
  disabledModules?: string[];
  [key: string]: any;
}

/**
 * Checks if user is Master Project Owner or SuperAdmin
 */
export const isProjectMasterOwner = (profile?: UserProfileInfo | null): boolean => {
  if (!profile) return false;
  const email = (profile.email || '').toLowerCase().trim();
  const phone = ((profile as any).phone || '').replace(/[\s\-\(\)]/g, '');
  const uid = ((profile as any).uid || '').trim();
  const role = (profile.role || profile.rank || '').toLowerCase().trim();
  const masterEmails = ['a777503191@gmail.com', 'system@jam-pro.net', 'joad7723@gmail.com'];
  return (
    masterEmails.includes(email) ||
    email.includes('a777503191') ||
    phone === '777503191' ||
    uid === 'master-a777503191' ||
    role === 'superadmin' ||
    role === 'developer' ||
    role === 'master_developer'
  );
};

/**
 * Checks if user belongs to Wholesale, Grand Wholesale, or Importer groups.
 * (تجار الجملة، جملة الجملة، والمستوردين)
 */
export const isWholesaleUserGroup = (profile?: UserProfileInfo | null): boolean => {
  if (!profile) return false;
  const bType = (profile.businessType || profile.businessLevel || profile.businessTier || profile.tier || profile.userTier || '').toLowerCase();
  const roleLower = (profile.role || profile.rank || '').toLowerCase();
  const hLevel = profile.hierarchyLevel;

  const wholesaleKeywords = [
    'wholesale',
    'wholesaler',
    'grand_wholesale',
    'master_wholesale',
    'mega_wholesale',
    'importer',
    'supplier',
    'distributor',
    'wholesale_and_retail',
    'wholesale_master'
  ];

  const arabicKeywords = ['جملة', 'جملة الجملة', 'مستورد', 'مورد', 'موزع', 'تاجر جملة'];

  const matchesEn = wholesaleKeywords.some(k => bType.includes(k) || roleLower.includes(k));
  const matchesAr = arabicKeywords.some(k => bType.includes(k) || roleLower.includes(k));

  return (
    matchesEn ||
    matchesAr ||
    (typeof hLevel === 'number' && hLevel >= 1 && hLevel <= 3)
  );
};

/**
 * Checks if user belongs to Retail Merchant group.
 * (تجار التجزئة)
 */
export const isRetailUserGroup = (profile?: UserProfileInfo | null): boolean => {
  if (!profile) return true;
  return !isWholesaleUserGroup(profile);
};

/**
 * Note: Role/Rank-based automatic hiding is permanently DISABLED.
 * All merchant pages are visible to all merchants regardless of rank/tier.
 * Only owner/developer control pages are restricted to the project master owner.
 * Explicit hiding is only applied if the Master Admin customizes a store's hiddenPages.
 */
export const isModuleAutoHidden = (modId: string, profile?: UserProfileInfo | null): boolean => {
  if (!profile) return false;
  // الحساب المشرف العام والمالك يتخطى كافة قيود الإخفاء تماماً
  if (isProjectMasterOwner(profile)) return false;

  const cleanId = (modId || '').toLowerCase().replace('/', '').trim();

  // 1. Strict protection for Master Project Owner pages:
  const masterOnlyPages = ['superadmin', 'super-admin', 'system_logs', 'blueprint_control', 'search_purge'];
  if (masterOnlyPages.includes(cleanId)) {
    return !isProjectMasterOwner(profile);
  }

  // 2. Check explicit custom hidden pages set by Master Developer in SuperAdmin
  const explicitHidden = profile.hiddenPages || profile.disabledModules || [];
  if (Array.isArray(explicitHidden) && explicitHidden.includes(cleanId)) {
    return true;
  }

  // Rank-based auto-hiding is turned OFF: all business pages are available to all merchants!
  return false;
};

/**
 * Get all auto-hidden module IDs for a given user profile
 */
export const getAutoHiddenModules = (profile?: UserProfileInfo | null): string[] => {
  if (!profile) return [];
  const hidden: string[] = [];
  if (!isProjectMasterOwner(profile)) {
    hidden.push('superadmin', 'super-admin', 'system_logs', 'blueprint_control');
  }
  if (Array.isArray(profile.hiddenPages)) {
    hidden.push(...profile.hiddenPages);
  }
  return Array.from(new Set(hidden));
};

