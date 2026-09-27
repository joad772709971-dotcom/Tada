import { v4 as uuidv4 } from 'uuid';
export * from '../utils/uuid';

/**
 * Generates a unique transaction ID to prevent doubles on retry (UUID v4)
 */
export const generateTransactionId = () => uuidv4();

/**
 * Formats a barcode with a shop-specific prefix
 */
export const formatSmartBarcode = (shopName: string, originalBarcode: string) => {
  const prefix = shopName.substring(0, 3).toUpperCase();
  if (originalBarcode.startsWith(prefix + '-')) return originalBarcode;
  return `${prefix}-${originalBarcode}`;
};

/**
 * Dynamic Branding Logic
 * Applies theme colors and logo from settings
 */
export const applyShopBranding = (settings: { primaryColor?: string, secondaryColor?: string, shopName?: string }) => {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  if (settings.primaryColor) {
    root.style.setProperty('--brand-primary', settings.primaryColor);
  }
  if (settings.secondaryColor) {
    root.style.setProperty('--brand-secondary', settings.secondaryColor);
  }
  
  // Optionally update document title
  if (settings.shopName) {
    document.title = `${settings.shopName} - JAM ERP`;
  }
};
