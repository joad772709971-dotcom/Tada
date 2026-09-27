import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, RefreshCw, Zap, ZapOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

interface BarcodeScannerProps {
  onScanSuccess: (barcodeText: string, type: string) => void;
  onScanError?: (error: string) => void;
  onClose?: () => void;
}

/**
 * مكون قراءة الباركود الذكي (Universal Barcode Scanner) لبرنامج JAM System Pro
 * يدعم: كاميرا الجوال الخلفية الافتراضية، كاميرا الويب، القارئ السلكي، والعمل أوفلاين بالكامل مع واجهة عربية
 */
export const JAMBarcodeEngine: React.FC<BarcodeScannerProps> = ({ onScanSuccess, onScanError, onClose }) => {
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  
  // لضمان عدم تكرار المسح السريع جداً لنفس الكود
  const lastCodeRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);

  // Ref to hold the buffer and last keypress timestamp for zero-lag hardware reading
  const keyBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    // -------------------------------------------------------------
    // 1. دعم الكمبيوتر (القارئ السلكي/اللاسلكي الخارجي - Hardware Scanner)
    // -------------------------------------------------------------
    const handleHardwareScan = (e: KeyboardEvent) => {
      // Ignore modifier keys to prevent unintended captures
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      
      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Scanners transmit characters at lightning speed (typically < 35ms per keystroke).
      // If the delay is larger than 60ms, the user is typing manually; reset buffer.
      if (keyBufferRef.current.length > 0 && timeDiff > 60) {
        keyBufferRef.current = '';
      }

      if (e.key === 'Enter') {
        const rawCode = keyBufferRef.current;
        // Strict background input cleansing engine: strip tabs, returns, control bytes, and spaces
        const cleansedCode = rawCode
          .trim()
          .replace(/[\r\n\t]/g, '')
          .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
          .replace(/\s+/g, '');

        if (cleansedCode.length >= 2) {
          console.log(`📡 [JAM Hardware Logic] Scanned and Cleansed: "${cleansedCode}"`);
          onScanSuccess(cleansedCode, "HARDWARE_SCANNER");
          setLastScannedCode(cleansedCode);
        }
        keyBufferRef.current = '';
      } else {
        // Build barcode from standard printable character keys
        if (e.key.length === 1) {
          keyBufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keypress', handleHardwareScan);
    return () => {
      window.removeEventListener('keypress', handleHardwareScan);
    };
  }, [onScanSuccess]);

  useEffect(() => {
    // -------------------------------------------------------------
    // 2. دعم الجوال والكمبيوتر (عبر الكاميرا - أوفلاين فوري)
    // -------------------------------------------------------------
    if (Capacitor.isNativePlatform()) {
      Camera.requestPermissions().catch(err => console.warn('Silent native camera request error:', err));
    }

    const html5QrCode = new Html5Qrcode("jam-reader-container", {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.AZTEC,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.MAXICODE,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.PDF_417,
        Html5QrcodeSupportedFormats.RSS_14,
        Html5QrcodeSupportedFormats.RSS_EXPANDED,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION
      ],
      verbose: false
    });
    scannerRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        const onScan = async (decodedText: string, decodedResult: any) => {
          const now = Date.now();
          // منع تكرار المسح لنفس الصنف في أقل من 1 ثانية للمسح الفوري المتتالي
          if (decodedText === lastCodeRef.current && now - lastTimeRef.current < 1000) return;
          
          const formats = decodedResult?.result?.format?.formatName || "UNKNOWN";
          lastCodeRef.current = decodedText;
          lastTimeRef.current = now;
          
          onScanSuccess(decodedText, formats);
          setLastScannedCode(decodedText);

          // Close the camera view immediately after successful recognition!
          if (onClose) {
            if (scannerRef.current && scannerRef.current.isScanning) {
              try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
              } catch (e) {
                console.warn("Scanner stop failed:", e);
              }
            }
            onClose();
          }
        };

        const config = {
          fps: 60, // 60 FPS لسرعة فائقة جداً في التقاط وتعرف الباركود
          qrbox: (width: number, height: number) => ({
            width: Math.min(width * 0.9, 300),
            height: Math.min(height * 0.6, 160)
          }),
          aspectRatio: 1.333333, // 4:3 aspect ratio لتوسيع زاوية الرؤية للباركود المستطيل
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true // استخدام مستشعر الباركود البرمجي/العتادي السريع إذا كان مدعوماً
          }
        };

        try {
          // بدء الكاميرا الخلفية الافتراضية فوراً دون تأخير
          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScan,
            (error) => {
              if (onScanError) onScanError(error);
            }
          );
        } catch (envErr) {
          console.warn("JAM Engine: environment facingMode failed, falling back to camera list:", envErr);
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const backCamera = cameras.find(cam => cam.label.toLowerCase().includes('back')) || cameras[0];
            await html5QrCode.start(
              backCamera.id,
              config,
              onScan,
              (error) => {
                if (onScanError) onScanError(error);
              }
            );
          } else {
            throw new Error("No cameras detected.");
          }
        }

        // الكشف التلقائي عن دعم الفلاش (Torch)
        const state = html5QrCode.getRunningTrackCapabilities();
        if (state && (state as any).torch) {
          setHasTorch(true);
        }
        setIsInitializing(false);
      } catch (err) {
        console.error("Error starting JAM scanner engine:", err);
        setIsInitializing(false);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
        }).catch(err => console.error("Error stopping scanner:", err));
      }
    };
  }, [onScanSuccess, onScanError]);

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const newState = !isTorchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: newState }] as any
      });
      setIsTorchOn(newState);
    } catch (err) {
      console.error("Error toggling torch:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm bg-navy-900 text-white rounded-[2.5rem] border-2 border-[#d4af37]/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative animate-fade-in"
      >
        <div className="p-5 flex items-center justify-between border-b border-white/5 bg-navy-950/30">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-[#d4af37]/20 rounded-xl">
                <RefreshCw size={20} className="text-[#d4af37] animate-spin-slow" />
             </div>
             <div className="text-right">
                <h3 className="text-sm font-black text-[#d4af37] tracking-wider">محرك الفحص الذكي JAM</h3>
                <p className="text-[9px] text-gray-400 font-bold tracking-widest">تحديد تلقائي وسريع للباركود</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            {hasTorch && (
              <button 
                onClick={toggleTorch} 
                className={`p-2 rounded-full transition-all ${isTorchOn ? 'bg-[#d4af37] text-black' : 'hover:bg-white/5 text-gray-400'}`}
                title="إضاءة فلاش"
              >
                {isTorchOn ? <Zap size={18} /> : <ZapOff size={18} />}
              </button>
            )}
            {onClose && (
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <div className="p-4">
          <div className="relative overflow-hidden rounded-[1.5rem] bg-black border border-white/10 aspect-[4/3]">
            <div id="jam-reader-container" className="w-full h-full"></div>
            
            {isInitializing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-navy-900/90 z-20">
                <RefreshCw className="animate-spin mb-3 text-[#d4af37]" size={36} />
                <p className="text-xs font-bold text-gray-300">جاري تشغيل الكاميرا الخلفية الفورية...</p>
              </div>
            )}

            {/* Overlay indicators */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
               <div className="w-72 h-36 border-2 border-[#d4af37]/40 rounded-2xl relative shadow-[0_0_20px_rgba(212,175,55,0.15)]">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#d4af37] rounded-tl-xl"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#d4af37] rounded-tr-xl"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#d4af37] rounded-bl-xl"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#d4af37] rounded-br-xl"></div>
                  <div className="absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent shadow-[0_0_15px_#d4af37] animate-scan-slow" />
               </div>
            </div>
          </div>

          <AnimatePresence>
            {lastScannedCode && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-4 p-4 bg-emerald-500/10 rounded-2xl text-center border border-emerald-500/20"
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                   <span className="text-[10px] text-emerald-400 font-bold">تم التعرف على الرمز بنجاح</span>
                </div>
                <span className="font-mono text-lg text-white font-black tracking-widest">{lastScannedCode}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 text-center">
            <p className="text-[10px] text-gray-400 font-bold leading-relaxed px-4 text-right">
              ⌨️ القارئ اللاسلكي الخارجي نشط وتلقائي في الخلفية. 
              <br />
              وجه عدسة الكاميرا الخلفية أو جهاز الليزر السلكي نحو باركود الصنف للمسح الفوري.
            </p>
          </div>
        </div>
      </motion.div>

      <style>{`
        .animate-spin-slow { animation: spin 10s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-scan-slow {
          position: absolute;
          animation: scan 3s linear infinite;
        }
        @keyframes scan {
          0% { top: 10%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
        #jam-reader-container button {
          background: #d4af37 !important;
          color: black !important;
          border: none !important;
          border-radius: 12px !important;
          padding: 8px 16px !important;
          font-weight: 900 !important;
          font-size: 10px !important;
          text-transform: uppercase !important;
          margin-top: 10px !important;
        }
        #jam-reader-container select {
          background: #1a1a1c !important;
          color: white !important;
          border: 1px solid #d4af3733 !important;
          border-radius: 8px !important;
          padding: 4px !important;
          font-size: 12px !important;
        }
      `}</style>
    </div>
  );
};
