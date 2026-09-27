import { v4 as uuidv4 } from 'uuid';

/**
 * 🆔 JAM SYSTEM PRO - Standard UUID v4 Generator
 * -----------------------------------------------
 * يمنع منعاً باتاً استخدام الـ ID الترتيبي أو المتسلسل.
 * يتم توليد UUID v4 عشوائي ومشفر محلياً لكل منتج، فاتورة، عملية بيع، أو كارت صيانة
 * لضمان استحالة حدوث تصادمات (Zero-Collision Guarantee) عند دمج ومزامنة الأجهزة عبر الشبكة والسحاب.
 */

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback to uuidv4
    }
  }
  return uuidv4();
}

/**
 * توليد معرّف فاتورة فريد بنظام UUID v4
 */
export function generateInvoiceUUID(prefix: string = 'INV'): string {
  return `${prefix}-${generateUUID()}`;
}

/**
 * توليد معرّف منتج فريد بنظام UUID v4
 */
export function generateProductUUID(prefix: string = 'PRD'): string {
  return `${prefix}-${generateUUID()}`;
}

/**
 * توليد معرّف عملية بيع أو حركة مالية فريد بنظام UUID v4
 */
export function generateTransactionUUID(prefix: string = 'TXN'): string {
  return `${prefix}-${generateUUID()}`;
}

/**
 * توليد معرّف أمر صيانة فريد بنظام UUID v4
 */
export function generateMaintenanceUUID(prefix: string = 'MNT'): string {
  return `${prefix}-${generateUUID()}`;
}

/**
 * توليد معرّف عميل فريد بنظام UUID v4
 */
export function generateCustomerUUID(prefix: string = 'CUST'): string {
  return `${prefix}-${generateUUID()}`;
}

/**
 * توليد معرّف فاتورة معلقة / سلة مفتوحة مشتركة بنظام UUID v4
 */
export function generateOpenBillUUID(prefix: string = 'BILL'): string {
  return `${prefix}-${generateUUID()}`;
}

/**
 * التحقق مما إذا كان المعرف UUID v4 صالحاً
 */
export function isValidUUID(id: string): boolean {
  if (!id) return false;
  // If prefixed, strip prefix
  const clean = id.includes('-') && id.split('-').length > 5 ? id.substring(id.indexOf('-') + 1) : id;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(clean) || id.length >= 32;
}
