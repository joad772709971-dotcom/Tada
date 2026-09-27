/**
 * JAM System Pro 2026 - Axis 1 B2B Tier Hierarchy & Connection Isolation Engine
 * 
 * Rules:
 * 1. Strict 3-Tier Hierarchy:
 *    - Level 2: Importer / Master Wholesaler (تاجر جملة الجملة / المستورد)
 *    - Level 3: Wholesaler (تاجر الجملة)
 *    - Level 4: Retailer (تاجر التجزئة)
 * 
 * 2. Strict 1-Tier Gap Rule (قانون الفجوة الواحدة):
 *    - Retailer (Level 4) CAN ONLY connect to or view Wholesaler (Level 3).
 *    - Retailer CANNOT view or order from Master Wholesaler (Level 2) directly (2 tiers above is forbidden).
 *    - Wholesaler (Level 3) CAN connect to or view Master Wholesaler (Level 2).
 * 
 * 3. Exclusive Active Connection Rule (الارتباط الحصري النشط):
 *    - Products of a supplier are ONLY visible if an active b2bConnection document exists between buyer and supplier.
 * 
 * 4. Zero Mock Data & Strict Tenant Isolation (تطهير العزل التام):
 *    - All mock/demo data stripped out.
 */

export type TraderTierRole = 'importer' | 'distributor' | 'wholesaler' | 'retailer';

export const TIER_HIERARCHY_MAP: Record<string, number> = {
  // Master / Importer Level
  importer: 2,
  distributor: 2,
  master_wholesaler: 2,
  
  // Wholesaler Level
  wholesaler: 3,

  // Retailer Level
  retailer: 4,
  manager: 4,
  owner: 4,
  cashier: 4
};

export const TIER_NAMES_AR: Record<number, string> = {
  2: 'تاجر جملة الجملة (مستورد)',
  3: 'تاجر جملة معتمد',
  4: 'تاجر تجزئة'
};

/**
 * Gets numerical hierarchy level for a user role or role string
 */
export function getHierarchyLevel(roleOrLevel: string | number | undefined): number {
  if (typeof roleOrLevel === 'number') return roleOrLevel;
  if (!roleOrLevel) return 4; // Default to retailer
  const normalized = String(roleOrLevel).toLowerCase().trim();
  return TIER_HIERARCHY_MAP[normalized] || 4;
}

/**
 * Validates whether a buyer of buyerLevel is allowed to see or connect with a supplier of supplierLevel.
 * STRICT RULE: Buyer can ONLY view/connect with supplier that is EXACTLY 1 tier above them (buyerLevel - supplierLevel === 1).
 */
export function isAllowedTierGap(buyerRoleOrLevel: string | number, supplierRoleOrLevel: string | number): boolean {
  if (buyerRoleOrLevel === 'superadmin' || buyerRoleOrLevel === 'admin') return true;
  const buyerLevel = getHierarchyLevel(buyerRoleOrLevel);
  const supplierLevel = getHierarchyLevel(supplierRoleOrLevel);

  // Exact 1 level above rule, or peer trading between top-tier importers/wholesalers
  const gap = buyerLevel - supplierLevel;
  return gap === 1 || (buyerLevel <= 2 && supplierLevel <= 2);
}

/**
 * Filters supplier list strictly by:
 * 1. Active connection present
 * 2. Not blocked
 * 3. Not mock/demo data
 * 4. Strictly 1 tier above buyer
 */
export function filterConnectedSuppliersByTier(
  buyerRoleOrLevel: string | number,
  connectedSuppliers: any[]
): any[] {
  if (buyerRoleOrLevel === 'superadmin' || buyerRoleOrLevel === 'admin') {
    return (connectedSuppliers || []).filter(s => s && (s.status === 'active' || s.status === 'connected') && !s.isDemo && !s.id?.includes('DEMO'));
  }
  const buyerLevel = getHierarchyLevel(buyerRoleOrLevel);

  return (connectedSuppliers || []).filter(supplier => {
    // 1. Purge mock/demo data
    if (!supplier || supplier.isDemo || supplier.supplierId?.includes('DEMO') || supplier.id?.includes('DEMO')) {
      return false;
    }

    // 2. Check active connection status
    const isConnectionActive = supplier.status === 'active' || supplier.status === 'connected' || supplier.status === 'approved';
    const isBlocked = supplier.status === 'blocked' || supplier.permissions?.is_blocked === true;
    if (!isConnectionActive || isBlocked) {
      return false;
    }

    // 3. Strict 1-Tier Gap Rule
    const supplierLevel = getHierarchyLevel(supplier.hierarchyLevel || supplier.supplierRole || supplier.role || 'wholesaler');
    
    // Prevent 2-tier leap (e.g. Retailer Level 4 seeing Master Wholesaler Level 2)
    return (buyerLevel - supplierLevel === 1) || (buyerLevel <= 2 && supplierLevel <= 2);
  });
}

/**
 * Sanity check if a product is allowed to be viewed or purchased by buyer
 */
export function isProductTierAllowed(
  buyerRoleOrLevel: string | number,
  productWholesalerRoleOrLevel: string | number,
  productWholesalerId: string,
  connectedSuppliers: any[]
): boolean {
  const allowedSuppliers = filterConnectedSuppliersByTier(buyerRoleOrLevel, connectedSuppliers);
  const isLinked = allowedSuppliers.some(s => s.supplierId === productWholesalerId || s.id === productWholesalerId);
  if (!isLinked) return false;

  return isAllowedTierGap(buyerRoleOrLevel, productWholesalerRoleOrLevel);
}

/**
 * Axis 8: Dynamic Tier Pricing Calculation
 * Calculates adjusted B2B wholesale price according to customer tier/discount percentage.
 */
export function calculateTierPrice(
  basePrice: number,
  customDiscountPercent: number = 0,
  minAllowedMargin: number = 0
): number {
  const numPrice = Number(basePrice) || 0;
  if (numPrice <= 0) return 0;
  
  const discountFactor = Math.min(100, Math.max(0, Number(customDiscountPercent) || 0)) / 100;
  const discounted = numPrice * (1 - discountFactor);
  
  // Floor at minimum allowed price margin to prevent selling under cost
  return Math.max(minAllowedMargin, Math.round(discounted));
}

/**
 * Axis 8: Cost Price Masking Security Utility
 * Strips supplier purchase cost prices and margin stats from B2B items before sending to buyer views.
 */
export function sanitizeCatalogItemForBuyer<T extends Record<string, any>>(item: T): T {
  if (!item) return item;
  const sanitized = { ...item };
  
  // Remove supplier internal cost fields
  delete sanitized.cost;
  delete sanitized.costPrice;
  delete sanitized.buyPrice;
  delete sanitized.supplierCost;
  delete sanitized.profitMargin;
  delete sanitized.internalMargin;
  
  return sanitized;
}
