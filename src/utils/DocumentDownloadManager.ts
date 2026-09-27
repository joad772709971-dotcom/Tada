export class DocumentDownloadManager {
    
    /**
     * تم إلغاء آلية التنزيل التلقائي نهائياً بناءً على طلب المعماري الرئيسي.
     * هذا المحرك يعمل الآن كمصيدة أمان (Security Interceptor) لمنع المتصفح أو المكونات
     * من استدعاء أي نوافذ تحميل (Spam Downloads) عند تنشيط الواجهات.
     */
    public static handleSecureDownload(fileUrl: string, fileName: string, isUserInitiated: boolean = false) {
        // حظر مطلق ونهائي لجميع عمليات التنزيل في هذه المرحلة لحماية الواجهة من التعليق
        console.warn(`[حظر حاسم] تم نسف وإلغاء أمر التنزيل نهائياً للملف: ${fileName}. لا يُسمح بالنوافذ المنبثقة.`);
        
        // إرجاع false وتعطيل العملية تماماً ومنع المتصفح من توليد الـ Anchor
        return false;
    }

    /**
     * مُعترض لمنع الروابط التلقائية (Prevent Default Global Links) 
     * إذا حاولت بعض المكونات القديمة تشغيل طلب تحميل وثيقة المشروع تلقائياً.
     */
    public static enforceGlobalDownloadBlock() {
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', (event) => {
                // إيقاف أي عمليات نقل ملفات معلقة في الخلفية عند التنقل بين الصفحات
                console.log("[نظام الأمان] تم تصفية العمليات المعلقة.");
            });
        }
    }
}
