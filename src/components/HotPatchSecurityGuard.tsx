import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, ShieldCheck, ShieldAlert, Activity, CheckCircle2, RefreshCw, X, ChevronUp, ChevronDown, Bug, Terminal } from 'lucide-react';
import { liveHotFixEngine, HotFixPatchPayload } from '../services/LiveHotFixEngine';
import { hotPatchSecurityGuardService, IntegrityCheckReport } from '../services/HotPatchSecurityGuard';

export default function HotPatchSecurityGuard() {
  const [currentPatch, setCurrentPatch] = useState<HotFixPatchPayload | null>(null);
  const [integrityReport, setIntegrityReport] = useState<IntegrityCheckReport | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [interceptedLogs, setInterceptedLogs] = useState<Array<{ time: string; error: string; handledByPatch: boolean }>>([]);

  useEffect(() => {
    // Start engine subscription
    liveHotFixEngine.initialize();

    const unsubscribe = liveHotFixEngine.subscribe((patch) => {
      setCurrentPatch(patch);
      if (patch) {
        setShowToast(true);
        // Perform integrity check
        hotPatchSecurityGuardService.performIntegrityCheck(patch).then((rep) => {
          setIntegrityReport(rep);
        });

        // Hide toast after 6 seconds unless expanded
        const timer = setTimeout(() => {
          setShowToast(false);
        }, 6000);
        return () => clearTimeout(timer);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleManualIntegrityCheck = async () => {
    const rep = await hotPatchSecurityGuardService.performIntegrityCheck(currentPatch);
    setIntegrityReport(rep);
    setInterceptedLogs(liveHotFixEngine.getInterceptedLogs());
  };

  // Run engine silently in background - hide visual bottom toast per user request
  return null;
}
