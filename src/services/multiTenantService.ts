import { query as realQuery, where as realWhere, QueryConstraint } from 'firebase/firestore';

/**
 * 🛡️ MULTI-TENANT ATOMIC CHECK & ISOLATION SERVICE (المهمة العلاجية الأولى)
 * Enforces strict tenant separation at both the data-access level (Firestore query & voucher verification)
 * and the client-session level (deep cache purging on context switch / new user login).
 */
export class MultiTenantService {
  private static tenantCollections = [
    'inventory',
    'sales',
    'expenses',
    'transactions',
    'orders',
    'maintenanceOrders',
    'warehousePrepOrders',
    'adjustmentVouchers',
    'journal_entries',
    'vouchers',
    'ledgers',
    'invoices',
    'payments',
    'accounts',
    'employees',
    'payroll',
    'payroll_records',
    'customers',
    'suppliers',
    'activityLogs',
    'shift_closings',
    'official_holidays',
    'leave_requests',
    'damaged_items',
    'fixed_assets',
    'b2b_returns',
    'quarantined_transactions'
  ];

  /**
   * 1. Session & Cache Purge Controller (تطهير كاش الجلسة للعميل الجديد)
   * Wipes all user-specific data from localStorage and local state to ensure 100% clean sheet.
   */
  static purgeTenantCache(): string[] {
    console.log("🧹 [Multi-Tenant Purge] Performing deep session cache purge for clean-sheet user isolation...");
    const purgedKeys: string[] = [];
    const keysToPurge = [
      'jam_cached_user_profile',
      'customerPhone',
      'customerName',
      'user_token',
      'user_role',
      'current_shop_id',
      'jam_session_verified',
      'jam_remembered_username',
      'jam_remembered_password',
      'jam_remember_me',
      'jam_shop_subscription_expiry',
      'jam_last_sync',
      'jam_last_active',
      'jam_recent_transactions_signatures',
      'jam_license_cache',
      'jam_guest_recovery_force_owner'
    ];

    // Purge specific keys
    keysToPurge.forEach(key => {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        purgedKeys.push(key);
      }
    });

    // Purge any residual local fallbacks or user tour markers
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('tour_seen_') || key.startsWith('jam_local_shop_') || key.startsWith('jam_order_status_lock_'))) {
        localStorage.removeItem(key);
        purgedKeys.push(key);
      }
    }

    // Trigger clear internal memory registers
    if (typeof window !== 'undefined') {
      (window as any).__user_profile = null;
      (window as any).__lastTransactionId = null;
      (window as any).__transactionWriteCount = 0;
      (window as any).__quota_exceeded = false;
    }

    console.log(`✅ [Multi-Tenant Purge] Purged ${purgedKeys.length} localStorage cache & state variables.`);
    return purgedKeys;
  }

  /**
   * 2. Programmatic Query Validator & Filter Injector (التأكد والتحقق من قيود عزل المستعلم)
   * Inspects a query on a tenant collection. If it is missing a tenant constraint (ownerId / storeId),
   * it programmatically injects it or triggers a defensive lockdown block.
   */
  static verifyQueryConstraints(collectionPath: string, constraints: any[], activeOwnerId: string): { isValid: boolean; updatedConstraints: any[]; actionTaken: string } {
    const isTenantSpecific = this.tenantCollections.some(col => collectionPath.toLowerCase().includes(col.toLowerCase()));
    
    if (!isTenantSpecific) {
      return { isValid: true, updatedConstraints: constraints, actionTaken: 'Passed: Global collection' };
    }

    if (!activeOwnerId) {
      console.error(`🚨 [Security Alert] Unauthorized access block! Collection "${collectionPath}" queried without an active owner context.`);
      throw new Error(`خطأ حماية عزل البيانات: محاولة استعلام غير مصرح بها لجدول ${collectionPath} دون وجود مستأجر نشط.`);
    }

    // Check if there is an active 'where' constraint filtering by 'ownerId' or 'storeId'
    let hasTenantFilter = false;
    constraints.forEach(c => {
      // Introspect the query constraint structure (depends on Firestore JS SDK compiled objects)
      const str = JSON.stringify(c);
      if (str.includes('"ownerId"') || str.includes('"storeId"') || str.includes('"tenantId"') || str.includes(activeOwnerId)) {
        hasTenantFilter = true;
      }
    });

    if (hasTenantFilter) {
      return { isValid: true, updatedConstraints: constraints, actionTaken: 'Valid: Existing tenant isolation filter verified' };
    }

    // Programmatic auto-injection fallback (صمام الأمان التلقائي لحقن كود المستأجر)
    console.warn(`🛡️ [Multi-Tenant Security Gate] Injection Action: Query on "${collectionPath}" was missing tenant filter. Automatically injected filter for ownerId: ${activeOwnerId}`);
    
    // Create an explicit programmatic filter wrapper
    const injectedConstraint = realWhere('ownerId', '==', activeOwnerId);
    const updated = [injectedConstraint, ...constraints];

    return { 
      isValid: false, 
      updatedConstraints: updated, 
      actionTaken: `Safe fallback: Programmatically injected filter 'ownerId == ${activeOwnerId}'` 
    };
  }

  /**
   * 3. Voucher/Ledger Atomic Write Guard (صمام منع التداخل في القيود والسندات)
   * Verifies that any voucher, transaction, or inventory write contains the exact tenant context.
   */
  static validateVoucherWrite(collectionPath: string, data: any, activeOwnerId: string): boolean {
    const isTenantSpecific = this.tenantCollections.some(col => collectionPath.toLowerCase().includes(col.toLowerCase()));
    if (!isTenantSpecific) return true;

    if (!activeOwnerId) {
      throw new Error("تنبيه أمان: لا يمكن تسجيل مستند مالي أو بضاعة دون تحديد هوية المستأجر النشط.");
    }

    const dataOwnerId = data.ownerId || data.storeId || data.tenantId;
    if (dataOwnerId && dataOwnerId !== activeOwnerId) {
      console.warn(`🛡️ [Multi-Tenant Isolation Guard] Write payload has ownerId: "${dataOwnerId}" but active profile session has: "${activeOwnerId}". Cross-tenant write blocked.`);
      throw new Error(`خرق أمني لعزل المستأجرين: تداخل معرّفات الحسابات! الحساب النشط (${activeOwnerId}) لا يطابق معرّف البيانات المرسلة (${dataOwnerId}).`);
    }

    return true;
  }

  /**
   * 4. Double Isolation Guard (Store Guard + Staff Guard + Tier Guard + Geo & Accounting Boundary)
   * Enforces strict merchant and employee data isolation inside each project tier and across store IDs & regional boundaries.
   */
  static validateStoreAndStaffIsolation(collectionPath: string, data: any, activeProfile: any): boolean {
    if (!activeProfile) return true;

    // SuperAdmin / Master Owner is allowed global oversight across tiers
    if (activeProfile.role === 'super_admin' || activeProfile.role === 'developer' || activeProfile.role === 'master_owner') {
      return true;
    }

    const effectiveOwnerId = activeProfile.ownerId || activeProfile.parentUid || activeProfile.uid;

    if (!effectiveOwnerId) {
      throw new Error("تنبيه حماية العزل: تعذر التحقق من هوية التاجر أو المالك للمستند.");
    }

    // Verify staff scope lock (Cashier, Tech, Staff stick strictly to merchant ownerId)
    const isStaffRole = ['cashier', 'technician', 'employee', 'sub_user', 'inventory_manager'].includes(activeProfile.role);
    if (isStaffRole) {
      if (data && data.ownerId && data.ownerId !== effectiveOwnerId) {
        console.warn(`🛡️ [Staff Guard Lockdown] Employee (${activeProfile.uid}) attempted cross-merchant action!`);
        throw new Error("عزل الموظفين الصارم: لا يمتلك الموظف صلاحية للتعامل مع بيانات خارج نطاق متجر مالكه.");
      }
    }

    // Verify Geographical & Accounting Boundary Isolation
    if (data && data.geoBoundary && activeProfile.geoBoundary && data.geoBoundary !== activeProfile.geoBoundary) {
      console.warn(`🛡️ [Geo-Isolation Lockdown] Blocked cross-region access attempt: ${data.geoBoundary} vs ${activeProfile.geoBoundary}`);
      throw new Error("حجب الأمان الجغرافي: محاولة الوصول لقيد خارج الحدود والنطاق الجغرافي المعين للمتجر.");
    }

    if (data && data.accountingBoundary && activeProfile.accountingBoundary && data.accountingBoundary !== activeProfile.accountingBoundary) {
      console.warn(`🛡️ [Accounting-Isolation Lockdown] Blocked cross-ledger access attempt: ${data.accountingBoundary} vs ${activeProfile.accountingBoundary}`);
      throw new Error("حجب الأمان المحاسبي: محاولة قيد أو تعديل دفتر حسابات يتبع نطاقاً محاسبياً مستقلاً.");
    }

    return this.validateVoucherWrite(collectionPath, data, effectiveOwnerId);
  }

  /**
   * 5. Non-Owner Clean-up Utility
   * Clears non-owner local account data, caches, and temporary sessions without generating any mock/dummy data.
   */
  static purgeAllNonOwnerAccountsAndData(): void {
    console.log("🧹 [Clean-Sheet Engine] Wiping non-owner account caches & data references...");
    this.purgeTenantCache();
    
    // Clear mock or non-owner tokens from localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !key.includes('super_admin') && !key.includes('master_key')) {
        if (key.includes('demo') || key.includes('mock') || key.includes('user_') || key.includes('shop_')) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    console.log(`✅ [Clean-Sheet Engine] Purged ${keysToRemove.length} non-owner local references. System is clean.`);
  }
}
