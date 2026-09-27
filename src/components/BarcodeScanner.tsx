import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Zap, ZapOff, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose?: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const handleClose = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
    } catch (err) {
      console.error("Error stopping scanner on manual close:", err);
    } finally {
      onClose?.();
    }
  };

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      Camera.requestPermissions().catch(err => console.warn('Silent native camera request error:', err));
    }
    const html5QrCode = new Html5Qrcode("reader", {
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
        const onScanSuccess = async (decodedText: string) => {
          try {
            if (scannerRef.current?.isScanning) {
              await scannerRef.current.stop();
            }
            onScan(decodedText);
            onClose?.();
          } catch (err) {
            console.error("Error stopping scanner on scan success:", err);
            onScan(decodedText);
            onClose?.();
          }
        };

        const config = {
          fps: 60, // 60 FPS لسرعة مسح فائقة جداً ومستمرة
          qrbox: (width: number, height: number) => ({
            width: Math.min(width * 0.9, 300),
            height: Math.min(height * 0.6, 160)
          }),
          aspectRatio: 1.333333, // 4:3 aspect ratio لتوسيع مساحة الرؤية للباركود المستطيل
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true // استخدام كاشف الباركود العتادي الذكي المدمج في نظام التشغيل
          }
        };

        try {
          // Attempt high-performance launch with rear camera facingMode directly
          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            () => {}
          );
        } catch (envErr) {
          console.warn("Failed starting with environment facingMode, falling back to camera list:", envErr);
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const backCamera = cameras.find(cam => cam.label.toLowerCase().includes('back')) || cameras[0];
            await html5QrCode.start(
              backCamera.id,
              config,
              onScanSuccess,
              () => {}
            );
          } else {
            throw new Error("No cameras detected.");
          }
        }

        // Check for torch support
        const state = html5QrCode.getRunningTrackCapabilities();
        if (state && (state as any).torch) {
          setHasTorch(true);
        }
        setIsInitializing(false);
      } catch (err) {
        console.error("Error starting scanner:", err);
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
  }, [onScan, onClose]);

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
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={handleClose} 
        className="absolute inset-0 bg-navy-900/80 backdrop-blur-md" 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.9 }} 
        className="relative w-full max-w-md bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-4 bg-navy-900 text-white flex items-center justify-between">
          <h3 className="font-bold">ماسح الباركود (كاميرا)</h3>
          <div className="flex items-center gap-2">
            {hasTorch && (
              <button 
                onClick={toggleTorch} 
                className={`p-2 rounded-full transition-colors ${isTorchOn ? 'bg-brand-primary text-white' : 'hover:bg-white/10'}`}
                title="فلاش"
              >
                {isTorchOn ? <Zap size={20} /> : <ZapOff size={20} />}
              </button>
            )}
            <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="p-4">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border-2 border-dashed border-gray-200 dark:border-navy-700 bg-black">
            <div id="reader" className="w-full h-full"></div>
            {isInitializing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-navy-900/50">
                <RefreshCw className="animate-spin mb-2" size={32} />
                <p className="text-sm">جاري تشغيل الكاميرا...</p>
              </div>
            )}
            {/* Scanner Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-72 h-36 border-2 border-brand-primary/40 rounded-2xl relative shadow-[0_0_20px_rgba(59,130,246,0.15)] bg-black/10">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-primary rounded-tl-xl"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-primary rounded-tr-xl"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-primary rounded-bl-xl"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-primary rounded-br-xl"></div>
                {/* Scanning Line */}
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-primary to-transparent shadow-[0_0_15px_#3b82f6] animate-scan"></div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-gray-500">
            ضع الباركود في منتصف الشريط المستطيل للمسح الفوري التلقائي
          </p>
        </div>
      </motion.div>
    </div>
  );
}
