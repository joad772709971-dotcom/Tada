import { useEffect } from 'react';

// تراكيب واجهات الأحداث والوظائف المستهدفة بالنظام
export interface JamGlobalActions {
  // 1. اختصارات التنقل والواجهات العامة
  toggleSidePanel: () => void;
  navigateToWallet: () => void;
  navigateToChat: () => void;
  navigateToInventory: () => void;
  navigateToMarket: () => void;
  navigateToPortal: () => void;
  
  // 2. اختصارات النوافذ والمستندات المالية الحية
  openReceiveRemittance: () => void; // استلام حوالة (Alt + R)
  openSendRemittance: () => void;    // إرسال حوالة (Alt + S)
  openHandoverCustody: () => void;   // تسليم عهدة (Alt + H)
  openCashReceiptVoucher: () => void; // سند قبض مالي (Alt + V)
  
  // 3. أزرار التحكم الصارمة والترقيع المباشر
  activeModalIsOpen: boolean;        // مؤشر فحص ما إذا كان هناك نافذة مفتوحة حالياً
  onGlobalConfirm: () => void;       // تنفيذ الموافقة والترحيل (Enter)
  onGlobalCancel: () => void;        // إلغاء الحركة وإغلاق اللوحة (Escape)
  onGlobalDeleteRow?: () => void;     // حذف الصنف أو البند المحدد (Delete)
}

export const useJamUniversalKeyboardShortcuts = (actions: JamGlobalActions) => {
  useEffect(() => {
    const handleUniversalKeyDown = (e: KeyboardEvent) => {
      
      // ========================================================
      // أولاً: التحقق من حقول الإدخال النصي ومرحلة تركيب الحروف (IME Composition)
      // حماية كتابة النصوص والأسماء في الهواتف ولوحات المفاتيح اللمسية
      // ========================================================
      const target = e.target as HTMLElement | null;
      const isTypingInField = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );

      // إذا كان المستخدم يكتب بنشاط في أي حقل، أو أثناء تركيب الحروف العربية، لا يتم اعتراض المفاتيح
      if (isTypingInField || e.isComposing) {
        // نسمح فقط بـ Escape لإلغاء النوافذ إذا رغب المستخدم
        if (e.key === 'Escape' && actions.activeModalIsOpen) {
          e.preventDefault();
          actions.onGlobalCancel();
        }
        return;
      }

      // ========================================================
      // ثانياً: معالجة أزرار التحكم الصارمة [Enter - Esc - Delete] (تشتغل فقط إذا كانت هناك نافذة مفتوحة ولم يكن المستخدم بداخل حقل كتابة)
      // ========================================================
      if (actions.activeModalIsOpen) {
        switch (e.key) {
          case 'Enter':
            e.preventDefault();
            console.log('⌨️ نظام التحكم الفوري: تم ترحيل واعتِماد الحركة ماليّاً عبر مفتاح [Enter]');
            actions.onGlobalConfirm();
            return;

          case 'Escape':
            e.preventDefault();
            console.log('⌨️ نظام التحكم الفوري: تم إلغاء المعاملة وإغلاق اللوحة عبر مفتاح [Esc]');
            actions.onGlobalCancel();
            return;

          case 'Delete':
            if (actions.onGlobalDeleteRow) {
              // التحقق من أن المستخدم لا يكتب بداخل حقل إدخال نصي عادي عند الضغط على Delete
              const activeTag = (e.target as HTMLElement).tagName;
              if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
                e.preventDefault();
                console.log('⌨️ نظام التحكم الفوري: تم إصدار أمر حذف البند المحدد عبر مفتاح [Delete]');
                actions.onGlobalDeleteRow();
                return;
              }
            }
            break;

          default:
            break;
        }
      }

      // ========================================================
      // ثانياً: معالجة اختصارات الـ Alt للواجهات والعمليات المالية اليومية
      // ========================================================
      if (!e.altKey) return; // تجاهل أي ضغطة عادية ما لم يتم دمجها مع زر Alt

      const key = e.key.toLowerCase();

      switch (key) {
        // --- الفئة أ: التنقل الجغرافي واللوحات الرئيسية ---
        case 'n': // Alt + N -> القائمة الجانبية الموحدة والإشعارات
          e.preventDefault();
          actions.toggleSidePanel();
          console.log('⌨️ اختصار كيبورد: فتح/إغلاق القائمة الجانبية للرقابة');
          break;
        
        case 'w': // Alt + W -> المحفظة والصناديق المالية
          e.preventDefault();
          actions.navigateToWallet();
          console.log('⌨️ اختصار كيبورد: الانتقال الفوري للمحفظة الموحدة');
          break;

        case 'c': // Alt + C -> مركز الدردشة والتواصل الذكي
          e.preventDefault();
          actions.navigateToChat();
          console.log('⌨️ اختصار كيبورد: الانتقال الفوري لمركز الدردشة الذكي');
          break;

        case 'i': // Alt + I -> إدارة المخازن والجرد
          e.preventDefault();
          actions.navigateToInventory();
          console.log('⌨️ اختصار كيبورد: فتح وإدارة مستودعات المخزون المتوفر');
          break;

        case 'm': // Alt + M -> سوق الجملة المفتوح للـ B2B
          e.preventDefault();
          actions.navigateToMarket();
          console.log('⌨️ اختصار كيبورد: تصفح سوق الجملة للـ Wholesaler');
          break;

        case 'p': // Alt + P -> بوابة التجارة الذكية للزبائن والعملاء
          e.preventDefault();
          actions.navigateToPortal();
          console.log('⌨️ اختصار كيبورد: فتح الـ Smart Portal للعملاء');
          break;

        // --- الفئة ب: الحركات السريعة وسندات الصندوق المستندية ---
        case 'r': // Alt + R -> استلام حوالة (Receive)
          e.preventDefault();
          actions.openReceiveRemittance();
          console.log('⌨️ اختصار مالي: فتح لوحة استلام وتوجيه حوالة ماليّة');
          break;

        case 's': // Alt + S -> إرسال حوالة وتوريدها للشركة (Send)
          e.preventDefault();
          actions.openSendRemittance();
          console.log('⌨️ اختصار مالي: فتح نموذج إرسال وتوريد حوالة جديدة');
          break;

        case 'h': // Alt + H -> تسليم وصرف عهدة للموظف أو السائق (Handover)
          e.preventDefault();
          actions.openHandoverCustody();
          console.log('⌨️ اختصار مالي: فتح شاشة صرف وتصفيَة العُهد');
          break;

        case 'v': // Alt + V -> تحرير سند قبض نقدي فوري (Voucher)
          e.preventDefault();
          actions.openCashReceiptVoucher();
          console.log('⌨️ اختصار مالي: إنشاء وترحيل سند قبض مالي مباشر للمحل');
          break;

        default:
          break;
      }
    };

    // تثبيت المستمع العالمي في نظام الويندوز والأندرويد
    window.addEventListener('keydown', handleUniversalKeyDown);
    
    // تنظيف المستمع عند تنظيف الواجهة لمنع تسريب الذاكرة وثقل المعالجة
    return () => {
      window.removeEventListener('keydown', handleUniversalKeyDown);
    };
  }, [actions]);
};
