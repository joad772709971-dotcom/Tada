import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const merchantSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Space Gradient -->
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#070D1E" />
      <stop offset="40%" stop-color="#0B132B" />
      <stop offset="80%" stop-color="#050814" />
      <stop offset="100%" stop-color="#02040A" />
    </linearGradient>

    <!-- Outer Metallic Frame Gradient -->
    <linearGradient id="frame-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="25%" stop-color="#1D4ED8" />
      <stop offset="50%" stop-color="#0F172A" />
      <stop offset="75%" stop-color="#1E3A8A" />
      <stop offset="100%" stop-color="#2563EB" />
    </linearGradient>

    <!-- 3D Gold Gradient for Text & Inlays -->
    <linearGradient id="gold-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FEF08A" />
      <stop offset="25%" stop-color="#FDE047" />
      <stop offset="55%" stop-color="#EAB308" />
      <stop offset="85%" stop-color="#CA8A04" />
      <stop offset="100%" stop-color="#854D0E" />
    </linearGradient>

    <!-- Horizontal Gold Gradient for Medallion -->
    <linearGradient id="gold-h-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFBEB" />
      <stop offset="30%" stop-color="#FDE047" />
      <stop offset="70%" stop-color="#D97706" />
      <stop offset="100%" stop-color="#78350F" />
    </linearGradient>

    <!-- Glowing Cyan Gradient -->
    <linearGradient id="cyan-glow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00F0FF" />
      <stop offset="50%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#0284C7" />
    </linearGradient>

    <!-- Neon Magenta/Purple Gradient -->
    <linearGradient id="magenta-glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F43F5E" />
      <stop offset="50%" stop-color="#E11D48" />
      <stop offset="100%" stop-color="#9333EA" />
    </linearGradient>

    <!-- Inner Shield Carbon Gradient -->
    <linearGradient id="shield-carbon" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0C1A38" />
      <stop offset="40%" stop-color="#081024" />
      <stop offset="100%" stop-color="#030712" />
    </linearGradient>

    <!-- Filters -->
    <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="glow-gold" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.85" />
    </filter>

    <filter id="badge-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.9" />
    </filter>
  </defs>

  <!-- Base Ambient Canvas -->
  <rect width="1024" height="1024" fill="#060A17" />

  <!-- Outer Rounded Chassis with Metallic Border -->
  <rect x="56" y="56" width="912" height="912" rx="200" fill="url(#frame-grad)" stroke="#38BDF8" stroke-width="6" filter="url(#drop-shadow)" />
  
  <!-- Inlaid Gold Wireframe -->
  <rect x="76" y="76" width="872" height="872" rx="180" fill="none" stroke="url(#gold-grad)" stroke-width="5" opacity="0.85" />
  
  <!-- Dark Carbon Background -->
  <rect x="90" y="90" width="844" height="844" rx="166" fill="url(#bg-grad)" />

  <!-- Circuit Pattern Background (Tech Grid Lines) -->
  <g opacity="0.18" stroke="#38BDF8" stroke-width="2">
    <path d="M90 260 L934 260 M90 480 L934 480 M90 700 L934 700" />
    <path d="M260 90 L260 934 M512 90 L512 934 M764 90 L764 934" />
    <circle cx="260" cy="260" r="8" fill="#38BDF8" />
    <circle cx="764" cy="260" r="8" fill="#38BDF8" />
    <circle cx="260" cy="700" r="8" fill="#38BDF8" />
    <circle cx="764" cy="700" r="8" fill="#38BDF8" />
  </g>

  <!-- ======================================================== -->
  <!-- 🛡️ ENLARGED DOMINANT SHIELD (الدرع المكبر الشامخ) -->
  <!-- ======================================================== -->
  
  <!-- Layer 1: Outer Magenta/Neon Aura Shield Shadow & Rim -->
  <path d="M512 145 L830 220 C830 550 690 735 512 805 C334 735 194 550 194 220 Z" 
        fill="#080F24" stroke="url(#magenta-glow)" stroke-width="12" filter="url(#drop-shadow)" opacity="0.95" />

  <!-- Layer 2: Main Cyan Cyber Armor Shield (المجسم الرئيسي للدرع) -->
  <path d="M512 170 L795 238 C795 530 668 700 512 768 C356 700 229 530 229 238 Z" 
        fill="url(#shield-carbon)" stroke="url(#cyan-glow)" stroke-width="16" stroke-linejoin="round" filter="url(#glow-cyan)" />

  <!-- Layer 3: Inner Gold Inset Bevel (الحافة الذهبية الداخلية للدرع) -->
  <path d="M512 198 L762 258 C762 505 645 660 512 725 C379 660 262 505 262 258 Z" 
        fill="#040711" stroke="url(#gold-grad)" stroke-width="4.5" />

  <!-- Neon Pulse Wave / ECG Health & Tech Line across Shield -->
  <g filter="url(#glow-cyan)">
    <path d="M100 485 L260 485 L295 485 L325 410 L360 560 L395 440 L425 515 L445 485 L579 485 L600 455 L625 530 L655 410 L690 560 L720 485 L755 485 L924 485" 
          fill="none" stroke="#00F0FF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" />
  </g>

  <!-- ======================================================== -->
  <!-- 🌟 ENLARGED 4 ORBITING BUSINESS & STORE ICONS IN SHIELD -->
  <!-- ======================================================== -->

  <!-- 1. Shopping Cart (Top Left) - المكبر -->
  <g transform="translate(305, 290) scale(1.6)" filter="url(#glow-gold)">
    <!-- Cart Body -->
    <path d="M0 2 L9 2 L18 25 L42 25 L49 10 L15 10" fill="none" stroke="url(#gold-grad)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="21" cy="31" r="3.8" fill="#FDE047" stroke="#CA8A04" stroke-width="1" />
    <circle cx="39" cy="31" r="3.8" fill="#FDE047" stroke="#CA8A04" stroke-width="1" />
  </g>

  <!-- 2. Coin Stack / Treasury (Top Right) - المكبر -->
  <g transform="translate(635, 290) scale(1.6)" filter="url(#glow-gold)">
    <ellipse cx="20" cy="8" rx="18" ry="7" fill="none" stroke="url(#gold-grad)" stroke-width="3.5" />
    <path d="M2 8 C2 15 38 15 38 8 M2 15 C2 22 38 22 38 15 M2 22 C2 29 38 29 38 22" fill="none" stroke="url(#gold-grad)" stroke-width="3.5" />
  </g>

  <!-- 3. Logistics & Delivery Truck (Bottom Left) - المكبر -->
  <g transform="translate(300, 560) scale(1.6)" filter="url(#glow-gold)">
    <path d="M2 4 L30 4 L30 24 L2 24 Z M30 10 L40 10 L48 17 L48 24 L30 24 Z" fill="none" stroke="url(#gold-grad)" stroke-width="3.5" stroke-linejoin="round" />
    <circle cx="12" cy="27" r="4.2" fill="#FDE047" stroke="#CA8A04" stroke-width="1" />
    <circle cx="40" cy="27" r="4.2" fill="#FDE047" stroke="#CA8A04" stroke-width="1" />
  </g>

  <!-- 4. Crossed Phone & Hardware Repair Tools (Bottom Right) - المكبر -->
  <g transform="translate(635, 560) scale(1.6)" filter="url(#glow-gold)">
    <!-- Crossed Wrench & Screwdriver -->
    <path d="M6 6 L34 34 M34 6 L6 34" stroke="url(#gold-grad)" stroke-width="4.5" stroke-linecap="round" />
    <path d="M3 3 L10 3 L10 10 M30 30 L37 30 L37 37" stroke="url(#gold-grad)" stroke-width="3.5" stroke-linecap="round" />
  </g>

  <!-- ======================================================== -->
  <!-- 👑 CENTRAL MEDALLION & GRAND "JAM" TYPOGRAPHY -->
  <!-- ======================================================== -->

  <!-- Central Circular Medallion with Deep Bevel & Glow -->
  <circle cx="512" cy="485" r="128" fill="#040813" stroke="url(#cyan-glow)" stroke-width="10" filter="url(#drop-shadow)" />
  <circle cx="512" cy="485" r="114" fill="#081024" stroke="url(#gold-grad)" stroke-width="6" />
  <circle cx="512" cy="485" r="98" fill="url(#shield-carbon)" stroke="#1E3A8A" stroke-width="2" />

  <!-- Top Crown Accent on Medallion -->
  <path d="M472 385 L492 405 L512 375 L532 405 L552 385 L545 415 L479 415 Z" fill="url(#gold-grad)" filter="url(#glow-gold)" />

  <!-- GRAND "JAM" BOLD DISPLAY TEXT (كبير جداً ومهيب) -->
  <g filter="url(#drop-shadow)">
    <text x="512" y="525" 
          font-family="'Montserrat', 'Arial Black', 'Segoe UI', sans-serif" 
          font-size="108" 
          font-weight="900" 
          letter-spacing="4"
          text-anchor="middle" 
          fill="url(#gold-grad)"
          stroke="#78350F"
          stroke-width="3">JAM</text>
  </g>

  <!-- ======================================================== -->
  <!-- 🏷️ "STORE PRO" LOWER BADGE -->
  <!-- ======================================================== -->

  <!-- Floating Metallic Gold Ribbon/Badge -->
  <g filter="url(#badge-shadow)">
    <rect x="220" y="825" width="584" height="74" rx="37" fill="#070F26" stroke="url(#gold-grad)" stroke-width="5" />
    
    <!-- Cyber Corner Accents -->
    <path d="M250 862 L235 862 M774 862 L789 862" stroke="#00F0FF" stroke-width="4" stroke-linecap="round" />
    
    <!-- 4-Point Golden Star Left -->
    <g transform="translate(290, 862) scale(1.3)" filter="url(#glow-gold)">
      <path d="M0 -12 Q1.5 -1.5 12 0 Q1.5 1.5 0 12 Q-1.5 1.5 -12 0 Q-1.5 -1.5 0 -12 Z" fill="url(#gold-grad)" />
    </g>

    <!-- 4-Point Golden Star Right -->
    <g transform="translate(734, 862) scale(1.3)" filter="url(#glow-gold)">
      <path d="M0 -12 Q1.5 -1.5 12 0 Q1.5 1.5 0 12 Q-1.5 1.5 -12 0 Q-1.5 -1.5 0 -12 Z" fill="url(#gold-grad)" />
    </g>

    <!-- STORE PRO Typography -->
    <text x="512" y="873" 
          font-family="'Montserrat', 'Segoe UI', Arial, sans-serif" 
          font-size="44" 
          font-weight="900" 
          letter-spacing="12" 
          text-anchor="middle" 
          fill="url(#gold-grad)">STORE PRO</text>
  </g>

</svg>
`;

async function generate() {
  const rootDir = process.cwd();
  const svgPath = path.join(rootDir, 'public/assets/icons/merchant-icon.svg');
  
  // Write SVG file
  fs.writeFileSync(svgPath, merchantSvg.trim(), 'utf8');
  console.log('✅ Created public/assets/icons/merchant-icon.svg');

  const svgBuffer = Buffer.from(merchantSvg.trim());

  // Render to 1024x1024 PNG
  const png1024 = await sharp(svgBuffer).resize(1024, 1024).png().toBuffer();
  fs.writeFileSync(path.join(rootDir, 'public/assets/icons/merchant-app-icon-1024.png'), png1024);

  // Render to 512x512 PNG
  const png512 = await sharp(svgBuffer).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(rootDir, 'public/assets/icons/merchant-app-icon.png'), png512);
  fs.writeFileSync(path.join(rootDir, 'src/assets/icons/merchant-app-icon.png'), png512);

  // Render to 192x192 PNG
  const png192 = await sharp(svgBuffer).resize(192, 192).png().toBuffer();
  fs.writeFileSync(path.join(rootDir, 'public/assets/icons/merchant-app-icon-192.png'), png192);

  console.log('✅ Generated high-resolution PNGs for merchant app icon');

  // Convert png512 to base64 Data URI for offline/instant embedded use
  const base64Uri = `data:image/png;base64,${png512.toString('base64')}`;
  console.log('Base64 generated successfully length:', base64Uri.length);

  return base64Uri;
}

generate().catch(console.error);
