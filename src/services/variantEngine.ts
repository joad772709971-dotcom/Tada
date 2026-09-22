import { UserProfile, UserRole } from '../types';

export type AppVariantType = 
  | 'JAM_STORE'    // APK 1: تطبيق التجار والمتاجر (Jam store) - Package: com.jam.store
  | 'JAM_MAIN'     // Alias for JAM_STORE
  | 'JAM_CUSTOMER_VIP' // APK 2: تطبيق الزبائن والمواطنين (Store pro) - Package: com.jam.storepro
  | 'JAM_PORTAL'   // Alias for JAM_CUSTOMER_VIP
  | 'JAM_CUSTOMER' // Alias for JAM_CUSTOMER_VIP
  | 'JAM_DESKTOP'  // EXE: تطبيق الكمبيوتر المباشر لسطح المكتب (Jam store)
  | 'JAM_RETAIL'   // Alias
  | 'JAM_WHOLESALE'// Alias
  | 'JAM_MASTER'   // Alias
  | 'JAM_IMPORTER' // Alias
  | 'ALL';         // النسخة الشاملة للتطوير والتحكم الشامل

export interface AppVariantInfo {
  code: AppVariantType;
  key: string;
  titleAr: string;
  appName: string;
  subtitleAr: string;
  category: 'CUSTOMER' | 'MERCHANT' | 'DESKTOP' | 'MASTER_OWNER';
  editionNumber: string;
  iconName: string;
  packageId: string;
  badgeColor: string;
  accentGradient: string;
  allowedRoles: string[];
  descriptionAr: string;
}

export const APP_VARIANTS: Record<AppVariantType, AppVariantInfo> = {
  JAM_STORE: {
    code: 'JAM_STORE',
    key: 'jam_store',
    appName: 'Jam store',
    titleAr: 'تطبيق التجار (Jam store)',
    subtitleAr: 'حزمة APK رقم (1) - النظام الموحد للتجار، الكاشير، المحلات، والمخازن',
    category: 'MERCHANT',
    editionNumber: 'تطبيق التجار (Jam store)',
    iconName: 'Store',
    packageId: 'com.jam.store',
    badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    accentGradient: 'from-sky-500 to-blue-600',
    allowedRoles: ['owner', 'superadmin', 'manager', 'cashier', 'sales', 'wholesaler', 'importer', 'engineer', 'staff', 'employee', 'retailer', 'packer', 'delivery_agent', 'admin'],
    descriptionAr: 'تطبيق الإدارة والبيع الكامل للتجار والمحلات والمخازن والكاشير.'
  },
  JAM_MAIN: {
    code: 'JAM_STORE',
    key: 'jam_main',
    appName: 'Jam store',
    titleAr: 'تطبيق التجار (Jam store)',
    subtitleAr: 'حزمة APK رقم (1) - النظام الموحد للتجار، الكاشير، المحلات، والمخازن',
    category: 'MERCHANT',
    editionNumber: 'تطبيق التجار (Jam store)',
    iconName: 'Store',
    packageId: 'com.jam.store',
    badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    accentGradient: 'from-sky-500 to-blue-600',
    allowedRoles: ['owner', 'superadmin', 'manager', 'cashier', 'sales', 'wholesaler', 'importer', 'engineer', 'staff', 'employee', 'retailer', 'packer', 'delivery_agent', 'admin'],
    descriptionAr: 'تطبيق الإدارة والبيع الكامل للتجار والمحلات والمخازن والكاشير.'
  },
  JAM_CUSTOMER_VIP: {
    code: 'JAM_CUSTOMER_VIP',
    key: 'store_pro',
    appName: 'Store pro',
    titleAr: 'تطبيق الزبائن (Store pro)',
    subtitleAr: 'حزمة APK رقم (2) - تطبيق المواطنين والزبائن المباشر',
    category: 'CUSTOMER',
    editionNumber: 'تطبيق الزبائن (Store pro)',
    iconName: 'ShoppingBag',
    packageId: 'com.jam.storepro',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    accentGradient: 'from-emerald-500 to-teal-600',
    allowedRoles: ['customer', 'retail_customer', 'customer/client', 'client', 'guest'],
    descriptionAr: 'التطبيق المخصص للمواطنين والزبائن لمتابعة المشتريات والديون والطلبات.'
  },
  JAM_PORTAL: {
    code: 'JAM_CUSTOMER_VIP',
    key: 'jam_portal',
    appName: 'Store pro',
    titleAr: 'تطبيق الزبائن (Store pro)',
    subtitleAr: 'حزمة APK رقم (2) - تطبيق المواطنين والزبائن المباشر',
    category: 'CUSTOMER',
    editionNumber: 'تطبيق الزبائن (Store pro)',
    iconName: 'ShoppingBag',
    packageId: 'com.jam.storepro',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    accentGradient: 'from-emerald-500 to-teal-600',
    allowedRoles: ['customer', 'retail_customer', 'customer/client', 'client', 'guest'],
    descriptionAr: 'التطبيق المخصص للمواطنين والزبائن لمتابعة المشتريات والديون والطلبات.'
  },
  JAM_CUSTOMER: {
    code: 'JAM_CUSTOMER_VIP',
    key: 'jam_customer',
    appName: 'Store pro',
    titleAr: 'تطبيق الزبائن (Store pro)',
    subtitleAr: 'حزمة APK رقم (2) - تطبيق المواطنين والزبائن المباشر',
    category: 'CUSTOMER',
    editionNumber: 'تطبيق الزبائن (Store pro)',
    iconName: 'ShoppingBag',
    packageId: 'com.jam.storepro',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    accentGradient: 'from-emerald-500 to-teal-600',
    allowedRoles: ['customer', 'retail_customer', 'customer/client', 'client', 'guest'],
    descriptionAr: 'التطبيق المخصص للمواطنين والزبائن لمتابعة المشتريات والديون والطلبات.'
  },
  JAM_DESKTOP: {
    code: 'JAM_DESKTOP',
    key: 'jam_desktop',
    appName: 'Jam store',
    titleAr: 'برنامج سطح المكتب (Jam store)',
    subtitleAr: 'حزمة EXE - تطبيق الويندوز المباشر لسطح المكتب وطابعات الفواتير',
    category: 'DESKTOP',
    editionNumber: 'EXE الويندوز',
    iconName: 'Monitor',
    packageId: 'com.jam.store.desktop',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    accentGradient: 'from-purple-500 to-indigo-600',
    allowedRoles: ['owner', 'superadmin', 'manager', 'cashier', 'sales', 'wholesaler', 'importer', 'engineer', 'staff', 'employee', 'retailer', 'packer', 'delivery_agent', 'admin'],
    descriptionAr: 'برنامج الويندوز المباشر لأجهزة الكاشير والمحلات وطباعة الفواتير بدون إنترنت.'
  },
  JAM_RETAIL: {
    code: 'JAM_STORE',
    key: 'jam_retail',
    appName: 'Jam store',
    titleAr: 'تطبيق التجار (Jam store)',
    subtitleAr: 'تطبيق تجزئة المحلات والتجار',
    category: 'MERCHANT',
    editionNumber: 'تطبيق التجار',
    iconName: 'Store',
    packageId: 'com.jam.store',
    badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    accentGradient: 'from-sky-500 to-blue-600',
    allowedRoles: ['owner', 'superadmin', 'manager', 'cashier', 'sales', 'wholesaler', 'importer', 'engineer', 'staff', 'employee', 'retailer', 'admin'],
    descriptionAr: 'تطبيق إدارة المتاجر والتجزئة.'
  },
  JAM_WHOLESALE: {
    code: 'JAM_STORE',
    key: 'jam_wholesale',
    appName: 'Jam store',
    titleAr: 'تطبيق التجار (Jam store)',
    subtitleAr: 'تطبيق تجار الجملة والمستودعات',
    category: 'MERCHANT',
    editionNumber: 'تطبيق التجار',
    iconName: 'Store',
    packageId: 'com.jam.store',
    badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    accentGradient: 'from-sky-500 to-blue-600',
    allowedRoles: ['owner', 'superadmin', 'manager', 'cashier', 'sales', 'wholesaler', 'importer', 'engineer', 'staff', 'employee', 'retailer', 'admin'],
    descriptionAr: 'تطبيق إدارة مبيعات الجملة والمخازن.'
  },
  JAM_MASTER: {
    code: 'JAM_STORE',
    key: 'jam_master',
    appName: 'Jam store',
    titleAr: 'تطبيق التجار (Jam store)',
    subtitleAr: 'تطبيق الموزعين وكبار التجار',
    category: 'MERCHANT',
    editionNumber: 'تطبيق التجار',
    iconName: 'Store',
    packageId: 'com.jam.store',
    badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    accentGradient: 'from-sky-500 to-blue-600',
    allowedRoles: ['owner', 'superadmin', 'manager', 'cashier', 'sales', 'wholesaler', 'importer', 'engineer', 'staff', 'employee', 'retailer', 'admin'],
    descriptionAr: 'تطبيق الموزعين وكبار التجار.'
  },
  JAM_IMPORTER: {
    code: 'JAM_STORE',
    key: 'jam_importer',
    appName: 'Jam store',
    titleAr: 'تطبيق التجار (Jam store)',
    subtitleAr: 'تطبيق المستوردين والتوكيلات',
    category: 'MERCHANT',
    editionNumber: 'تطبيق التجار',
    iconName: 'Store',
    packageId: 'com.jam.store',
    badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    accentGradient: 'from-sky-500 to-blue-600',
    allowedRoles: ['owner', 'superadmin', 'manager', 'cashier', 'sales', 'wholesaler', 'importer', 'engineer', 'staff', 'employee', 'retailer', 'admin'],
    descriptionAr: 'تطبيق المستوردين والتوكيلات التجارية.'
  },
  ALL: {
    code: 'ALL',
    key: 'ALL',
    appName: 'Jam store & Store pro',
    titleAr: 'المنظومة الشاملة (Jam store & Store pro)',
    subtitleAr: 'النسخة الكاملة للربط والتحكم الشامل',
    category: 'MASTER_OWNER',
    editionNumber: 'نسخة المالك الشاملة',
    iconName: 'Crown',
    packageId: 'com.jam.master.all',
    badgeColor: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    accentGradient: 'from-amber-400 via-yellow-500 to-amber-600',
    allowedRoles: ['*'],
    descriptionAr: 'تمنح المالك والإدارة العليا تحكماً كاملاً للربط والتنقل بين جميع التطبيقات.'
  }
};

/**
 * Switch active variant in localStorage and trigger instant reload/event
 */
export function switchAppVariant(variantCode: AppVariantType): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('JAM_APP_VARIANT', variantCode);
  }
  if (typeof window !== 'undefined') {
    (window as any).JAM_APP_VARIANT = variantCode;
    applyVariantBranding(variantCode);
    window.dispatchEvent(new CustomEvent('JAM_VARIANT_CHANGED', { detail: { variant: variantCode } }));
  }
}

/**
 * Apply title and meta branding according to active variant
 */
export function applyVariantBranding(variantCode?: AppVariantType): void {
  const code = variantCode || getCurrentVariant();
  const info = APP_VARIANTS[code] || APP_VARIANTS.ALL;

  if (typeof document !== 'undefined') {
    document.title = `${info.titleAr} - JAM SYSTEM PRO`;
  }
}

// Auto-apply branding on load
if (typeof window !== 'undefined') {
  try {
    applyVariantBranding();
  } catch (e) {
    // SSR fallback
  }
}

/**
 * Get active application variant
 */
export function getCurrentVariant(): AppVariantType {
  const envVar = import.meta.env.VITE_APP_VARIANT as string | undefined;
  const localVar = typeof localStorage !== 'undefined' ? localStorage.getItem('JAM_APP_VARIANT') : null;
  const windowVar = typeof window !== 'undefined' ? (window as any).JAM_APP_VARIANT : null;

  const raw = envVar || localVar || windowVar || 'ALL';
  
  if (raw in APP_VARIANTS) {
    return raw as AppVariantType;
  }
  
  // Also check key matching
  for (const variant of Object.values(APP_VARIANTS)) {
    if (variant.key === raw) {
      return variant.code;
    }
  }

  return 'ALL';
}

/**
 * Strictly check if user role is permitted to enter the current app variant.
 * Owners & SuperAdmins have global bypass across ALL variants.
 */
export function validateUserVariantAccess(
  role?: string | null,
  email?: string | null
): { allowed: boolean; message?: string; targetVariant?: string } {
  const currentVariant = getCurrentVariant();

  // 1. ALL variant has no restrictions
  if (currentVariant === 'ALL') {
    return { allowed: true };
  }

  const normalizedRole = (role || '').toLowerCase().trim();
  const normalizedEmail = (email || '').toLowerCase().trim();

  // 2. Owner & SuperAdmin & Main Developer have unrestricted access across ALL 5 app versions
  if (
    normalizedRole === 'owner' ||
    normalizedRole === 'superadmin' ||
    normalizedEmail === 'a777503191@gmail.com' ||
    normalizedEmail === 'system@jam-pro.net'
  ) {
    return { allowed: true };
  }

  const variantInfo = APP_VARIANTS[currentVariant];
  if (!variantInfo) {
    return { allowed: true };
  }

  // 3. Customer role matching vs Merchant role matching
  const isCustomerRole = [
    'customer',
    'retail_customer',
    'customer/client',
    'client',
    'guest'
  ].includes(normalizedRole);

  const isCustomerApp = currentVariant === 'JAM_CUSTOMER_VIP' || 
                        currentVariant === 'JAM_PORTAL' || 
                        currentVariant === 'JAM_CUSTOMER' ||
                        variantInfo.category === 'CUSTOMER';

  // If this is the Customer App (Store pro)
  if (isCustomerApp) {
    if (isCustomerRole) {
      return { allowed: true };
    }
    return {
      allowed: false,
      message: 'هذا التطبيق (Store pro) مخصص للمواطنين والزبائن فقط. يرجى استخدام تطبيق التجار (Jam store).',
      targetVariant: 'Jam store'
    };
  }

  // If this is a Merchant / Store App (Jam store / Desktop EXE)
  if (isCustomerRole) {
    return {
      allowed: false,
      message: 'هذا التطبيق (Jam store) مخصص للتجار والمتاجر فقط. يرجى استخدام تطبيق الزبائن والمواطنين (Store pro).',
      targetVariant: 'Store pro'
    };
  }

  // 4. Merchant Level Lock Enforcement
  const isAllowedInVariant = variantInfo.allowedRoles.includes(normalizedRole) || variantInfo.allowedRoles.includes('*');

  if (isAllowedInVariant) {
    return { allowed: true };
  }

  return {
    allowed: false,
    message: `حسابك مسجل بمستوى تجاري لا يتطابق مع هذه النسخة (${variantInfo.titleAr}). يرجى استخدام تطبيق التجار (Jam store).`,
    targetVariant: 'Jam store'
  };
}
