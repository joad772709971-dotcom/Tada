import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: "com.jam.store",
  appName: "Jam store",
  webDir: "dist",
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#05070e",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    Camera: {
      presentationOptions: ["alert"]
    }
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    backgroundColor: "#05070e"
  },
  // Request Bluetooth Connect, Bluetooth Scan, Wake Lock & Media Permissions
  server: {
    androidScheme: "https"
  }
};

// Documented hardware & service permissions requested by JAM PRO:
// - FOREGROUND_SERVICE & FOREGROUND_SERVICE_MEDIA_PLAYBACK
// - WAKE_LOCK
// - READ_EXTERNAL_STORAGE / READ_MEDIA_AUDIO / READ_MEDIA_VIDEO
// - BLUETOOTH_CONNECT / BLUETOOTH_SCAN / ACCESS_WIFI_STATE

export default config;

