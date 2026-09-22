/**
 * ⚡ JAM SYSTEM PRO - Offline Sync State & Transaction Timestamp Validator Engine
 * 
 * فحص وحماية حالة المزامنة الأوفلاين (Offline Sync State) مع التحقق من صحة الطوابع الزمنية 
 * وسلامة سجلات الحركات (Transactions) ضد حالات الإغلاق المفاجئ وانقطاع التيار الكهربائي.
 */

import { quotaAndOfflineEngine, PendingOfflineOperation } from './quotaAndOfflineEngine';
import { persistentStorageEngine } from './PersistentStorageEngine';
import { yemenTimeService } from './yemenTimeReconciliation';

export interface SyncValidationIssue {
  transactionId: string;
  issueType: 'MISSING_TIMESTAMP' | 'INVALID_TIMESTAMP' | 'CORRUPTED_PAYLOAD' | 'SHUTDOWN_ABORT' | 'MISSING_TENANT';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  originalRecord?: any;
}

export interface SyncValidationReport {
  timestamp: string;
  yemenTime: string;
  totalPendingTransactions: number;
  validTransactionsCount: number;
  corruptedTransactionsCount: number;
  invalidTimestampCount: number;
  shutdownAbortedCount: number;
  repairedCount: number;
  quarantinedCount: number;
  integrityStatus: 'EXCELLENT' | 'WARNING' | 'CRITICAL';
  issues: SyncValidationIssue[];
  repairedTransactions: PendingOfflineOperation[];
  summary: string;
}

const STORAGE_QUEUE_KEY = 'jam_pending_offline_queue_v2';
const QUARANTINE_QUEUE_KEY = 'jam_quarantine_offline_queue_v1';

// Year limits for reasonable timestamps (2020 - 2100)
const MIN_VALID_TIMESTAMP = new Date('2020-01-01T00:00:00Z').getTime();
const MAX_VALID_TIMESTAMP = new Date('2100-01-01T00:00:00Z').getTime();

export class OfflineSyncValidatorService {
  
  /**
   * 🔍 فحص كافة الحركات المعلقة في الطابور المحلي وتحليل الطوابع الزمنية والبيانات
   */
  public static async inspectAndValidateQueue(autoRepair: boolean = true): Promise<SyncValidationReport> {
    console.log('🔍 [OfflineSyncValidator] Starting Offline Sync State & Timestamp Audit...');
    
    let rawQueueData: string | null = null;
    let queue: any[] = [];
    const issues: SyncValidationIssue[] = [];
    let shutdownAbortedCount = 0;
    let invalidTimestampCount = 0;
    let corruptedTransactionsCount = 0;

    // 1. جلب البيانات من localStorage مع محاولة الاستعادة من persistentStorageEngine إذا وجد كسر
    try {
      if (typeof localStorage !== 'undefined') {
        rawQueueData = localStorage.getItem(STORAGE_QUEUE_KEY);
      }
      if (!rawQueueData) {
        rawQueueData = await persistentStorageEngine.getItem(STORAGE_QUEUE_KEY);
      }

      if (rawQueueData) {
        queue = JSON.parse(rawQueueData);
      }
    } catch (parseError: any) {
      console.error('⚠️ [OfflineSyncValidator] Sudden shutdown cut off JSON serialization in localStorage!');
      issues.push({
        transactionId: 'QUEUE_ROOT',
        issueType: 'CORRUPTED_PAYLOAD',
        severity: 'HIGH',
        description: `فشل قراءة طابور الحركات الأوفلاين بسبب انقطاع مفاجئ أثناء الكتابة: ${parseError?.message || parseError}`
      });
      corruptedTransactionsCount++;
      
      // Attempt recovery from mirror/IndexedDB
      try {
        const mirrorData = await persistentStorageEngine.getItem(`${STORAGE_QUEUE_KEY}_mirror`);
        if (mirrorData) {
          queue = JSON.parse(mirrorData);
          console.log('✅ [OfflineSyncValidator] Successfully restored queue from external mirror store!');
        }
      } catch {
        queue = [];
      }
    }

    if (!Array.isArray(queue)) {
      queue = [];
    }

    const validOperations: PendingOfflineOperation[] = [];
    const quarantinedOperations: any[] = [];
    let repairedCount = 0;

    // 2. معالجة كل حركة على حدة واكتشاف المشاكل في الطوابع الزمنية وسلامة الهيكل
    for (let index = 0; index < queue.length; index++) {
      const item = queue[index];
      const txId = item?.id || `UNKNOWN_TX_${index}_${Date.now()}`;
      let isItemValid = true;
      let wasRepaired = false;
      let repairedItem: PendingOfflineOperation = { ...item };

      // أ) الفحص الأول: هل الحركة مكتملة أم قطعت بسبب إغلاق مفاجئ؟
      if (!item || typeof item !== 'object') {
        shutdownAbortedCount++;
        corruptedTransactionsCount++;
        issues.push({
          transactionId: txId,
          issueType: 'SHUTDOWN_ABORT',
          severity: 'HIGH',
          description: `سجل حركة تالف كلياً وغير مكتمل (احتمال إغلاق متصفح أو انقطاع كهرباء مفاجئ).`,
          originalRecord: item
        });
        continue;
      }

      if (!item.action || !item.collectionName) {
        shutdownAbortedCount++;
        corruptedTransactionsCount++;
        issues.push({
          transactionId: txId,
          issueType: 'CORRUPTED_PAYLOAD',
          severity: 'HIGH',
          description: `سجل الحركة يفتقد للعملية (action) أو اسم المجموعة (collectionName).`,
          originalRecord: item
        });
        isItemValid = false;
      }

      // ب) الفحص الثاني: التحقق من الطابع الزمني createdAt
      let ts = item.createdAt;
      
      // إذا كان الطابع النصي موجوداً ولكن بصيغة Date، نحوله إلى epoch ms
      if (typeof ts === 'string') {
        const parsedMs = Date.parse(ts);
        if (!isNaN(parsedMs)) {
          ts = parsedMs;
        }
      }

      if (ts === undefined || ts === null || typeof ts !== 'number' || isNaN(ts) || ts < MIN_VALID_TIMESTAMP || ts > MAX_VALID_TIMESTAMP) {
        invalidTimestampCount++;
        issues.push({
          transactionId: txId,
          issueType: 'INVALID_TIMESTAMP',
          severity: 'MEDIUM',
          description: `طابع زمني غير صالح أو مفقود (${item.createdAt}).`,
          originalRecord: item
        });

        if (autoRepair) {
          // إصلاح الطابع الزمني باستخدام توقيت اليمن المعتمد
          const safeYemenTime = yemenTimeService.getYemenDate().getTime();
          repairedItem.createdAt = safeYemenTime;
          wasRepaired = true;
          console.log(`🛠️ [OfflineSyncValidator] Repaired invalid timestamp for TX ${txId} -> Set to Yemen Time (${new Date(safeYemenTime).toISOString()})`);
        } else {
          isItemValid = false;
        }
      } else {
        repairedItem.createdAt = ts;
      }

      // ج) الفحص الثالث: هل الحركة تمتلك معرف المتجر والمسخدم (Tenant Isolation Check)
      if (!repairedItem.storeId || !repairedItem.userId) {
        issues.push({
          transactionId: txId,
          issueType: 'MISSING_TENANT',
          severity: 'MEDIUM',
          description: `الحركة لا تحتوي على storeId أو userId محدد.`,
          originalRecord: item
        });

        if (autoRepair) {
          repairedItem.storeId = repairedItem.storeId || 'default_tenant';
          repairedItem.userId = repairedItem.userId || 'system_fallback';
          wasRepaired = true;
        }
      }

      // د) الفحص الرابع: التأكد من عدم تضرر حمولة البيانات (data payload)
      if (!repairedItem.data || typeof repairedItem.data !== 'object') {
        shutdownAbortedCount++;
        issues.push({
          transactionId: txId,
          issueType: 'CORRUPTED_PAYLOAD',
          severity: 'HIGH',
          description: `حمولة البيانات (data) مفقودة أو غير صالحة.`,
          originalRecord: item
        });
        isItemValid = false;
      }

      // هـ) اتخاذ القرار: الاحتفاظ بالحركة، تعزيلها، أو إضافة النسخة المصلحة
      if (isItemValid) {
        if (!repairedItem.id) {
          repairedItem.id = `TX_REPAIRED_${index}_${Date.now()}`;
          wasRepaired = true;
        }
        if (!repairedItem.attempts) {
          repairedItem.attempts = 0;
        }
        
        validOperations.push(repairedItem);
        if (wasRepaired) repairedCount++;
      } else {
        quarantinedOperations.push(item);
      }
    }

    // 3. حفظ الطابور المصحح إذا طُلب التعديل التلقائي
    if (autoRepair && (repairedCount > 0 || quarantinedOperations.length > 0 || issues.length > 0)) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(validOperations));
          if (quarantinedOperations.length > 0) {
            localStorage.setItem(QUARANTINE_QUEUE_KEY, JSON.stringify(quarantinedOperations));
          }
        }
        await persistentStorageEngine.setItem(STORAGE_QUEUE_KEY, JSON.stringify(validOperations));
        console.log(`✅ [OfflineSyncValidator] Auto-repair completed! Valid TXs saved: ${validOperations.length}, Quarantined: ${quarantinedOperations.length}`);
      } catch (saveErr) {
        console.error('⚠️ [OfflineSyncValidator] Error persisting repaired queue:', saveErr);
      }
    }

    // 4. تقييم الحالة العامة لسلامة البيانات
    const totalCount = queue.length;
    const validCount = validOperations.length;
    let integrityStatus: 'EXCELLENT' | 'WARNING' | 'CRITICAL' = 'EXCELLENT';

    if (corruptedTransactionsCount > 0 || shutdownAbortedCount > 0) {
      integrityStatus = (validCount === 0 && totalCount > 0) ? 'CRITICAL' : 'WARNING';
    } else if (invalidTimestampCount > 0) {
      integrityStatus = 'WARNING';
    }

    const yemenTimeString = new Date(yemenTimeService.getYemenDate().getTime()).toLocaleString('ar-YE', { timeZone: 'Asia/Aden' });

    const report: SyncValidationReport = {
      timestamp: new Date().toISOString(),
      yemenTime: yemenTimeString,
      totalPendingTransactions: totalCount,
      validTransactionsCount: validCount,
      corruptedTransactionsCount,
      invalidTimestampCount,
      shutdownAbortedCount,
      repairedCount,
      quarantinedCount: quarantinedOperations.length,
      integrityStatus,
      issues,
      repairedTransactions: validOperations,
      summary: `تم فحص ${totalCount} حركة أوفلاين. الحركات الصالحة: ${validCount}، الطوابع الزمنية المصلحة: ${repairedCount}، الحركات المعزولة بسبب الإغلاق المفاجئ: ${quarantinedOperations.length}. حالة النظام: ${integrityStatus}`
    };

    console.log(`📊 [OfflineSyncValidator Audit Complete]: ${report.summary}`);
    return report;
  }

  /**
   * 🛡️ فحص الطوابع الزمنية في قائمة حركات معينة في الذاكرة (سجلات المبيعات / المشتريات / القيود)
   */
  public static validateTransactionsArray(transactions: any[]): { valid: any[]; invalid: any[]; fixesCount: number } {
    const valid: any[] = [];
    const invalid: any[] = [];
    let fixesCount = 0;

    if (!Array.isArray(transactions)) {
      return { valid: [], invalid: [], fixesCount: 0 };
    }

    const nowYemen = yemenTimeService.getYemenDate().getTime();

    for (const tx of transactions) {
      if (!tx || typeof tx !== 'object') {
        invalid.push(tx);
        continue;
      }

      const txCopy = { ...tx };
      let ts = txCopy.createdAt || txCopy.timestamp || txCopy.date;

      if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        if (!isNaN(parsed)) ts = parsed;
      }

      if (typeof ts !== 'number' || isNaN(ts) || ts < MIN_VALID_TIMESTAMP || ts > MAX_VALID_TIMESTAMP) {
        txCopy.createdAt = nowYemen;
        txCopy.timestamp = nowYemen;
        txCopy.timestampRepaired = true;
        fixesCount++;
        valid.push(txCopy);
      } else {
        valid.push(txCopy);
      }
    }

    return { valid, invalid, fixesCount };
  }
}
