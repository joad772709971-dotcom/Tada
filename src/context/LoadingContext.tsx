import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface LoadingContextType {
  isProcessing: boolean;
  startProcessing: (message?: string) => void;
  stopProcessing: () => void;
  processingMessage: string;
  showLegacyUIBorders: boolean;
  setLegacyUIBorders: (val: boolean) => void;
  showLegacyLoadingSpinners: boolean;
  setLegacyLoadingSpinners: (val: boolean) => void;
  globalActionTimeout: number;
  setGlobalActionTimeout: (val: number) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('جاري تنفيذ العملية...');
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  const [showLegacyUIBorders, setLegacyUIBordersState] = useState(false);
  const [showLegacyLoadingSpinners, setLegacyLoadingSpinnersState] = useState(false);

  const [globalActionTimeout, setGlobalActionTimeoutState] = useState<number>(() => {
    const saved = localStorage.getItem('globalActionTimeout');
    return saved !== null ? Number(saved) : 0;
  });

  const setGlobalActionTimeout = useCallback((val: number) => {
    setGlobalActionTimeoutState(val);
    localStorage.setItem('globalActionTimeout', String(val));
  }, []);

  // Synchronize with database config in real-time
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'config'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const disableSpin = !!data.disableSpinners;
        const disableBorders = !!data.disableButtonBorders;

        setLegacyLoadingSpinnersState(!disableSpin);
        setLegacyUIBordersState(!disableBorders);

        // Class toggling on body for extreme CSS overriding flexibility
        if (disableSpin) {
          document.body.classList.add('disable-spinners');
        } else {
          document.body.classList.remove('disable-spinners');
        }

        if (disableBorders) {
          document.body.classList.add('disable-button-borders');
        } else {
          document.body.classList.remove('disable-button-borders');
        }
      }
    }, (err) => {
      console.warn("LoadingContext subscription to system/config warning:", err);
    });
    return () => unsub();
  }, []);

  const setLegacyUIBorders = useCallback((val: boolean) => {
    setLegacyUIBordersState(val);
  }, []);

  const setLegacyLoadingSpinners = useCallback((val: boolean) => {
    setLegacyLoadingSpinnersState(val);
  }, []);

  const startProcessing = useCallback((message?: string) => {
    if (message) setProcessingMessage(message);
    else setProcessingMessage('جاري تنفيذ العملية...');
    
    setIsProcessing(true);
    
    // Only show the loading UI if it takes more than 3 seconds
    const t = setTimeout(() => {
      // Respect the global loading spinners option
      if (showLegacyLoadingSpinners) {
        setShowLoading(true);
      }
    }, 3000);
    setTimer(t);
  }, [showLegacyLoadingSpinners]);

  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    setShowLoading(false);
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }
  }, [timer]);

  const memoizedValue = useMemo(() => ({
    isProcessing: showLoading, 
    startProcessing, 
    stopProcessing, 
    processingMessage,
    showLegacyUIBorders,
    setLegacyUIBorders,
    showLegacyLoadingSpinners,
    setLegacyLoadingSpinners,
    globalActionTimeout,
    setGlobalActionTimeout
  }), [
    showLoading,
    startProcessing,
    stopProcessing,
    processingMessage,
    showLegacyUIBorders,
    setLegacyUIBorders,
    showLegacyLoadingSpinners,
    setLegacyLoadingSpinners,
    globalActionTimeout,
    setGlobalActionTimeout
  ]);

  return (
    <LoadingContext.Provider value={memoizedValue}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}
