/**
 * 🌟 Dynamic System Assets & App Icon Resolver
 */

export const MERCHANT_LOGO = "/assets/icons/merchant-app-icon.png";
export const CUSTOMER_LOGO = "/assets/icons/customer-vip-icon.png";

export function getActiveAppLogo(): string {
  if (typeof window !== 'undefined') {
    const activeVar = localStorage.getItem('JAM_APP_VARIANT') || (window as any).JAM_APP_VARIANT || '';
    if (activeVar.includes('CUSTOMER') || activeVar.includes('PORTAL') || activeVar === 'store_pro') {
      return CUSTOMER_LOGO;
    }
  }
  return MERCHANT_LOGO;
}

export const SYSTEM_LOGO = typeof window !== 'undefined' && (
  localStorage.getItem('JAM_APP_VARIANT')?.includes('CUSTOMER') ||
  localStorage.getItem('JAM_APP_VARIANT') === 'store_pro'
) ? CUSTOMER_LOGO : MERCHANT_LOGO;
