/**
 * 🔒 FROZEN SYSTEM ASSETS & OFFICIAL APPLICATION ICONS
 * 
 * 1. Merchant & System Pro Store (STORE PRO 3D Shield):
 *    - Android APK: JAM-System-Pro-Store.apk
 *    - Windows EXE: JAM-System-Pro-Setup.exe
 *    - Merchant Dashboard, Invoices & Financial Reports
 * 
 * 2. VIP Customer Portal (3D Neon Smartphone & Verification):
 *    - Android APK: JAM-Care-Portal-VIP-Customer.apk
 *    - Customer Portal, VIP Ledger & Account Statements
 */

export const APP_ICONS = {
  // 🏢 تطبيق التاجر والمنظومة الشاملة
  merchant: {
    id: 'merchant-store-pro',
    title: 'JAM System Pro - Store & Merchant',
    path: '/assets/icons/merchant-app-icon.png',
    path1024: '/assets/icons/merchant-app-icon-1024.png',
    icoPath: '/assets/icons/merchant-app-icon.ico',
    svgPath: '/assets/icons/merchant-icon.svg',
    dataUri: '/assets/icons/merchant-icon.svg',
  },

  // 👑 تطبيق بوابة العميل المميز VIP
  customerVip: {
    id: 'customer-care-vip',
    title: 'JAM Care VIP - Customer Portal',
    path: '/assets/icons/customer-vip-icon.png',
    path1024: '/assets/icons/customer-vip-icon-1024.png',
    svgPath: '/assets/icons/customer-icon.svg',
    dataUri: '/assets/icons/customer-icon.svg',
  }
} as const;

export type AppIconType = typeof APP_ICONS;
export default APP_ICONS;
