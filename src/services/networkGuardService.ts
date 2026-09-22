/**
 * 🛡️ networkGuardService.ts
 * ----------------------------------------------------
 * خدمة تنظيم العمليات الشبكية وفصل العمليات (Online-Only vs Offline-Capable)
 * 
 * القواعد المعتمدة:
 * 1. العمليات التي تعمل أوفلاين 100% (Offline-Capable):
 *    - المبيعات ونقاط البيع (POS & Cashier)
 *    - فواتير المبيعات والمرتجعات
 *    - سندات القبض والصرف والقيود اليومية
 *    - حركة المخازن والجرد وتعديل الكميات محلياً
 *    - التحقق المشفر من ترخيص وصلاحية الاشتراك (AntiTamper Vault)
 * 
 * 2. العمليات التي تشترط وجود إنترنت (Online-Only):
 *    - إنشاء حساب محل جديد (تسجيل المحل والمصادقة المركزية)
 *    - إنشاء حساب موظف أو زبون جديد في Firebase Auth
 *    - توليد كود الارتباط بالسوق (B2B Link Code)
 *    - ربط متجر بمتجر آخر في السوق العام
 *    - إرسال طلبات الشراء والمناقصات إلى السوق
 *    - المراسلة والدردشة المباشرة بين المحلات أو بين المتجر والزبون
 */

export type OnlineOnlyOperation = 
  | 'create_shop'
  | 'create_user'
  | 'generate_market_code'
  | 'market_link'
  | 'send_market_order'
  | 'cross_store_chat'
  | 'publish_market_item';

export interface GuardBlockEventDetail {
  operation: OnlineOnlyOperation;
  title: string;
  reason: string;
  timestamp: number;
}

const OPERATION_DESCRIPTIONS: Record<OnlineOnlyOperation, { title: string; reason: string }> = {
  create_shop: {
    title: 'إنشاء حساب متجر جديد',
    reason: 'يتطلب إنشاء المحل اتصالاً بالإنترنت لتأمين معرّف الحساب في قاعدة البيانات المركزية وتوثيقه سحابياً.'
  },
  create_user: {
    title: 'إنشاء حساب موظف أو زبون',
    reason: 'يتطلب تسجيل الموظف أو الزبون اتصالاً بالإنترنت للتحقق من أمان البريد وكلمة المرور في منظومة المصادقة السحابية.'
  },
  generate_market_code: {
    title: 'توليد كود ارتباط السوق',
    reason: 'يتطلب توليد وتوثيق كود الربط اتصالاً بالإنترنت للتحقق من عدم تكراره ومزامنته في دليل B2B العام.'
  },
  market_link: {
    title: 'الارتباط بمتجر آخر في السوق',
    reason: 'يتطلب إنشاء رابط العمل بين المحلين اتصالاً بالإنترنت لتبادل الموافقات وحدود الائتمان بصورة لحظية.'
  },
  send_market_order: {
    title: 'إرسال طلبات السوق B2B',
    reason: 'يتطلب إرسال الطلبات إلى التاجر الآخر اتصالاً بالإنترنت لضمان استلام المورد للإشعار فوراً.'
  },
  cross_store_chat: {
    title: 'المراسلة بين المحلات والزبائن',
    reason: 'تتطلب غرف المحادثة والرسائل اتصالاً بالإنترنت لنقل الرسائل بصورة حية ومشفرة.'
  },
  publish_market_item: {
    title: 'نشر صنف في السوق العام',
    reason: 'يتطلب نشر العروض والكتالوجات في السوق السحابي اتصالاً بالإنترنت لتظهر لبقية التجار.'
  }
};

class NetworkGuardService {
  /**
   * فحص الاتصال بالإنترنت
   */
  public isOnline(): boolean {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  }

  /**
   * فحص إمكانية تنفيذ العملية:
   * إذا كان الجهاز أوفلاين وكانت العملية تشترط إنترنت، يتم إطلاق تنبيه ومنع العملية
   */
  public requireOnline(
    operation: OnlineOnlyOperation, 
    customMessage?: string
  ): { allowed: boolean; message?: string } {
    if (this.isOnline()) {
      return { allowed: true };
    }

    const info = OPERATION_DESCRIPTIONS[operation] || {
      title: 'عملية سحابية مشتركة',
      reason: 'هذه العملية تتطلب اتصالاً بالإنترنت للتحقق المركزي والمزامنة.'
    };

    const message = customMessage || `${info.reason}\n(ملاحظة: عمليات المبيعات والفواتير والجرد وسندات اليومية تعمل بالكامل دون إنترنت).`;

    // إطلاق حدث تنبيهي عام للواجهات
    if (typeof window !== 'undefined') {
      const detail: GuardBlockEventDetail = {
        operation,
        title: info.title,
        reason: message,
        timestamp: Date.now()
      };
      window.dispatchEvent(new CustomEvent('jam:network_guard_block', { detail }));
    }

    return { allowed: false, message };
  }

  /**
   * التأكيد الفوري، يلقي خطأ لطيفاً باللغة العربية إذا كان غير متصل
   */
  public assertOnline(operation: OnlineOnlyOperation, customMessage?: string): void {
    const check = this.requireOnline(operation, customMessage);
    if (!check.allowed) {
      throw new Error(check.message);
    }
  }

  /**
   * الاستماع لتغيرات حالة الاتصال
   */
  public onStatusChange(callback: (online: boolean) => void): () => void {
    if (typeof window === 'undefined') return () => {};

    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
}

export const networkGuardService = new NetworkGuardService();
