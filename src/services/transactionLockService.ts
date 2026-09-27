import { Timestamp } from 'firebase/firestore';

export interface TimeLockResult {
  allowed: boolean;
  elapsedMinutes: number;
  remainingMinutes: number;
  message: string;
}

export const transactionLockService = {
  /**
   * Helper to parse any Firestore timestamp/date value to standard Date or milliseconds.
   */
  parseTransactionDate(createdAt: any): Date | null {
    if (!createdAt) return null;
    
    // Check if it's a Firestore Timestamp
    if (typeof createdAt.toDate === 'function') {
      return createdAt.toDate();
    }
    if (createdAt && typeof createdAt === 'object') {
      if (createdAt.seconds !== undefined) {
        return new Date(createdAt.seconds * 1000 + (createdAt.nanoseconds || 0) / 1000000);
      }
      if (createdAt._seconds !== undefined) {
        return new Date(createdAt._seconds * 1000 + (createdAt._nanoseconds || 0) / 1000000);
      }
    }
    
    // Check if it is a string or number
    if (typeof createdAt === 'string' || typeof createdAt === 'number' || createdAt instanceof Date) {
      const d = new Date(createdAt);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
    
    return null;
  },

  /**
   * Checks if modifying/editing is allowed (<= 1 hour / 60 minutes)
   */
  canEdit(createdAt: any): TimeLockResult {
    const txDate = this.parseTransactionDate(createdAt);
    if (!txDate) {
      // If we don't have a date (e.g. brand new or empty), allow by default
      return {
        allowed: true,
        elapsedMinutes: 0,
        remainingMinutes: 60,
        message: 'معاملة جديدة'
      };
    }

    const elapsedMs = Date.now() - txDate.getTime();
    const elapsedMinutes = Math.max(0, elapsedMs / 60000);
    const allowed = elapsedMinutes <= 60;
    const remainingMinutes = Math.max(0, 60 - elapsedMinutes);

    let message = '';
    if (allowed) {
      message = `مسموح بالتعديل. متبقي ${Math.ceil(remainingMinutes)} دقيقة في نافذة التعديل (مرت ${Math.floor(elapsedMinutes)} دقيقة).`;
    } else {
      message = `❌ غير مسموح بالتعديل: تجاوزت المعاملة الحد الزمني المسموح به (60 دقيقة). مرت ${Math.floor(elapsedMinutes)} دقيقة منذ الإنشاء.`;
    }

    return {
      allowed,
      elapsedMinutes,
      remainingMinutes,
      message
    };
  },

  /**
   * Checks if deleting/rolling back/undoing is allowed (<= 30 minutes)
   */
  canDelete(createdAt: any): TimeLockResult {
    const txDate = this.parseTransactionDate(createdAt);
    if (!txDate) {
      // If we don't have a date, allow by default
      return {
        allowed: true,
        elapsedMinutes: 0,
        remainingMinutes: 30,
        message: 'معاملة جديدة'
      };
    }

    const elapsedMs = Date.now() - txDate.getTime();
    const elapsedMinutes = Math.max(0, elapsedMs / 60000);
    const allowed = elapsedMinutes <= 30;
    const remainingMinutes = Math.max(0, 30 - elapsedMinutes);

    let message = '';
    if (allowed) {
      message = `مسموح بالحذف/التراجع. متبقي ${Math.ceil(remainingMinutes)} دقيقة في نافذة الحذف والمسح (مرت ${Math.floor(elapsedMinutes)} دقيقة).`;
    } else {
      message = `❌ غير مسموح بالحذف/التراجع: تجاوزت المعاملة الحد الزمني المسموح به (30 دقيقة). مرت ${Math.floor(elapsedMinutes)} دقيقة منذ الإنشاء لضمان تطابق الصناديق.`;
    }

    return {
      allowed,
      elapsedMinutes,
      remainingMinutes,
      message
    };
  }
};
