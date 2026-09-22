import { useState, useCallback, useRef } from 'react';
import { useLoading } from '../context/LoadingContext';

interface DebounceOptions {
  delay?: number;
  bypassForComponents?: string[]; // المكونات المستثناة من التجميد مثل سلة البيع
}

export function useSmartSubmit(options: DebounceOptions = {}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastClickTime = useRef<number>(0);
  const { globalActionTimeout } = useLoading();

  const executeSecureAction = useCallback((action: () => Array<any> | any, componentName?: string) => {
    if (globalActionTimeout === 0) {
      try {
        action();
      } catch (err) {
        console.error('⚡ SmartSubmit Instant Action Error:', err);
      }
      return;
    }

    // إذا كان المكون تابعاً لسلة البيع أو الكتالوج أو التجزئة، نفذ الإجراء في الحال دون أي تأخير أو قفل لتفادي التجميد
    const nameLower = (componentName || '').toLowerCase();
    const isBypass = nameLower.includes('pos') || 
                     nameLower.includes('basket') || 
                     nameLower.includes('cart') || 
                     nameLower.includes('catalog') || 
                     nameLower.includes('sale') ||
                     options.bypassForComponents?.includes(componentName || '');

    if (isBypass) {
      try {
        action();
      } catch (err) {
        console.error('⚡ SmartSubmit Action Bypass Error:', err);
      }
      return;
    }

    const now = Date.now();
    const activeDelay = globalActionTimeout !== undefined ? globalActionTimeout : (options.delay || 1000);

    if (now - lastClickTime.current < activeDelay) {
      console.warn(`🔒 [JAM Safe-Guard]: Fast click blocked on sensitive action for security.`);
      return; // تجاهل النقرة السريعة جداً لمنع تكرار الفواتير
    }

    lastClickTime.current = now;
    setIsSubmitting(true);
    
    try {
      action();
    } finally {
      // إزالة التجميد بعد انتهاء العملية البرمجية لضمان عدم تعليق الزر
      setTimeout(() => setIsSubmitting(false), Math.min(300, activeDelay));
    }
  }, [globalActionTimeout, options.delay, options.bypassForComponents]);

  return { isSubmitting: globalActionTimeout === 0 ? false : isSubmitting, executeSecureAction };
}
