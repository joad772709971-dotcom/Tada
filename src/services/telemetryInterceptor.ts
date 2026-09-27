export interface TelemetryPayload {
  errorId: string;
  timestamp: string;
  merchantId: string;
  affectedTables: string[]; // مثل: 'ledgers', 'warehouse_stock'
  snapshotData: any;        // البيانات الحالية التي حدث فيها الخلل
  expectedData: any;        // البيانات المتوقع وجودها منطقياً
  errorContext: string;     // وصف الخلل (مثال: عدم تطابق قيد الشحن مع التسوية)
}

export class AccountingTelemetry {
  // 1. فحص ومراقبة تطابق القيود قبل الترحيل
  static async verifyAndCatch(
    merchantId: string,
    affectedTables: string[],
    snapshotData: any,
    expectedData: any,
    validationCheck: boolean,
    contextDescription: string
  ): Promise<boolean> {
    
    if (!validationCheck) {
      const payload: TelemetryPayload = {
        errorId: `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        merchantId,
        affectedTables,
        snapshotData,
        expectedData,
        errorContext: contextDescription
      };

      await this.handleTelemetryDispatch(payload);
      return false; // فشل التحقق، يتم إيقاف العملية فوراً وعزلها
    }
    return true; // العملية سليمة
  }

  // 2. معالجة الإرسال أو الحفظ المحلي بناءً على حالة الشبكة
  private static async handleTelemetryDispatch(payload: TelemetryPayload): Promise<void> {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        await this.sendToServer(payload);
      } catch (err) {
        await this.saveLocally(payload);
      }
    } else {
      await this.saveLocally(payload);
    }
  }

  // 3. الحفظ في قاعدة البيانات المحلية (Offline Mode)
  private static async saveLocally(payload: TelemetryPayload): Promise<void> {
    if (typeof window === 'undefined') return;
    const offlineQueue = JSON.parse(localStorage.getItem('jam_telemetry_queue') || '[]');
    offlineQueue.push(payload);
    localStorage.setItem('jam_telemetry_queue', JSON.stringify(offlineQueue));
    console.warn('⚠️ تم رصد خلل محاسبي وحفظ التقرير محلياً (أوفلاين):', payload.errorId);
  }

  // 4. الشحن إلى السيرفر الخاص بك أو إلى Firestore systemLogs مباشرة للوحة التحكم
  public static async sendToServer(payload: TelemetryPayload): Promise<void> {
    let apiSuccess = false;
    try {
      const response = await fetch('/api/telemetry/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        apiSuccess = true;
      }
    } catch {
      apiSuccess = false;
    }

    if (!apiSuccess) {
      // Fallback: Write directly to Firestore 'systemLogs' collection so SuperAdmin receives telemetry error reports
      try {
        const { db } = await import('../firebase');
        const { collection, addDoc } = await import('firebase/firestore');
        await addDoc(collection(db, 'systemLogs'), {
          type: 'telemetry_error',
          errorId: payload.errorId,
          merchantId: payload.merchantId,
          affectedTables: payload.affectedTables,
          errorContext: payload.errorContext,
          snapshotData: payload.snapshotData || null,
          expectedData: payload.expectedData || null,
          createdAt: payload.timestamp || new Date().toISOString(),
          source: 'offline_telemetry_queue'
        });
      } catch (fsErr) {
        throw new Error('All telemetry sync routes failed: ' + String(fsErr));
      }
    }
  }

  // 5. دالة تُستدعى تلقائياً أول ما يتصل العميل بالإنترنت (تعمل في الخلفية)
  static async syncOfflineTelemetry(): Promise<void> {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    const offlineQueue: TelemetryPayload[] = JSON.parse(localStorage.getItem('jam_telemetry_queue') || '[]');
    if (offlineQueue.length === 0) return;

    console.log(`🔄 جاري شحن ${offlineQueue.length} تقارير أخطاء معلقة للسيرفر...`);
    for (const payload of offlineQueue) {
      try {
        await this.sendToServer(payload);
        // إزالة التقرير الذي نُقل بنجاح
        const currentQueue = JSON.parse(localStorage.getItem('jam_telemetry_queue') || '[]');
        const filtered = currentQueue.filter((q: TelemetryPayload) => q.errorId !== payload.errorId);
        localStorage.setItem('jam_telemetry_queue', JSON.stringify(filtered));
      } catch (err) {
        break; // توقف مؤقتاً إذا سقط السيرفر مجدداً
      }
    }
  }

  // 6. تحميل وتطبيق الترقيعات البرمجية اللحظية (Hotfix Dynamic Loader)
  static async fetchAndApplyHotfixes(): Promise<void> {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    try {
      console.log('[JAM Self-Healing] Checking for new dynamic hotfixes from global registry...');
      
      const scriptId = 'jam-global-hotfixes-script';
      let existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.remove();
      }
      
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `/global_hotfixes.js?t=${Date.now()}`;
      script.async = true;
      
      script.onload = () => {
        const activeCount = (window as any).__JAM_GLOBAL_HOTFIX_REGISTRY__?.length || 0;
        console.log(`[JAM Self-Healing] Dynamic hotfixes loaded successfully! Active patches: ${activeCount}`);
        
        // بث حدث داخلي لتحديث واجهة المستخدم بالمؤشرات اللحظية للترقيع الكودي
        const event = new CustomEvent('JAM_HOTFIXES_UPDATED', { 
          detail: { 
            version: (window as any).__JAM_GLOBAL_HOTFIX_VERSION__, 
            hotfixes: (window as any).__JAM_GLOBAL_HOTFIX_REGISTRY__ 
          } 
        });
        window.dispatchEvent(event);
      };
      
      script.onerror = (err) => {
        console.warn('[JAM Self-Healing] Dynamic hotfixes script unavailable or offline mode active.');
      };
      
      document.body.appendChild(script);
    } catch (err) {
      console.error('[JAM Self-Healing] Failed during hotfixes fetch process:', err);
    }
  }
}

// تفعيل ميزان المراقبة لعودة الإنترنت والتحميل الفوري للترقيعات
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    AccountingTelemetry.syncOfflineTelemetry().catch(console.error);
    AccountingTelemetry.fetchAndApplyHotfixes().catch(console.error);
  });

  // التحميل الفوري عند إقلاع صفحة العميل لأول مرة
  setTimeout(() => {
    AccountingTelemetry.fetchAndApplyHotfixes().catch(console.error);
  }, 3000);
}
