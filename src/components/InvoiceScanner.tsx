import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  X, 
  Loader2, 
  Sparkles,
  FileText,
  AlertCircle,
  Save,
  Trash2,
  Info,
  CheckCircle2
} from 'lucide-react';
import { collection, addDoc, serverTimestamp, getDocs, query, where, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { DevicePermissionsService } from '../services/DevicePermissionsService';

const getApiUrl = (endpoint: string): string => {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  
  // Try environment variables first
  let env_url = (import.meta as any).env?.VITE_APP_URL || '';
  if (env_url && !env_url.includes('localhost')) {
    const domain = env_url.endsWith('/') ? env_url.slice(0, -1) : env_url;
    return `${domain}${endpoint}`;
  }
  
  // Try window.location if not local or capacitor
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    const origin = window.location.origin;
    if (host && host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.') && !origin.includes('capacitor://')) {
      return `${origin}${endpoint}`;
    }
  }

  // Fallback to active system Run URL
  const backend = 'https://ais-dev-cpravmzzzjg3jsiayido7z-320469830981.europe-west1.run.app';
  return `${backend}${endpoint}`;
};


interface InvoiceScannerProps {
  profile: UserProfile | null;
  onNewItemsAdded?: () => void;
}

interface ScannedItem {
  id?: string;
  name: string;
  quantity: number;
  cost: number;
  price?: number;
  category: string;
}

export default function InvoiceScanner({ profile, onNewItemsAdded }: InvoiceScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ScannedItem[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  
  // Camera specific states
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDrafts();
  }, [profile?.ownerId]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => console.warn("Video play error:", err));
    }
  }, [stream, showLiveCamera]);

  // Handle closing camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stream]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultBase64 = reader.result as string;
        const cleanBase64 = resultBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
        processSecureCloudOCR(cleanBase64);
      };
      reader.readAsDataURL(file);
    }
  };

  const fetchDrafts = async () => {
    if (!profile?.ownerId) return;
    setIsLoadingDrafts(true);
    try {
      const q = query(collection(db, 'inventory_drafts'), where('ownerId', '==', profile.ownerId));
      const snap = await getDocs(q);
      setDrafts(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ScannedItem)));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'inventory_drafts');
      console.error('Error fetching drafts:', error);
    } finally {
      setIsLoadingDrafts(false);
    }
  };

  const startHDCamera = async () => {
    await DevicePermissionsService.requestOnDemand('camera');
    setCameraError(null);
    setShowLiveCamera(true);
    try {
      const constraints = {
        video: {
          width: { ideal: 1920 }, // Full HD high resolution to capture pristine details
          height: { ideal: 1080 },
          facingMode: { ideal: "environment" }, // Rear camera preferred on mobile
          focusMode: { ideal: "continuous" } as any, // Advanced continuous autofocus
          videoStabilizationMode: { ideal: "auto" } as any // Optical/digital anti-shake
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("❌ Failed to initiate Full HD camera:", err);
      // Fallback with basic constraints
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (fallbackError) {
        setCameraError("لم نتمكن من الوصول لعدسة الكاميرا. يرجى مراجعة صلاحيات الكاميرا في جهازك أو استخدام خيار المعرض.");
        setShowLiveCamera(false);
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowLiveCamera(false);
  };

  const captureImageAndProcess = async () => {
    if (!videoRef.current || !canvasRef.current || !stream || isScanning) return;

    setIsScanning(true);
    setStatus(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Preserve exact HD camera aspect ratios with absolute coordinates
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    if (context) {
      // Draw frame snapshot onto canvas context immediately
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Full fidelity image output (1.0 jpeg encoding compression) preventing numeric pixelation
      const base64DataFull = canvas.toDataURL('image/jpeg', 1.0);
      const cleanBase64 = base64DataFull.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

      // Shut down stream to save battery and computing load
      stopCamera();

      await processSecureCloudOCR(cleanBase64);
    }
  };

  const handleCaptureFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const resultBase64 = reader.result as string;
      const cleanBase64 = resultBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
      processSecureCloudOCR(cleanBase64);
    };
    reader.readAsDataURL(file);
  };

  const processSecureCloudOCR = async (base64Image: string) => {
    setIsScanning(true);
    setStatus(null);
    try {
      // POST securely using the secure server route we just deployed
      const response = await fetch(getApiUrl('/api/ai/ocr'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: base64Image })
      });

      let responseData;
      try {
        const cloned = response.clone();
        const text = await cloned.text();
        if (text.trim().startsWith('<') || text.trim().toLowerCase().startsWith('<!doctype')) {
          throw new Error('تلقينا استجابة غير صالحة من نظام تحليل الصور (تنسيق HTML بدلاً من JSON). قد يكون هذا بسبب مشكلة في الاتصال بالشبكة.');
        }
        responseData = await response.json();
      } catch (parseError: any) {
        throw new Error('فشل معالجة رد الخادم الرقمي: ' + parseError.message);
      }

      if (!response.ok) {
        throw new Error(responseData.error || 'فشلت معالجة الخادم الذكي للبيانات.');
      }

      const extractedItems = responseData.items;

      if (!Array.isArray(extractedItems) || extractedItems.length === 0) {
        throw new Error("لم نتمكن من استخلاص قائمة أصناف صالحة من هذه الصورة.");
      }

      // Save to drafts in Firestore
      const batch = writeBatch(db);
      for (const item of extractedItems) {
        const draftRef = doc(collection(db, 'inventory_drafts'));
        batch.set(draftRef, {
          name: item.name || 'مادة مستخرجة',
          quantity: typeof item.quantity === 'number' ? item.quantity : 1,
          cost: typeof item.cost === 'number' ? item.cost : 0,
          price: typeof item.price === 'number' ? item.price : ((typeof item.cost === 'number' ? item.cost : 0) * 1.25),
          category: item.category || 'عام',
          unit: item.unit || 'حبة',
          ownerId: profile?.ownerId,
          createdAt: serverTimestamp()
        });
      }
      await batch.commit();
      
      await fetchDrafts();
      setStatus({ type: 'success', message: `نجح استخراج الأصناف وتطابق الأعمدة! تم العثور على (${extractedItems.length}) أصناف مضافة للمسودة حالياً` });
    } catch (error: any) {
      console.error('AI Processing Error:', error);
      setStatus({ type: 'error', message: error.message || 'فشلت الخدمة الذكية في قراءة الجدول. يرجى توجيه الصورة بوضوح للضوء.' });
    } finally {
      setIsScanning(false);
    }
  };

  const updateDraftField = (id: string, field: keyof ScannedItem, value: any) => {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const approveDraft = async (draft: ScannedItem) => {
    if (!profile?.ownerId || !draft.id) return;
    try {
      // 20% margin if retail pricing is not defined or is 0
      const price = draft.price && draft.price > 0 ? draft.price : draft.cost * 1.2;
      
      await addDoc(collection(db, 'inventory'), {
        ownerId: profile.ownerId,
        name: draft.name,
        stock: Number(draft.quantity) || 1,
        cost: Number(draft.cost) || 0,
        price: Number(price) || 0,
        category: draft.category || 'المخل',
        minStock: 5,
        type: 'scanned',
        barcode: `SCAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        units: [],
        compatibilityList: []
      });

      // Remove from interim staging draft
      await deleteDoc(doc(db, 'inventory_drafts', draft.id));
      setDrafts(prev => prev.filter(d => d.id !== draft.id));
      
      if (onNewItemsAdded) onNewItemsAdded();
      
      setStatus({ type: 'success', message: `تم ترحيل [${draft.name}] بنجاح إلى المخزن الرئيسي` });
    } catch (error) {
      console.error('Approval Error:', error);
    }
  };

  const approveAllDrafts = async () => {
    if (!profile?.ownerId || drafts.length === 0) return;
    setIsLoadingDrafts(true);
    try {
      for (const draft of drafts) {
        const price = draft.price && draft.price > 0 ? draft.price : draft.cost * 1.2;
        await addDoc(collection(db, 'inventory'), {
          ownerId: profile.ownerId,
          name: draft.name,
          stock: Number(draft.quantity) || 1,
          cost: Number(draft.cost) || 0,
          price: Number(price) || 0,
          category: draft.category || 'عام',
          minStock: 5,
          type: 'scanned',
          barcode: `SCAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          units: [],
          compatibilityList: []
        });

        if (draft.id) {
          await deleteDoc(doc(db, 'inventory_drafts', draft.id));
        }
      }
      setDrafts([]);
      if (onNewItemsAdded) onNewItemsAdded();
      setStatus({ type: 'success', message: 'تمت إضافة جميع الأصناف إلى المخزن الرئيسي بنجاح! 🎉' });
    } catch (error) {
      console.error('Approve All Error:', error);
      setStatus({ type: 'error', message: 'حدث خطأ أثناء ترحيل بعض المسودات' });
    } finally {
      setIsLoadingDrafts(false);
    }
  };

  const deleteDraft = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'inventory_drafts', id));
      setDrafts(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Delete Draft Error:', error);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-150 pb-4 dark:border-navy-800">
        <div>
          <h1 className="text-3xl font-black text-navy-905 dark:text-white flex items-center gap-3">
            <Sparkles className="text-yellow-500 animate-pulse" />
            ماسح الفواتير بالذكاء الاصطناعي
          </h1>
          <p className="text-sm text-gray-500 font-bold mt-1">
            قارئ الأوراق والوثائق المحاسبية الذكي لفرز الأصناف تلقائياً دون كتابة يدوية.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-3 py-1.5 rounded-xl font-bold border border-yellow-500/20">
          <Info size={14} className="shrink-0" />
          معدل طلبات آمن ومجاني 100% (Gemini Flash Model)
        </div>
      </div>

      {cameraError && (
        <div className="p-4 bg-red-500/10 text-red-600 border border-red-500/20 rounded-2xl flex items-center gap-3 font-bold text-sm">
          <AlertCircle size={20} />
          {cameraError}
        </div>
      )}

      {/* Main scanner view container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left pane: Live HD Feed or Trigger view */}
        <div className="lg:col-span-4 space-y-4">
          
          <AnimatePresence mode="wait">
            {!showLiveCamera ? (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`p-8 rounded-[2rem] border-2 text-white text-center space-y-6 shadow-2xl relative overflow-hidden transition-all duration-300 ${
                  isDragActive 
                    ? "bg-amber-950/40 border-dashed border-amber-500 scale-105" 
                    : "bg-gradient-to-br from-slate-900 to-black border-slate-800"
                }`}
              >
                <div className="absolute -right-16 -top-16 w-36 h-36 bg-yellow-600/10 rounded-full blur-2xl" />
                <div className="absolute -left-16 -bottom-16 w-36 h-36 bg-blue-600/10 rounded-full blur-2xl" />
                
                <div className="w-20 h-20 bg-yellow-500/10 text-yellow-500 border border-yellow-500/35 rounded-3xl flex items-center justify-center mx-auto shadow-inner relative group">
                  <Camera size={38} className="transition-transform group-hover:scale-110" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white">قارئ الفواتير والأسعار بالفيديو</h3>
                  <p className="text-xs text-gray-400 leading-relaxed font-bold">
                    افتح الكاميرا عالية الجودة مباشرة لمسح المستند الورقي، مسح رقمي عالي الدقة Full HD وتدريج تلقائي مستمر لمنع غباش النصوص.
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button 
                    onClick={startHDCamera}
                    disabled={isScanning}
                    className="w-full py-3 px-5 bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 rounded-2xl font-black shadow-lg shadow-yellow-500/20 hover:from-yellow-400 hover:to-amber-500 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    <Camera size={18} />
                    فتح كاميرا المسح الفوري
                  </button>

                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleCaptureFile}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="w-full py-3 px-5 bg-slate-800 text-gray-200 rounded-2xl font-black border border-slate-700 hover:bg-slate-700 transition-all flex items-center justify-center gap-2 text-xs"
                  >
                    <Upload size={16} />
                    اختيار صورة من المعرض
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="camera-container"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-black rounded-[2rem] border-2 border-yellow-500/40 overflow-hidden relative aspect-[3/4] shadow-2xl"
              >
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                
                <canvas ref={canvasRef} className="hidden" />

                {/* Laser scan line simulation */}
                <div className="absolute left-0 right-0 h-0.5 bg-yellow-500 shadow-[0_0_12px_#eab308] opacity-75 top-[20%] animate-bounce transform translate-y-full" style={{ animationDuration: '3s' }} />

                {/* Scope frame overlay */}
                <div className="absolute inset-0 border-2 border-dashed border-yellow-500/25 rounded-2xl m-6 flex flex-col justify-between p-4 pointer-events-none">
                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-l-2 border-t-2 border-yellow-500" />
                    <div className="w-5 h-5 border-r-2 border-t-2 border-yellow-500" />
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] bg-slate-900/90 text-yellow-400 font-mono px-3 py-1 rounded-full border border-yellow-500/30">
                      وضع دقة FHD 1080p نشط
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-l-2 border-b-2 border-yellow-500" />
                    <div className="w-5 h-5 border-r-2 border-b-2 border-yellow-500" />
                  </div>
                </div>

                {/* Control Action Overlays */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 px-4 z-10">
                  <button 
                    onClick={captureImageAndProcess}
                    disabled={isScanning}
                    className="px-6 py-3.5 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 text-sm"
                  >
                    <CheckCircle2 size={18} />
                    التقط واقرأ الآن
                  </button>
                  <button 
                    onClick={stopCamera}
                    className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-2xl transition-all"
                    title="إغلاق الكاميرا"
                  >
                    <X size={20} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick tips */}
          <div className="bg-gray-50 dark:bg-navy-800 p-4 rounded-2xl border border-gray-150 dark:border-navy-700 space-y-2">
            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 leading-none">
              <Info size={14} className="text-yellow-600 dark:text-yellow-400" />
              توجيهات لنتائج مثالية:
            </h4>
            <ul className="text-[11px] text-gray-500 space-y-1 pl-4 leading-relaxed font-bold">
              <li>١. التقط الصورة من الأعلى عمودياً لمنع انكسار النصوص.</li>
              <li>٢. تجنب الظلال واللمعان الزائد على الورقة.</li>
              <li>٣. يدعم لقط السطور المتوازية ذات الدقة والوضوح التام.</li>
            </ul>
          </div>
        </div>

        {/* Right pane: Draft management & Approval table */}
        <div className="lg:col-span-8 space-y-4">
          
          <AnimatePresence>
            {status && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-xs ${
                  status.type === 'success' 
                  ? 'bg-success/10 text-success border border-success/20' 
                  : 'bg-danger/10 text-danger border border-danger/20'
                }`}
              >
                <AlertCircle size={16} />
                {status.message}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="card-glass border border-gray-150 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-xl overflow-hidden rounded-[2rem]">
            
            {/* Table Header block */}
            <div className="p-4 sm:p-6 bg-slate-900 dark:bg-slate-950 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="text-yellow-500 animate-pulse" size={18} />
                <h3 className="text-sm sm:text-md font-bold text-white">الأصناف المستخلصة بانتظار ترحيلها للمخزن</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-yellow-500 text-slate-950 px-3 py-1 rounded-full text-[10px] font-black tracking-wider shadow-md">
                  {drafts.length} أصناف
                </span>
                {drafts.length > 0 && (
                  <button
                    onClick={approveAllDrafts}
                    className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition active:scale-95 flex items-center gap-1 cursor-pointer"
                  >
                    <Save size={14} />
                    <span>اعتماد الكل للمخزن ({drafts.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Table body content */}
            <div className="p-0">
              {isLoadingDrafts ? (
                <div className="text-center py-24 flex flex-col items-center gap-3 text-gray-400">
                  <Loader2 className="animate-spin text-yellow-500" size={36} />
                  <p className="font-bold text-xs">جاري تحميل مسودات القراءة الذكية...</p>
                </div>
              ) : drafts.length === 0 ? (
                <div className="text-center py-20 text-gray-500 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-navy-700/5 dark:bg-navy-700/25 rounded-full flex items-center justify-center border border-gray-150 dark:border-navy-600">
                    <FileText className="opacity-20 text-gray-400" size={28} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-black text-slate-800 dark:text-gray-200">صندوق المسودات فارغ حالياً</p>
                    <p className="text-xs text-gray-400 font-bold max-w-sm">ارفع صورة فاتورة أو شغل كاميرا المسح الفوري لتدوين البيانات هنا لمراجعتها واعتمادها بضغطة زر</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead className="bg-gray-50 dark:bg-navy-900/60 border-b border-gray-150 dark:border-navy-700">
                      <tr className="text-[11px] text-gray-400 font-black uppercase">
                        <th className="p-3">الصنف المستخلص (name)</th>
                        <th className="p-3">الفئة (category)</th>
                        <th className="p-3">الكمية (stock)</th>
                        <th className="p-3">التكلفة (cost)</th>
                        <th className="p-3">سعر البيع (price)</th>
                        <th className="p-3 text-center">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
                      {drafts.map((draft) => (
                        <tr key={draft.id} className="group hover:bg-yellow-500/5 transition-colors">
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={draft.name}
                              onChange={(e) => updateDraftField(draft.id!, 'name', e.target.value)}
                              className="w-full bg-slate-900/80 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-slate-100 font-bold focus:border-yellow-500 outline-none"
                              placeholder="اسم الصنف"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={draft.category}
                              onChange={(e) => updateDraftField(draft.id!, 'category', e.target.value)}
                              className="w-28 bg-slate-900/80 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-slate-300 font-semibold focus:border-yellow-500 outline-none"
                              placeholder="الفئة"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              value={draft.quantity}
                              onChange={(e) => updateDraftField(draft.id!, 'quantity', Number(e.target.value))}
                              className="w-16 bg-slate-900/80 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-yellow-400 font-black text-center focus:border-yellow-500 outline-none"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              value={draft.cost}
                              onChange={(e) => updateDraftField(draft.id!, 'cost', Number(e.target.value))}
                              className="w-24 bg-slate-900/80 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-slate-200 font-bold text-center focus:border-yellow-500 outline-none"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              value={draft.price || Math.round((draft.cost || 0) * 1.25)}
                              onChange={(e) => updateDraftField(draft.id!, 'price', Number(e.target.value))}
                              className="w-24 bg-slate-900/80 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-emerald-400 font-bold text-center focus:border-yellow-500 outline-none"
                            />
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center justify-center gap-1.5">
                              <button 
                                onClick={() => approveDraft(draft)}
                                className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg hover:scale-105 active:scale-95 transition-all shadow-md shadow-emerald-500/10 flex items-center justify-center cursor-pointer"
                                title="ترحيل وإضافة للمخزن"
                              >
                                <Save size={15} />
                              </button>
                              <button 
                                onClick={() => deleteDraft(draft.id!)}
                                className="p-1.5 bg-red-500/15 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all flex items-center justify-center cursor-pointer"
                                title="حذف المسودة"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isScanning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center text-white"
          >
            <div className="relative">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="w-48 h-48 rounded-full border-4 border-t-yellow-500 border-r-transparent border-b-blue-500 border-l-transparent"
              />
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-yellow-500 animate-pulse" size={56} />
            </div>
            
            <div className="mt-12 text-center space-y-3 px-4">
              <h2 className="text-3xl font-black tracking-tight flex items-center justify-center gap-3">
                <span className="inline-block w-3.5 h-3.5 bg-yellow-550 rounded-full animate-ping" />
                معالجة ذكاء اصطناعي آمنة ومجانية
              </h2>
              <p className="text-sm text-gray-350 max-w-md mx-auto leading-relaxed font-bold">
                يقوم محرك الـ AI OCR الآن بتحليل الجدول وفهرسته وتفكيك الأسعار لتوفير الجهد والسرعة بالكامل...
              </p>
              
              <div className="flex gap-2 justify-center pt-8">
                {[1, 1.2, 0.8, 1.1, 0.9].map((s, i) => (
                  <motion.div 
                    key={i}
                    animate={{ height: [16, 36, 21, 31, 16] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
                    className="w-1.5 bg-yellow-500 rounded-full"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
