import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDwa1Ov1a5tokg99-OwLURJgmUp3WGjxSs",
  authDomain: "gen-lang-client-0254582746.firebaseapp.com",
  projectId: "gen-lang-client-0254582746",
  storageBucket: "gen-lang-client-0254582746.appspot.com",
  messagingSenderId: "1036814343169",
  appId: "1:1036814343169:web:9c97ebc10b7b15d9a9bd65"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-46e704b0-7071-4e96-b782-8132930c4d92");

async function pushLiveLoginUpdate() {
  console.log("🚀 Starting OTA Live Push via Firebase Web SDK...");

  const customStyles = `
    /* 📱 OTA Live HotFix: Mobile Login Window Optimization & Enlarged Branding */
    #login-shop-title {
      font-size: 1.75rem !important;
      line-height: 2.25rem !important;
      letter-spacing: 0.025em !important;
      margin-top: 1rem !important;
    }
    #username-field-container, #password-field-container {
      margin-top: 1rem !important;
    }
    #username-field-container input, #password-field-container input {
      padding-top: 0.875rem !important;
      padding-bottom: 0.875rem !important;
    }
    /* Enlarged Logo and Enhanced Cyber Glow for Installed Devices */
    .jam-logo-svg, svg[viewBox="0 0 100 100"] {
      width: 135px !important;
      height: 135px !important;
      transition: transform 0.3s ease !important;
    }
  `;

  const dynamicCode = `
    try {
      console.log('⚡ [OTA Live Engine] Applying Mobile Login Viewport Redesign...');
      const applyLoginAdjustments = () => {
        const titleEl = document.getElementById('login-shop-title');
        if (titleEl) {
          const card = titleEl.closest('div[class*="rounded"]');
          if (card) {
            card.style.maxWidth = '420px';
            card.style.borderRadius = '2.5rem';
            card.style.padding = '1.75rem 1.5rem';
          }
        }
        const svg = document.querySelector('svg[viewBox="0 0 100 100"]');
        if (svg) {
          svg.style.width = '135px';
          svg.style.height = '135px';
        }
      };
      applyLoginAdjustments();
      setTimeout(applyLoginAdjustments, 300);
      setTimeout(applyLoginAdjustments, 1000);
    } catch(err) {
      console.warn('OTA Login adjustments notice:', err);
    }
  `;

  const patchPayload = {
    patchId: "patch-v3.0.2-mobile-login-redesign",
    version: "3.0.2",
    timestamp: new Date().toISOString(),
    title: "تحديث فوري لواجهة تسجيل الدخول وتكبير الشعار للشاشات الذكية",
    description: "توسيع شاشة الدخول عمودياً وتكبير أيقونة النظام وحل استثناء حساب المالك المطور",
    isMandatory: true,
    active: true,
    customStylesOrNotice: customStyles,
    dynamicBundleCode: dynamicCode,
    ruleModifiers: {
      autoRecoverNetworkErrors: true,
      autoRecoverMathErrors: true,
      allowZeroPriceItems: false
    }
  };

  try {
    const patchDocRef = doc(db, 'emergency_hotfixes', 'global_patch');
    await setDoc(patchDocRef, patchPayload, { merge: true });
    console.log("✅ Successfully pushed live hotfix patch to Firestore emergency_hotfixes/global_patch!");
    console.log("📡 All connected and installed apps will immediately receive and render this redesign!");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Failed to push live hotfix to Firestore:", error);
    process.exit(1);
  }
}

pushLiveLoginUpdate();
