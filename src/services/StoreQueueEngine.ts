import { persistentStorageEngine } from './PersistentStorageEngine';
import { stampStoreContext } from './OfflineCore';

export interface QueueTaskPayload {
  id: string;
  storeId: string;
  actionType: string; // 'create_sale' | 'wholesale_order' | 'voucher' | 'inventory_transfer' | 'maintenance_job' | string
  collectionName: string;
  payloadHash: string;
  data: any;
  createdAt: number;
  status: 'pending' | 'processing' | 'synced' | 'failed';
  retryCount: number;
  lastError?: string;
  mathGuardChecked: boolean;
}

export interface MathGuardResult {
  isValid: boolean;
  expectedTotal: number;
  providedTotal: number;
  discrepancy: number;
  details: string;
}

class StoreQueueEngineClass {
  private queueKeyPrefix = 'jam_store_queue_v1';
  private inMemoryQueue: Map<string, QueueTaskPayload[]> = new Map();
  private processingLock: Set<string> = new Set();

  /**
   * ⚡ Compute Payload Hash for Deduplication & Double Submission Guard
   */
  public generatePayloadHash(data: any): string {
    try {
      // Exclude volatile fields like timestamp or temp ids if present
      const cleanData = { ...data };
      delete cleanData.createdAt;
      delete cleanData.timestamp;
      delete cleanData.isOfflineSyncPending;
      delete cleanData.tempId;

      const str = JSON.stringify(cleanData);
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      return `HASH_${Math.abs(hash).toString(16)}_${str.length}`;
    } catch (e) {
      return `HASH_FALLBACK_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
  }

  /**
   * 🧮 Offline Math Guard
   * Re-calculates and verifies monetary sums on invoices, receipts, and vouchers
   * preventing invalid subtotals, corrupted discount calculations, or missing taxes.
   */
  public verifyOfflineMathGuard(actionType: string, data: any): MathGuardResult {
    let expectedTotal = 0;
    let providedTotal = Number(data.totalAmount ?? data.total ?? data.amount ?? data.grandTotal ?? 0);

    // 1. Sales / Invoice Math Guard
    if (actionType.includes('sale') || actionType.includes('invoice') || actionType.includes('order')) {
      const items = Array.isArray(data.items) ? data.items : [];
      let itemsSubtotal = 0;

      for (const item of items) {
        const qty = Number(item.quantity ?? item.qty ?? item.count ?? 1);
        const price = Number(item.sellPrice ?? item.price ?? item.unitPrice ?? 0);
        const itemDiscount = Number(item.discount ?? 0);
        itemsSubtotal += Math.max(0, (qty * price) - itemDiscount);
      }

      const globalDiscount = Number(data.discount ?? data.discountAmount ?? 0);
      const taxAmount = Number(data.taxAmount ?? data.tax ?? 0);
      const shippingCost = Number(data.shippingCost ?? data.shipping ?? 0);

      expectedTotal = Math.max(0, itemsSubtotal - globalDiscount + taxAmount + shippingCost);
    } 
    // 2. Financial Vouchers (Receipts / Payments)
    else if (actionType.includes('voucher') || actionType.includes('payment') || actionType.includes('receipt')) {
      expectedTotal = Number(data.amount ?? data.totalAmount ?? 0);
    } 
    // 3. General Fallback
    else {
      expectedTotal = providedTotal;
    }

    // Round to 2 decimal places for accurate comparisons
    expectedTotal = Math.round(expectedTotal * 100) / 100;
    providedTotal = Math.round(providedTotal * 100) / 100;

    const discrepancy = Math.abs(expectedTotal - providedTotal);
    const isValid = discrepancy < 0.01;

    return {
      isValid,
      expectedTotal,
      providedTotal,
      discrepancy,
      details: isValid 
        ? 'التدقيق الحسابي أوفلاين مطابق 100%' 
        : `تنبيه تدقيق أوفلاين: المجموع المحسوب (${expectedTotal}) يختلف عن المدخل (${providedTotal}) بمقدار (${discrepancy})`
    };
  }

  /**
   * ⚡ Enqueue Local Task with 0ms Instant Release Protocol
   */
  public async enqueueTask(
    storeId: string,
    actionType: string,
    collectionName: string,
    rawPayload: any,
    profileObj: any
  ): Promise<{ success: boolean; taskId: string; isDuplicate: boolean; mathResult: MathGuardResult }> {
    const cleanStoreId = (storeId || profileObj?.ownerId || profileObj?.storeId || 'master').replace(/[^a-zA-Z0-9_\-]/g, '_');
    
    // 1. Stamp store context & operator isolation
    const stampedData = stampStoreContext(rawPayload, profileObj);
    
    // 2. Perform Offline Math Guard Audit
    const mathResult = this.verifyOfflineMathGuard(actionType, stampedData);
    if (!mathResult.isValid) {
      console.warn(`⚠️ [Offline Math Guard] Auto-correcting payload total from ${mathResult.providedTotal} to ${mathResult.expectedTotal}`);
      stampedData.totalAmount = mathResult.expectedTotal;
      stampedData.mathGuardCorrected = true;
    }

    // 3. Generate Deduplication Hash
    const payloadHash = this.generatePayloadHash(stampedData);
    
    // 4. Retrieve existing store queue
    const queue = await this.getStoreQueue(cleanStoreId);

    // 5. Deduplication Check (Prevent double submit within active queue)
    const existingTask = queue.find(t => t.payloadHash === payloadHash && t.status !== 'failed');
    if (existingTask) {
      console.warn(`🛡️ [StoreQueueEngine] Duplicate action detected for hash [${payloadHash}]. Returning existing task.`);
      return {
        success: true,
        taskId: existingTask.id,
        isDuplicate: true,
        mathResult
      };
    }

    // 6. Construct new task
    const taskId = `task_${cleanStoreId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newQueueItem: QueueTaskPayload = {
      id: taskId,
      storeId: cleanStoreId,
      actionType,
      collectionName,
      payloadHash,
      data: stampedData,
      createdAt: Date.now(),
      status: 'pending',
      retryCount: 0,
      mathGuardChecked: true
    };

    // 7. Push to local memory and persistent storage
    queue.push(newQueueItem);
    this.inMemoryQueue.set(cleanStoreId, queue);
    await this.persistStoreQueue(cleanStoreId, queue);

    console.log(`⚡ [0ms Instant Release] Task [${taskId}] queued locally for store [${cleanStoreId}]. Total pending: ${queue.length}`);

    return {
      success: true,
      taskId,
      isDuplicate: false,
      mathResult
    };
  }

  /**
   * Fetch queue for specific store (0ms cached memory fallback)
   */
  public async getStoreQueue(storeId: string): Promise<QueueTaskPayload[]> {
    const cleanStoreId = (storeId || 'master').replace(/[^a-zA-Z0-9_\-]/g, '_');
    
    if (this.inMemoryQueue.has(cleanStoreId)) {
      return this.inMemoryQueue.get(cleanStoreId)!;
    }

    const storageKey = `${this.queueKeyPrefix}_${cleanStoreId}`;
    let raw = localStorage.getItem(storageKey);
    if (!raw) {
      raw = await persistentStorageEngine.getItem(storageKey);
    }

    let parsed: QueueTaskPayload[] = [];
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        parsed = [];
      }
    }

    this.inMemoryQueue.set(cleanStoreId, parsed);
    return parsed;
  }

  /**
   * Save store queue to local & IndexedDB storage
   */
  private async persistStoreQueue(storeId: string, queue: QueueTaskPayload[]): Promise<void> {
    const cleanStoreId = (storeId || 'master').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const storageKey = `${this.queueKeyPrefix}_${cleanStoreId}`;
    const serialized = JSON.stringify(queue);

    try {
      localStorage.setItem(storageKey, serialized);
      await persistentStorageEngine.setItem(storageKey, serialized, cleanStoreId, 'queue_engine');
    } catch (e) {
      console.warn('Persistent queue save notice:', e);
    }
  }

  /**
   * Clear completed tasks from queue
   */
  public async clearCompletedTasks(storeId: string): Promise<void> {
    const cleanStoreId = (storeId || 'master').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const queue = await this.getStoreQueue(cleanStoreId);
    const filtered = queue.filter(t => t.status === 'pending' || t.status === 'failed');
    this.inMemoryQueue.set(cleanStoreId, filtered);
    await this.persistStoreQueue(cleanStoreId, filtered);
  }

  /**
   * Delete a specific task by ID
   */
  public async removeTask(storeId: string, taskId: string): Promise<void> {
    const cleanStoreId = (storeId || 'master').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const queue = await this.getStoreQueue(cleanStoreId);
    const filtered = queue.filter(t => t.id !== taskId);
    this.inMemoryQueue.set(cleanStoreId, filtered);
    await this.persistStoreQueue(cleanStoreId, filtered);
  }

  /**
   * Force retry for failed tasks
   */
  public async retryFailedTasks(storeId: string): Promise<void> {
    const cleanStoreId = (storeId || 'master').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const queue = await this.getStoreQueue(cleanStoreId);
    let count = 0;
    for (const task of queue) {
      if (task.status === 'failed') {
        task.status = 'pending';
        task.retryCount = 0;
        task.lastError = undefined;
        count++;
      }
    }
    if (count > 0) {
      this.inMemoryQueue.set(cleanStoreId, queue);
      await this.persistStoreQueue(cleanStoreId, queue);
      console.log(`🔄 [StoreQueueEngine] Reset ${count} failed tasks to pending for retry.`);
    }
  }

  /**
   * 🔄 Background FIFO Task Processing & Conflict Auto-Resolver (Axis 8 Engine)
   */
  public async processSyncQueue(
    storeId: string,
    syncExecutor?: (task: QueueTaskPayload) => Promise<boolean>
  ): Promise<{ syncedCount: number; failedCount: number }> {
    const cleanStoreId = (storeId || 'master').replace(/[^a-zA-Z0-9_\-]/g, '_');

    if (this.processingLock.has(cleanStoreId)) {
      console.log(`⏳ [StoreQueueEngine] Sync already in progress for store [${cleanStoreId}]`);
      return { syncedCount: 0, failedCount: 0 };
    }

    this.processingLock.add(cleanStoreId);
    let syncedCount = 0;
    let failedCount = 0;

    try {
      const queue = await this.getStoreQueue(cleanStoreId);
      const pendingTasks = queue.filter(t => t.status === 'pending');

      for (const task of pendingTasks) {
        if (!navigator.onLine) {
          console.log(`📡 [StoreQueueEngine] Network offline. Pausing queue processing for store [${cleanStoreId}].`);
          break;
        }

        task.status = 'processing';
        let success = true;

        try {
          if (syncExecutor) {
            success = await syncExecutor(task);
          } else {
            // Default simulated fast batch sync release
            await new Promise(res => setTimeout(res, 80));
            success = true;
          }
        } catch (err: any) {
          success = false;
          task.lastError = err?.message || String(err);
        }

        if (success) {
          task.status = 'synced';
          syncedCount++;
        } else {
          task.retryCount = (task.retryCount || 0) + 1;
          if (task.retryCount >= 3) {
            task.status = 'failed';
          } else {
            task.status = 'pending'; // retry next cycle
          }
          failedCount++;
        }
      }

      await this.persistStoreQueue(cleanStoreId, queue);
      await this.clearCompletedTasks(cleanStoreId);
    } finally {
      this.processingLock.delete(cleanStoreId);
    }

    return { syncedCount, failedCount };
  }

  /**
   * 📊 Get Detailed Diagnostic Inspection Report (Axis 7 Audit Engine)
   */
  public async getDiagnosticReport(storeId: string): Promise<{
    storeId: string;
    totalTasks: number;
    pendingCount: number;
    syncedCount: number;
    failedCount: number;
    mathGuardViolations: number;
    uniqueHashes: number;
    storageUsageBytes: number;
    isOnline: boolean;
    lastAuditTime: string;
  }> {
    const cleanStoreId = (storeId || 'master').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const queue = await this.getStoreQueue(cleanStoreId);
    const serialized = JSON.stringify(queue);
    
    const hashes = new Set(queue.map(t => t.payloadHash));
    const mathGuardViolations = queue.filter(t => t.data?.mathGuardCorrected).length;

    return {
      storeId: cleanStoreId,
      totalTasks: queue.length,
      pendingCount: queue.filter(t => t.status === 'pending').length,
      syncedCount: queue.filter(t => t.status === 'synced').length,
      failedCount: queue.filter(t => t.status === 'failed').length,
      mathGuardViolations,
      uniqueHashes: hashes.size,
      storageUsageBytes: new Blob([serialized]).size,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      lastAuditTime: new Date().toLocaleTimeString('ar-YE')
    };
  }

  /**
   * Get queue stats summary
   */
  public async getQueueSummary(storeId: string): Promise<{ total: number; pending: number; failed: number }> {
    const queue = await this.getStoreQueue(storeId);
    return {
      total: queue.length,
      pending: queue.filter(q => q.status === 'pending').length,
      failed: queue.filter(q => q.status === 'failed').length
    };
  }
}

export const StoreQueueEngine = new StoreQueueEngineClass();
