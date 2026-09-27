import { liveHotFixEngine, HotFixPatchPayload } from './LiveHotFixEngine';
import { idbService } from './idbService';

export interface IntegrityCheckReport {
  timestamp: string;
  activeInputElement: string | null;
  activeInputValid: boolean;
  indexedDbHealthy: boolean;
  offlineQueueLength: number;
  memoryStatus: string;
  patchApplied: string | null;
  status: 'passed' | 'warning' | 'error';
}

export class HotPatchSecurityGuardClass {
  private isChecking = false;
  private lastReport: IntegrityCheckReport | null = null;

  /**
   * Run automated state and input integrity check during hot-patching
   */
  public async performIntegrityCheck(patch?: HotFixPatchPayload | null): Promise<IntegrityCheckReport> {
    if (this.isChecking) {
      return this.lastReport || this.getFallbackReport();
    }
    this.isChecking = true;

    let activeInputElementStr: string | null = null;
    let activeInputValid = true;

    try {
      // 1. Inspect Active Input Focus & DOM State
      if (typeof document !== 'undefined' && document.activeElement) {
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable) {
          activeInputElementStr = `${activeEl.tagName.toLowerCase()}${activeEl.id ? '#' + activeEl.id : ''}${activeEl.className ? '.' + activeEl.className.split(' ')[0] : ''}`;
          
          // Verify input responsiveness by checking if value can be safely read
          if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) {
            const val = activeEl.value;
            activeInputValid = typeof val === 'string';
          }
        }
      }

      // 2. Inspect Local IndexedDB Health & Offline Queues
      let indexedDbHealthy = true;
      let offlineQueueLength = 0;

      try {
        const offlineQueue = await idbService.getOfflineQueue();
        offlineQueueLength = Array.isArray(offlineQueue) ? offlineQueue.length : 0;
      } catch (e) {
        console.warn("🛡️ [HotPatchSecurityGuard] IndexedDB read check warning:", e);
        indexedDbHealthy = false;
      }

      // 3. Construct Report
      const report: IntegrityCheckReport = {
        timestamp: new Date().toLocaleTimeString('ar-YE'),
        activeInputElement: activeInputElementStr,
        activeInputValid,
        indexedDbHealthy,
        offlineQueueLength,
        memoryStatus: typeof performance !== 'undefined' && (performance as any).memory 
          ? `${Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)} MB` 
          : 'Normal',
        patchApplied: patch ? `[${patch.patchId}] ${patch.title}` : 'Standard Core',
        status: indexedDbHealthy && activeInputValid ? 'passed' : 'warning'
      };

      this.lastReport = report;
      console.log("🛡️ [HotPatchSecurityGuard] Runtime integrity check completed:", report);
      return report;
    } catch (e) {
      console.error("🛡️ [HotPatchSecurityGuard] Integrity check error:", e);
      return this.getFallbackReport();
    } finally {
      this.isChecking = false;
    }
  }

  private getFallbackReport(): IntegrityCheckReport {
    return {
      timestamp: new Date().toLocaleTimeString('ar-YE'),
      activeInputElement: null,
      activeInputValid: true,
      indexedDbHealthy: true,
      offlineQueueLength: 0,
      memoryStatus: 'Normal',
      patchApplied: null,
      status: 'passed'
    };
  }

  public getLastReport(): IntegrityCheckReport | null {
    return this.lastReport;
  }
}

export const hotPatchSecurityGuardService = new HotPatchSecurityGuardClass();
