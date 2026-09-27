importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

// These values are hardcoded from the project config
// In a real build process, these might be injected, but for for this environment's constraints, 
// we use the current config values.
firebase.initializeApp({
  apiKey: "AIzaSyDwa1Ov1a5tokg99-OwLURJgmUp3WGjxSs",
  authDomain: "gen-lang-client-0254582746.firebaseapp.com",
  projectId: "gen-lang-client-0254582746",
  storageBucket: "gen-lang-client-0254582746.firebasestorage.app",
  messagingSenderId: "42821148982",
  appId: "1:42821148982:web:ede80af5ec502e2f1f5397"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  let notificationTitle = payload.notification ? payload.notification.title : 'إشعار جديد';
  let notificationOptions = {
    body: payload.notification ? payload.notification.body : '',
    icon: 'https://raw.githubusercontent.com/manhalf/JAM-System-Pro-Assets/main/logo_3d.png',
    data: payload.data || {}
  };

  // 1. Check for incoming call signal in remoteMessage background handler
  const isIncomingCall = payload.data && (payload.data.type === 'INCOMING_CALL' || payload.data.type === 'call_signal' || payload.data.action === 'call' || payload.data.status === 'ringing');

  if (isIncomingCall) {
    const callerName = payload.data.callerName || 'عميل أو مورد جديد';
    const roomId = payload.data.roomId || 'auto_room';
    
    notificationTitle = "📞 اتصال وارد: " + callerName;
    notificationOptions.body = "يريد الاتصال بك صوتياً ومباشرة عبر نظام JAM System Pro";
    
    // Inject custom properties to trigger android priority & sound
    notificationOptions.sound = 'default';
    notificationOptions.vibrate = [200, 100, 200, 100, 200, 100, 200];
    
    // Set priority and flag options for Android system forced attention
    notificationOptions.android = {
      priority: 'high',
      sound: 'default',
      vibrate: [200, 100, 200, 100, 200, 100, 200],
      category: 'call',
      fullScreenIntent: true,
      ongoing: true
    };

    // Client communication: awake windows/tabs to show the fullscreen ringing overlay
    if (self.clients && typeof self.clients.matchAll === 'function') {
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url && typeof client.focus === 'function') {
            // Wake up client and transmit call details
            client.postMessage({
              type: 'INCOMING_CALL',
              callerName: callerName,
              roomId: roomId
            });
            client.focus();
          }
        }
      });
    }
  }

  return self.registration.showNotification(notificationTitle, notificationOptions);
});
