import { Capacitor } from '@capacitor/core';
import { Camera, PermissionStatus as CameraPermissionStatus } from '@capacitor/camera';
import { PushNotifications, PermissionStatus as PushPermissionStatus } from '@capacitor/push-notifications';
import { Device } from '@capacitor/device';
import { db, messaging } from '../firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';

/**
 * JAM System Pro - Hardware & Device Service
 * Handles Capacitor integration, permissions, and FCM configurations.
 */
export const hardwareService = {
  isNative: () => Capacitor.isNativePlatform(),
  getPlatform: () => Capacitor.getPlatform(),

  checkPermissions: async () => {
    if (!Capacitor.isNativePlatform()) return { camera: 'granted', push: 'granted', mic: 'granted' };
    
    const cameraPerm: CameraPermissionStatus = await Camera.checkPermissions();
    const pushPerm: PushPermissionStatus = await PushNotifications.checkPermissions();
    
    return {
      camera: cameraPerm.camera,
      push: pushPerm.receive,
      platform: Capacitor.getPlatform()
    };
  },

  requestPermissions: async () => {
    if (!Capacitor.isNativePlatform()) return true;
    
    await Camera.requestPermissions();
    await PushNotifications.requestPermissions();
    return true;
  },

  saveTokenToProfile: async (uid: string, token: string, type: 'web' | 'native') => {
    if (!uid) return;
    try {
      await updateDoc(doc(db, 'users', uid), {
        fcmTokens: arrayUnion({
          token,
          type,
          platform: Capacitor.getPlatform(),
          updatedAt: new Date().toISOString()
        }),
        updatedAt: serverTimestamp()
      });
      console.log(`FCM ${type} token saved for user ${uid}`);
    } catch (e) {
      console.error('Failed to save FCM token:', e);
    }
  },

  initPushNotifications: async (uid?: string) => {
    if (!Capacitor.isNativePlatform()) {
      // WEB FCM
      if (messaging && uid) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const token = await getToken(messaging, {
              // Note: VAPID key is usually required for some browsers. 
              // If not provided, it might work in some or fail in others.
              // vapidKey: 'YOUR_PUBLIC_VAPID_KEY' 
            });
            if (token) {
              await hardwareService.saveTokenToProfile(uid, token, 'web');
            }
          }
        } catch (e) {
          console.warn('Web FCM Token failed:', e);
        }
      }
      return;
    }

    // NATIVE CAPACITOR FCM
    // Bypassed on native mobile platforms to prevent crashes related to missing google-services.json or signature mismatches (especially on locally-signed APKs via MT Manager).
    console.log('📲 Native platform detected: Bypassing native PushNotifications.register() to avoid Firebase native initialization crashes.');
    return;
  },

  // 📡 طلب إذن وفحص البلوتوث الحقيقي (Web Bluetooth & Native)
  requestBluetoothPermission: async (): Promise<{ success: boolean; deviceName?: string; error?: string }> => {
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
        try {
          const device = await (navigator as any).bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['generic_access', 0x18f0, '000018f0-0000-1000-8000-00805f9b34fb']
          });
          const deviceName = device?.name || 'طابعة بلوتوث مقترنة';
          localStorage.setItem('jam_bt_connected_device', deviceName);
          return { success: true, deviceName };
        } catch (btErr: any) {
          if (btErr.name === 'NotFoundError' || btErr.message?.includes('cancelled') || btErr.message?.includes('canceled')) {
            return { success: false, error: 'تم إلغاء اختيار جهاز البلوتوث' };
          }
          return { success: false, error: btErr.message || 'تعذر الاتصال بالبلوتوث' };
        }
      } else {
        return { success: false, error: 'المتصفح الحالي لا يدعم Web Bluetooth، يرجى استخدام Chrome أو تطبيق الأندرويد' };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطأ أثناء طلب البلوتوث' };
    }
  },

  // 🔔 طلب إذن الإشعارات الحقيقي (Web Notifications & Native)
  requestNotificationPermission: async (): Promise<{ status: NotificationPermission; granted: boolean }> => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          return { status: 'granted', granted: true };
        }
        const perm = await Notification.requestPermission();
        return { status: perm, granted: perm === 'granted' };
      }
      return { status: 'denied', granted: false };
    } catch (err) {
      console.warn('Failed to request notification permission:', err);
      return { status: 'denied', granted: false };
    }
  },

  // 📶 فحص حالة شبكة الواي فاي والاتصال الفعلي مع قياس الاستجابة
  checkWifiNetworkStatus: async (): Promise<{ isOnline: boolean; type?: string; rtt?: number; speed?: number }> => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const connection = typeof navigator !== 'undefined' ? ((navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection) : null;
    
    let rtt = connection?.rtt || 25;
    let speed = connection?.downlink || 10;
    let type = connection?.effectiveType || (isOnline ? 'wifi/fast' : 'offline');

    // Ping check for 100% genuine latency
    try {
      const start = performance.now();
      await fetch('/api/health', { method: 'HEAD', cache: 'no-store' });
      rtt = Math.round(performance.now() - start);
    } catch {
      // Offline fallback
    }

    return {
      isOnline,
      type,
      rtt,
      speed
    };
  },

  // 🎙️ طلب إذن الميكروفون المباشر الحقيقي (Web Audio & Native)
  requestMicrophonePermission: async (): Promise<{ granted: boolean; error?: string }> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the tracks immediately after permission is granted
        stream.getTracks().forEach(track => track.stop());
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('jam_mic_permission_granted', 'true');
          localStorage.setItem('jam_perm_granted_microphone', 'true');
        }
        return { granted: true };
      }
      return { granted: false, error: 'واجهة الميكروفون غير مدعومة في هذا الجهاز' };
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return { granted: false, error: 'تم رفض إذن الميكروفون' };
      }
      return { granted: false, error: err?.message || 'تعذر تشغيل الميكروفون' };
    }
  }
};
