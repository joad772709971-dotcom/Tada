/**
 * High-Performance Route Preloader Service
 * Eliminates page opening latency by intelligently prefetching route chunks:
 * 1. Predictive hover/touch on navigation items (fetches 150-300ms before user click).
 * 2. Background idle preloading of top core routes during requestIdleCallback.
 */

const preloadedPaths = new Set<string>();

const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('../Dashboard'),
  '/maintenance': () => import('../components/Maintenance'),
  '/inventory': () => import('../components/Inventory'),
  '/sales': () => import('../components/Sales'),
  '/wholesale-pos': () => import('../components/WholesalePOS'),
  '/wholesale-purchases': () => import('../components/WholesalePOS'),
  '/accounts': () => import('../components/SmartAccountingHub'),
  '/smart-accounting': () => import('../components/SmartAccountingHub'),
  '/finances': () => import('../components/SmartAccountingHub'),
  '/bank-transfers': () => import('../components/BankTransferManager'),
  '/inventory-match': () => import('../components/InventoryMatching'),
  '/warehouse': () => import('../components/WorkforceWorkspace'),
  '/reports': () => import('../components/Archive'),
  '/archive': () => import('../components/Archive'),
  '/mobile-balance': () => import('../components/MobileBalance'),
  '/sim-cards': () => import('../components/SIMManagement'),
  '/customers': () => import('../components/Customers'),
  '/users': () => import('../components/Users'),
  '/engineer-accounts': () => import('../components/Maintenance'),
  '/attendance': () => import('../components/Attendance'),
  '/activity-logs': () => import('../components/ActivityLogs'),
  '/suppliers': () => import('../components/Suppliers'),
  '/shortages': () => import('../components/OrdersAndShortages'),
  '/orders': () => import('../components/OrdersAndShortages'),
  '/settings': () => import('../components/Settings'),
  '/chat': () => import('../components/ChatHub'),
  '/market': () => import('../components/MarketUI'),
  '/damaged': () => import('../components/DamagedItems'),
  '/invoice-scanner': () => import('../components/InvoiceScanner'),
  '/cashier': () => import('../components/CashierDashboard'),
  '/reels-manager': () => import('../components/ReelsManager'),
  '/smart-import': () => import('../components/SmartImport'),
  '/operations-customers': () => import('../components/OperationsAndCustomers'),
  '/warehouse-prep': () => import('../components/WarehousePrep'),
  '/delivery': () => import('../components/DeliveryAgentPortal'),
};

/**
 * Preloads a specific route dynamically on hover or focus
 */
export function preloadRoute(path: string): void {
  if (!path) return;
  const cleanPath = path.split('?')[0].split('#')[0].toLowerCase();
  
  if (preloadedPaths.has(cleanPath)) return;
  
  const loader = routeLoaders[cleanPath];
  if (loader) {
    preloadedPaths.add(cleanPath);
    // Execute loader in microtask so it never blocks UI thread
    Promise.resolve().then(() => {
      loader().catch(() => {
        // Retry on next interaction if network was interrupted
        preloadedPaths.delete(cleanPath);
      });
    });
  }
}

/**
 * Progressively preloads top mission-critical routes during idle periods
 */
export function preloadPriorityRoutes(): void {
  const priorityRoutes = [
    '/dashboard',
    '/maintenance',
    '/sales',
    '/inventory',
    '/wholesale-pos',
    '/accounts',
    '/customers',
    '/reports',
    '/archive',
    '/settings',
    '/cashier',
  ];

  let index = 0;

  const preloadNext = () => {
    if (index >= priorityRoutes.length) return;
    const path = priorityRoutes[index++];
    preloadRoute(path);

    // Schedule next route prefetch when browser is idle
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => preloadNext(), { timeout: 2000 });
    } else {
      setTimeout(preloadNext, 300);
    }
  };

  // Start after an initial pause to ensure initial render is complete
  if (typeof window !== 'undefined') {
    setTimeout(preloadNext, 1200);
  }
}
