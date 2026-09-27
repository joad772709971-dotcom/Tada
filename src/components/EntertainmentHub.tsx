import React, { useState, useEffect } from 'react';
import TheGoldenVault from './TheGoldenVault';

export default function EntertainmentHub() {
  const [activeTab, setActiveTab] = useState<'vault' | 'game' | 'browser'>('vault');
  const [score, setScore] = useState(0);
  const [gameActive, setGameActive] = useState(true);
  const [targetPos, setTargetPos] = useState({ top: '50%', left: '50%' });

  // محرك اللعبة المصغرة أوفلاين لتسليّة الزبون
  useEffect(() => {
    if (!gameActive) return;
    const interval = setInterval(() => {
      const top = Math.floor(Math.random() * 70 + 10) + '%';
      const left = Math.floor(Math.random() * 80 + 10) + '%';
      setTargetPos({ top, left });
    }, 1200);
    return () => clearInterval(interval);
  }, [gameActive]);

  const handleTargetClick = () => {
    setScore(prev => prev + 10);
  };

  return (
    <div className="w-full max-w-4xl p-2 md:p-6 rounded-2xl bg-[#0d0e14] border border-[#1b1e2e] shadow-2xl text-center">
      {/* التبديل بين الأقسام */}
      <div className="flex bg-[#12141f] p-1.5 rounded-xl mb-4 border border-[#20253b] gap-2">
        <button 
          onClick={() => setActiveTab('vault')} 
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'vault' ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-black shadow-md' : 'text-gray-400 hover:text-white bg-transparent'}`}
        >
          🥇 الخزنة الذهبية الفيدرالية (Vault)
        </button>
        <button 
          onClick={() => setActiveTab('game')} 
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'game' ? 'bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] text-white shadow-md' : 'text-gray-400 hover:text-white bg-transparent'}`}
        >
          🎮 طبيب الهاتف (أوفلاين)
        </button>
        <button 
          onClick={() => setActiveTab('browser')} 
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'browser' ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-md' : 'text-gray-400 hover:text-white bg-transparent'}`}
        >
          🌐 المتصفح الذكي الخفيف
        </button>
      </div>

      {activeTab === 'vault' ? (
        <TheGoldenVault />
      ) : activeTab === 'game' ? (
        /* 🎮 اللعبة الخفيفة */
        <div className="p-4 bg-[#050508] rounded-xl border border-gray-900 relative h-64 overflow-hidden select-none">
          <div className="absolute top-2 right-2 text-xs font-mono text-yellow-400 font-bold">السكور: {score}</div>
          <p className="text-[10px] text-gray-500 absolute top-2 left-2">انقر على آيكون الجوال الذهبي سريعاً!</p>
          
          <button
            onClick={handleTargetClick}
            style={{ top: targetPos.top, left: targetPos.left }}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 p-3 bg-yellow-500/10 border border-yellow-500 rounded-xl text-xl animate-bounce transition-all duration-300 cursor-pointer"
          >
            📱
          </button>
        </div>
      ) : (
        /* 🌐 المتصفح الداخلي */
        <div className="w-full bg-[#050508] rounded-xl border border-gray-900 overflow-hidden h-96">
          <iframe 
            src="https://www.google.com/search?q=tech+news&igu=1" 
            className="w-full h-full border-none bg-white"
            title="JAM Browser"
          />
        </div>
      )}
      
      <p className="text-[9px] text-gray-500 mt-3 font-bold">⚜️ ميزة التحديات والألعاب الأمنية مدمجة محلياً وسحابياً كلياً مع نظام مكافآت مقاومة الاحتيال.</p>
    </div>
  );
}
