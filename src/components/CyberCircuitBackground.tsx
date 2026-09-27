import React from 'react';

/**
 * CyberCircuitBackground
 * High-Tech Motherboard & Digital Circuit Board Background
 * Matches the cybernetic PCB traces, micro-matrix grids, and fiber optic data streams
 * with subtle non-distracting ambient luminescence for JAM System Pro.
 */
export const CyberCircuitBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
      {/* 1. Base Deep Cosmic Navy Gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 90% 70% at 50% 20%, #0c1836 0%, #060c1d 40%, #02040a 90%)',
        }}
      />

      {/* 2. Micro-Matrix Digital Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, rgba(56, 189, 248, 0.4) 1px, transparent 0),
            linear-gradient(to right, rgba(56, 189, 248, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(56, 189, 248, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px, 64px 64px, 64px 64px',
        }}
      />

      {/* 3. Detailed Circuit Board PCB Traces & Bus Lines (Vector SVG Layer) */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-[0.28] mix-blend-screen" 
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1920 1080"
      >
        <defs>
          {/* Circuit Trace Gradients */}
          <linearGradient id="traceCyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#0284c7" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.2" />
          </linearGradient>

          <linearGradient id="traceTeal" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#0369a1" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.1" />
          </linearGradient>

          <linearGradient id="traceGold" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#d97706" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#451a03" stopOpacity="0.1" />
          </linearGradient>

          {/* Glowing Filters */}
          <filter id="circuitGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* --- Top-Left PCB Circuit System --- */}
        <g stroke="url(#traceCyan)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Main Bus lines with 45 degree bends */}
          <path d="M-50 120 L240 120 L380 260 L380 440 L460 520 L720 520" />
          <path d="M-50 150 L220 150 L350 280 L350 460 L430 540 L680 540" />
          <path d="M-50 180 L200 180 L320 300 L320 480 L400 560 L640 560" />
          <path d="M-50 210 L180 210 L290 320 L290 500 L370 580 L600 580" strokeDasharray="6 4" />

          {/* Secondary branch circuits */}
          <path d="M380 340 L500 340 L560 280 L760 280 L820 220 L940 220" />
          <path d="M350 380 L460 380 L520 320 L700 320" />
          <path d="M120 -20 L120 180 L220 280 L220 520 L140 600 L-20 600" />
          <path d="M260 -20 L260 80 L320 140 L320 240" />

          {/* Circuit nodes (Pads & Vias) */}
          <circle cx="720" cy="520" r="4" fill="#38bdf8" filter="url(#circuitGlow)" />
          <circle cx="680" cy="540" r="3.5" fill="#38bdf8" />
          <circle cx="640" cy="560" r="3" fill="#38bdf8" />
          <circle cx="600" cy="580" r="4" fill="#38bdf8" filter="url(#circuitGlow)" />
          <circle cx="940" cy="220" r="5" fill="#0284c7" filter="url(#circuitGlow)" />
          <circle cx="700" cy="320" r="3.5" fill="#38bdf8" />
          <circle cx="380" cy="260" r="2.5" fill="#7dd3fc" />
          <circle cx="460" cy="520" r="2.5" fill="#7dd3fc" />
          <circle cx="560" cy="280" r="2.5" fill="#7dd3fc" />
        </g>

        {/* --- Top-Right PCB Circuit System --- */}
        <g stroke="url(#traceTeal)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Main Bus lines descending from top right */}
          <path d="M1980 140 L1680 140 L1520 300 L1520 480 L1420 580 L1180 580" />
          <path d="M1980 170 L1700 170 L1550 320 L1550 460 L1450 560 L1220 560" />
          <path d="M1980 200 L1720 200 L1580 340 L1580 440 L1480 540 L1260 540" strokeDasharray="8 6" />
          <path d="M1980 230 L1740 230 L1610 360 L1610 420 L1510 520 L1300 520" />

          {/* Upper Right branching */}
          <path d="M1800 -20 L1800 100 L1710 190 L1710 360 L1800 450 L1980 450" />
          <path d="M1520 380 L1380 380 L1300 300 L1080 300" />
          <path d="M1420 580 L1340 660 L1340 820 L1200 960 L1000 960" />

          {/* Nodes */}
          <circle cx="1180" cy="580" r="4.5" fill="#2dd4bf" filter="url(#circuitGlow)" />
          <circle cx="1220" cy="560" r="3.5" fill="#2dd4bf" />
          <circle cx="1260" cy="540" r="3" fill="#2dd4bf" />
          <circle cx="1300" cy="520" r="4" fill="#2dd4bf" filter="url(#circuitGlow)" />
          <circle cx="1080" cy="300" r="5" fill="#38bdf8" filter="url(#circuitGlow)" />
          <circle cx="1000" cy="960" r="4" fill="#2dd4bf" />
          <circle cx="1520" cy="300" r="2.5" fill="#5eead4" />
          <circle cx="1300" cy="300" r="2.5" fill="#5eead4" />
        </g>

        {/* --- Bottom-Left & Bottom-Right Circuit Traces --- */}
        <g stroke="url(#traceCyan)" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Bottom Left rising upward */}
          <path d="M-40 880 L220 880 L360 740 L360 620 L480 500 L620 500" />
          <path d="M-40 920 L200 920 L330 790 L330 650 L450 530 L580 530" />
          <path d="M160 1100 L160 940 L280 820 L420 820 L520 920 L660 920" />

          {/* Bottom Right rising upward */}
          <path d="M1980 900 L1720 900 L1580 760 L1580 640 L1460 520 L1320 520" stroke="url(#traceTeal)" />
          <path d="M1980 940 L1740 940 L1610 810 L1610 670 L1490 550 L1360 550" stroke="url(#traceTeal)" />
          <path d="M1820 1100 L1820 960 L1700 840 L1560 840 L1460 940 L1300 940" stroke="url(#traceTeal)" />

          {/* Bottom Nodes */}
          <circle cx="620" cy="500" r="3.5" fill="#38bdf8" />
          <circle cx="580" cy="530" r="3" fill="#38bdf8" />
          <circle cx="660" cy="920" r="4" fill="#38bdf8" />
          <circle cx="1320" cy="520" r="3.5" fill="#2dd4bf" />
          <circle cx="1360" cy="550" r="3" fill="#2dd4bf" />
          <circle cx="1300" cy="940" r="4" fill="#2dd4bf" />
        </g>

        {/* --- High-Speed Optical Fiber Bus & Glowing Micro-Packets (Central Ambient Effect) --- */}
        <g strokeLinecap="round" opacity="0.6">
          {/* Fiber Optic Rays emerging from top center */}
          <path d="M960 -30 L960 180 L900 240 L900 420" stroke="url(#traceCyan)" strokeWidth="2.5" filter="url(#circuitGlow)" />
          <path d="M930 -30 L930 160 L860 230 L860 380 L800 440 L800 600" stroke="#38bdf8" strokeWidth="1.2" />
          <path d="M990 -30 L990 160 L1060 230 L1060 380 L1120 440 L1120 600" stroke="#2dd4bf" strokeWidth="1.2" />
          
          <path d="M945 -30 L945 120 L840 225 L760 225 L680 305 L680 480" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="4 6" />
          <path d="M975 -30 L975 120 L1080 225 L1160 225 L1240 305 L1240 480" stroke="#14b8a6" strokeWidth="1" strokeDasharray="4 6" />

          {/* Radiant Center Core Glow */}
          <circle cx="960" cy="180" r="8" fill="#38bdf8" filter="url(#softGlow)" />
          <circle cx="960" cy="180" r="3.5" fill="#ffffff" />
          <circle cx="900" cy="240" r="4" fill="#38bdf8" />
          <circle cx="860" cy="230" r="3" fill="#2dd4bf" />
          <circle cx="1060" cy="230" r="3" fill="#2dd4bf" />
        </g>

        {/* --- Subtle Micro-Chip Outlines & IC Components --- */}
        <g stroke="#1e293b" strokeWidth="1" fill="#070d1e" fillOpacity="0.4" strokeDasharray="2 3">
          <rect x="280" y="320" width="48" height="48" rx="6" />
          <circle cx="304" cy="344" r="3" fill="#0ea5e9" opacity="0.4" />

          <rect x="1570" y="360" width="54" height="54" rx="6" />
          <circle cx="1597" cy="387" r="3" fill="#14b8a6" opacity="0.4" />

          <rect x="660" y="490" width="36" height="36" rx="4" />
          <rect x="1220" y="530" width="36" height="36" rx="4" />
        </g>
      </svg>

      {/* 4. Fiber Optic Ambient Light Cones & Volumetric Glow */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] sm:w-[900px] h-[350px] sm:h-[450px] pointer-events-none opacity-40 mix-blend-screen"
        style={{
          background: 'radial-gradient(ellipse 60% 45% at 50% 0%, rgba(56, 189, 248, 0.35) 0%, rgba(14, 165, 233, 0.15) 50%, transparent 85%)',
        }}
      />

      {/* 5. Left and Right Soft Dynamic Nebular Glows */}
      <div className="absolute top-1/4 left-1/6 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-gradient-to-br from-sky-500/10 via-indigo-600/10 to-transparent blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/6 translate-x-1/3 translate-y-1/3 w-[400px] sm:w-[550px] h-[400px] sm:h-[550px] bg-gradient-to-tl from-teal-500/10 via-blue-600/10 to-transparent blur-[140px] rounded-full pointer-events-none" />

      {/* 6. Soft Central Vignette (Guarantees crisp reading contrast on inputs & cards) */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 20%, rgba(2, 4, 10, 0.45) 75%, rgba(2, 4, 10, 0.85) 100%)',
        }}
      />
    </div>
  );
};

export default CyberCircuitBackground;
