import { useState, useCallback } from 'react';
import { generateUUID } from '../firebase';

/**
 * Universal Global UI Debounce & Idempotency Hook
 * Automatically handles double-clicks, button disabling, loading states,
 * and generates a unique client-side UUID (transaction_id).
 */
export function useDebouncedSubmit(defaultTimeout = 1500) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const executeSubmit = useCallback(async (
    submitFn: (transactionId: string) => Promise<void> | void,
    customTimeout?: number
  ) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    // Generate a secure client-side transaction_id UUID
    const transactionId = generateUUID();
    
    const lockTimeout = customTimeout !== undefined ? customTimeout : defaultTimeout;
    
    // Set a safety timeout that re-enables the button after 2000ms max to prevent freezing
    const safetyTimer = setTimeout(() => {
      setIsSubmitting(false);
    }, Math.min(2000, lockTimeout));

    try {
      await submitFn(transactionId);
    } catch (error) {
      console.error('Idempotent action failed:', error);
      throw error;
    } finally {
      clearTimeout(safetyTimer);
      setTimeout(() => {
        setIsSubmitting(false);
      }, Math.min(300, lockTimeout));
    }
  }, [isSubmitting, defaultTimeout]);

  return {
    isSubmitting,
    executeSubmit
  };
}
