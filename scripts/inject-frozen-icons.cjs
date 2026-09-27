const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/**
 * 🛡️ FROZEN HARDENED ICON INJECTOR FOR ANDROID & WINDOWS BUILDS
 * Applies fixed custom icons to Capacitor Android res directories and Windows Electron build.
 */
async function injectFrozenIcons() {
  const variantCode = process.argv[2] || 'JAM_STORE';
  console.log(`🚀 Injecting Frozen Hardened Icons for variant: [${variantCode}]...`);

  // Source icon based on variant
  const isCustomerVariant = variantCode.includes('CUSTOMER') || variantCode.includes('PORTAL');
  const sourceIconPath = isCustomerVariant 
    ? 'public/assets/icons/customer-vip-icon-1024.png' 
    : 'public/assets/icons/merchant-app-icon-1024.png';

  if (!fs.existsSync(sourceIconPath)) {
    console.error(`❌ Source icon not found at: ${sourceIconPath}`);
    process.exit(1);
  }

  const iconBuffer = fs.readFileSync(sourceIconPath);

  // 1. Android Mipmap Densities & Splash Screens
  const mipmaps = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 }
  ];

  const splashConfigs = [
    { dir: 'drawable', width: 1080, height: 1920, iconSize: 320 },
    { dir: 'drawable-port-mdpi', width: 320, height: 480, iconSize: 120 },
    { dir: 'drawable-port-hdpi', width: 480, height: 800, iconSize: 180 },
    { dir: 'drawable-port-xhdpi', width: 720, height: 1280, iconSize: 260 },
    { dir: 'drawable-port-xxhdpi', width: 960, height: 1600, iconSize: 340 },
    { dir: 'drawable-port-xxxhdpi', width: 1280, height: 1920, iconSize: 420 },
    { dir: 'drawable-land-mdpi', width: 480, height: 320, iconSize: 120 },
    { dir: 'drawable-land-hdpi', width: 800, height: 480, iconSize: 180 },
    { dir: 'drawable-land-xhdpi', width: 1280, height: 720, iconSize: 260 },
    { dir: 'drawable-land-xxhdpi', width: 1600, height: 960, iconSize: 340 },
    { dir: 'drawable-land-xxxhdpi', width: 1920, height: 1280, iconSize: 420 }
  ];

  const resBase = 'android/app/src/main/res';
  if (fs.existsSync(resBase)) {
    console.log(`📱 Injecting Android Mipmaps & Splash Screens into ${resBase}...`);
    for (const m of mipmaps) {
      const targetDir = path.join(resBase, m.dir);
      fs.mkdirSync(targetDir, { recursive: true });

      const resized = await sharp(iconBuffer).resize(m.size, m.size).png().toBuffer();
      fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), resized);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), resized);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), resized);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_round_foreground.png'), resized);
      fs.writeFileSync(path.join(targetDir, 'ic_notification.png'), resized);
    }

    // Generate Custom High-End Splash Screens replacing default Capacitor logo
    for (const sc of splashConfigs) {
      const targetDir = path.join(resBase, sc.dir);
      fs.mkdirSync(targetDir, { recursive: true });

      const centeredIcon = await sharp(iconBuffer)
        .resize(sc.iconSize, sc.iconSize, { fit: 'contain' })
        .png()
        .toBuffer();

      const splashScreen = await sharp({
        create: {
          width: sc.width,
          height: sc.height,
          channels: 4,
          background: { r: 5, g: 7, b: 14, alpha: 1 } // #05070e
        }
      })
      .composite([{
        input: centeredIcon,
        gravity: 'centre'
      }])
      .png()
      .toBuffer();

      fs.writeFileSync(path.join(targetDir, 'splash.png'), splashScreen);
    }
  }

  // Also replace root splash resources
  const rootSplash = await sharp({
    create: {
      width: 1080,
      height: 1920,
      channels: 4,
      background: { r: 5, g: 7, b: 14, alpha: 1 }
    }
  })
  .composite([{
    input: await sharp(iconBuffer).resize(360, 360, { fit: 'contain' }).png().toBuffer(),
    gravity: 'centre'
  }])
  .png()
  .toBuffer();

  fs.mkdirSync('assets', { recursive: true });
  fs.mkdirSync('resources', { recursive: true });
  fs.writeFileSync('assets/splash.png', rootSplash);
  fs.writeFileSync('resources/splash.png', rootSplash);
  fs.writeFileSync('public/splash.png', rootSplash);

  // 2. Windows Icon Placement
  const publicIconsDir = 'public/assets/icons';
  fs.mkdirSync(publicIconsDir, { recursive: true });
  fs.mkdirSync('build', { recursive: true });

  try {
    const mod = require('png-to-ico');
    const pngToIco = mod.default || mod;
    const buf256 = await sharp(iconBuffer).resize(256, 256).png().toBuffer();
    const buf128 = await sharp(iconBuffer).resize(128, 128).png().toBuffer();
    const buf64 = await sharp(iconBuffer).resize(64, 64).png().toBuffer();
    const buf48 = await sharp(iconBuffer).resize(48, 48).png().toBuffer();
    const buf32 = await sharp(iconBuffer).resize(32, 32).png().toBuffer();
    const buf16 = await sharp(iconBuffer).resize(16, 16).png().toBuffer();
    const icoBuf = await pngToIco([buf256, buf128, buf64, buf48, buf32, buf16]);

    fs.writeFileSync('public/icon.ico', icoBuf);
    fs.writeFileSync('build/icon.ico', icoBuf);
    fs.writeFileSync('public/assets/icons/merchant-app-icon.ico', icoBuf);
    console.log('✅ Injected multi-resolution Windows ICO icons into public/ and build/');
  } catch (e) {
    if (fs.existsSync('public/assets/icons/merchant-app-icon.ico')) {
      fs.copyFileSync('public/assets/icons/merchant-app-icon.ico', 'public/icon.ico');
      fs.copyFileSync('public/assets/icons/merchant-app-icon.ico', 'build/icon.ico');
    }
  }

  // 3. Web & Dist Asset Brand Isolation
  if (isCustomerVariant) {
    console.log('👑 Applying Customer Brand VIP Isolation to dist and public assets...');
    // Replace public and dist icons with customer icon
    const distIconsDir = 'dist/assets/icons';
    if (fs.existsSync(distIconsDir)) {
      fs.copyFileSync(sourceIconPath, path.join(distIconsDir, 'merchant-app-icon.png'));
      fs.copyFileSync(sourceIconPath, path.join(distIconsDir, 'merchant-app-icon-1024.png'));
      fs.copyFileSync(sourceIconPath, path.join(distIconsDir, 'customer-vip-icon.png'));
    }

    const distHtml = 'dist/index.html';
    if (fs.existsSync(distHtml)) {
      let html = fs.readFileSync(distHtml, 'utf8');
      html = html.replace(/<title>.*?<\/title>/, '<title>Store pro - تطبيق الزبائن والمواطنين</title>');
      html = html.replace(/merchant-app-icon/g, 'customer-vip-icon');
      fs.writeFileSync(distHtml, html, 'utf8');
    }
  }

  console.log(`✅ Frozen icons & Splash Screens successfully deployed for ${variantCode}`);
}

injectFrozenIcons().catch(err => {
  console.error('❌ Failed deploying icons:', err);
  process.exit(1);
});
