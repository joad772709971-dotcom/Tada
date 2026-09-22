import React, { useState, useEffect } from 'react';
import { 
  Bluetooth, 
  Wifi, 
  Share2, 
  MapPin, 
  Camera, 
  FileSpreadsheet, 
  Bell, 
  Layers, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles,
  X
} from 'lucide-react';
import { UserProfile } from '../types';

interface SequentialPermissionWizardModalProps {
  userProfile?: UserProfile | null;
  onComplete?: () => void;
}

interface PermissionStep {
  id: string;
  title: string;
  icon: any;
  color: string;
  badgeBg: string;
  description: string;
  benefit: string;
  browserApi?: () => Promise<boolean>;
}

export default function SequentialPermissionWizardModal({
  userProfile,
  onComplete
}: SequentialPermissionWizardModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [grantedPermissions, setGrantedPermissions] = useState<Record<string, boolean>>({});

  const permissionSteps: PermissionStep[] = [
    {
      id: 'bluetooth',
      title: 'إذن اتصال البلوتوث (Bluetooth)',
      icon: Bluetooth,
      color: 'text-blue-400',
      badgeBg: 'bg-blue-500/10 border-blue-500/30',
      description: 'الاتصال المباشر مع طابعات الفواتير المحمولة وقارئ الباركود اللاسلكي.',
      benefit: 'طباعة الفواتير على طابعات البلوتوث المحمولة فوراً دون أسلاك.',
      browserApi: async () => {
        if ('bluetooth' in navigator) {
          try {
            await (navigator as any).bluetooth.getAvailability();
            return true;
          } catch (e) {
            return true;
          }
        }
        return true;
      }
    },
    {
      id: 'wifi',
      title: 'إذن الشبكة المحلية والواي فاي (Wi-Fi)',
      icon: Wifi,
      color: 'text-cyan-400',
      badgeBg: 'bg-cyan-500/10 border-cyan-500/30',
      description: 'مزامنة البيانات بين كاشيرات المحل والفروع عبر الشبكة الداخلية بسرعة فائقة.',
      benefit: 'ربط أجهزة الكاشير والمستودعات في المحل بشكل لحظي.',
      browserApi: async () => true
    },
    {
      id: 'share',
      title: 'إذن مشاركة الفواتير (WhatsApp / SMS)',
      icon: Share2,
      color: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/10 border-emerald-500/30',
      description: 'إرسال صور الفواتير وسندات القبض مباشرة للواتساب والرسائل النصية للزبائن.',
      benefit: 'إرسال فاتورة رقمية للعميل بكبسة زر واحدة.',
      browserApi: async () => true
    },
    {
      id: 'location',
      title: 'إذن تحديد الموقع الجغرافي (Location)',
      icon: MapPin,
      color: 'text-amber-400',
      badgeBg: 'bg-amber-500/10 border-amber-500/30',
      description: 'تسجيل موقع بيع الفاتورة وتأكيد وجود الموظف في الفرع المحدد.',
      benefit: 'حماية النظام وحصر المبيعات داخل نطاق الفرع الجغرافي.',
      browserApi: async () => {
        return new Promise((resolve) => {
          if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
              () => resolve(true),
              () => resolve(true),
              { timeout: 3000 }
            );
          } else {
            resolve(true);
          }
        });
      }
    },
    {
      id: 'camera',
      title: 'إذن الكاميرا ومسح الباركود (Camera)',
      icon: Camera,
      color: 'text-rose-400',
      badgeBg: 'bg-rose-500/10 border-rose-500/30',
      description: 'التقاط صور المنتجات وقطع الغيار وقراءة الباركود وQR السريع للفواتير.',
      benefit: 'مسح الباركود بالكاميرا وإدراج الصور للمنتجات بسرعة.',
      browserApi: async () => {
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
          }
        } catch (e) {
          return true;
        }
        return true;
      }
    },
    {
      id: 'storage',
      title: 'إذن الملفات والتصدير والرفع (Excel / PDF)',
      icon: FileSpreadsheet,
      color: 'text-purple-400',
      badgeBg: 'bg-purple-500/10 border-purple-500/30',
      description: 'تصدير التقارير والفواتير بصيغ Excel و PDF وقراءة ملفات الاستيراد الذكي.',
      benefit: 'حفظ التقارير على جهازك واستيراد جداول المنتجات المخزنية.',
      browserApi: async () => true
    },
    {
      id: 'notifications',
      title: 'إذن الإشعارات والتنبيهات (Notifications)',
      icon: Bell,
      color: 'text-yellow-400',
      badgeBg: 'bg-yellow-500/10 border-yellow-500/30',
      description: 'تنبيهك فوراً بالنواقص والديون المستحقة والطلبات الجديدة الصادرة من الزباين.',
      benefit: 'عدم تفويت أي تنبيه مالي أو طلب صيانة جديد.',
      browserApi: async () => {
        if ('Notification' in window) {
          try {
            const res = await Notification.requestPermission();
            return res === 'granted';
          } catch (e) {
            return true;
          }
        }
        return true;
      }
    },
    {
      id: 'overlay',
      title: 'إذن العرض فوق التطبيقات الأخرى (System Overlay)',
      icon: Layers,
      color: 'text-teal-400',
      badgeBg: 'bg-teal-500/10 border-teal-500/30',
      description: 'إظهار نافذة الكاشير والتنبيهات المستعجلة فوق التطبيقات الأخرى عند استلام طلب.',
      benefit: 'سرعة الاستجابة لطلبات العاديين والزبائن فور ورودها.',
      browserApi: async () => true
    }
  ];

  useEffect(() => {
    if (!userProfile) return;
    const uid = userProfile.uid || 'guest';
    const hasConfiguredKey = `jam_permissions_granted_v2_${uid}`;
    const alreadyDone = localStorage.getItem(hasConfiguredKey);
    if (!alreadyDone) {
      setIsOpen(true);
    }
  }, [userProfile]);

  if (!isOpen) return null;

  const currentStep = permissionSteps[currentStepIndex];
  const StepIcon = currentStep.icon;

  const handleNextPermission = async () => {
    try {
      if (currentStep.browserApi) {
        await currentStep.browserApi();
      }
    } catch (e) {
      console.log('Permission step requested:', currentStep.id);
    }

    setGrantedPermissions(prev => ({ ...prev, [currentStep.id]: true }));

    if (currentStepIndex < permissionSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Finished all 8 permissions
      if (userProfile?.uid) {
        localStorage.setItem(`jam_permissions_granted_v2_${userProfile.uid}`, 'true');
      }
      setIsOpen(false);
      if (onComplete) onComplete();
    }
  };

  const handleGrantAll = async () => {
    const allDone: Record<string, boolean> = {};
    for (const step of permissionSteps) {
      allDone[step.id] = true;
      if (step.browserApi) {
        try { await step.browserApi(); } catch (e) {}
      }
    }
    setGrantedPermissions(allDone);
    if (userProfile?.uid) {
      localStorage.setItem(`jam_permissions_granted_v2_${userProfile.uid}`, 'true');
    }
    setIsOpen(false);
    if (onComplete) onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 dir-rtl text-right">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in duration-300 flex flex-col">
        
        {/* Top Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-2xl text-cyan-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">إعداد أذونات النظام (الأولية)</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/30">
                  {currentStepIndex + 1} من {permissionSteps.length}
                </span>
              </div>
              <p className="text-xs text-slate-400">تفعيل الأذونات التشغيلية بالتتابع لضمان عمل كافة الوظائف</p>
            </div>
          </div>

          <button
            onClick={handleGrantAll}
            className="text-xs font-bold text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700/50"
          >
            تفعيل الكل
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-950 h-1.5 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
            style={{ width: `${((currentStepIndex + 1) / permissionSteps.length) * 100}%` }}
          />
        </div>

        {/* Active Permission Step Details */}
        <div className="p-6 space-y-6 flex-1">
          <div className="text-center py-2">
            <div className={`w-20 h-20 mx-auto rounded-3xl border flex items-center justify-center mb-4 shadow-xl ${currentStep.badgeBg}`}>
              <StepIcon className={`w-10 h-10 ${currentStep.color}`} />
            </div>

            <h4 className="text-lg font-black text-white">{currentStep.title}</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              {currentStep.description}
            </p>
          </div>

          <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" /> الفائدة التلقائية للمستخدم:
            </span>
            <p className="text-xs text-slate-300 leading-relaxed pr-5">
              {currentStep.benefit}
            </p>
          </div>

          {/* List of completed steps */}
          <div className="grid grid-cols-4 gap-2 pt-2">
            {permissionSteps.map((step, idx) => {
              const isDone = idx < currentStepIndex || grantedPermissions[step.id];
              const isCurrent = idx === currentStepIndex;
              return (
                <div
                  key={step.id}
                  className={`p-2 rounded-xl border text-center text-[10px] font-bold flex flex-col items-center gap-1 ${
                    isDone
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : isCurrent
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300 animate-pulse'
                      : 'bg-slate-950/40 border-slate-800 text-slate-500'
                  }`}
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 ${isDone ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span className="truncate w-full">{step.id}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Controls */}
        <div className="p-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={handleGrantAll}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs transition-all border border-slate-700"
          >
            تخطي الأذونات الحالية
          </button>

          <button
            onClick={handleNextPermission}
            className="flex-1 py-3 px-5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black rounded-2xl text-sm transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
          >
            <span>{currentStepIndex === permissionSteps.length - 1 ? 'موافق وإكمال الإعدادات' : 'السماح والانتقال للتالي'}</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
        </div>

      </div>
    </div>
  );
}
