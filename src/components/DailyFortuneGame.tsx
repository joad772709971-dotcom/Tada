import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Gift, Lock, Clock, Sparkles, Trophy } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface DailyFortuneGameProps {
  storeId: string;
  customerPhone: string;
}

interface FortuneCard {
  id: number;
  prize: string;
  isWin: boolean;
}

export default function DailyFortuneGame({ storeId, customerPhone }: DailyFortuneGameProps) {
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState(0);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [timeToReset, setTimeToReset] = useState('');

  // Game config state from store owner
  const [gameQuestion, setGameQuestion] = useState('اختر 3 بطاقات واكشف الجائزة لليوم! 🌟');
  const [winningIndices, setWinningIndices] = useState<number[]>([2, 7, 12]);
  const [prizes, setPrizes] = useState<string[]>([
    'خصم 50% على صيانة الشاشة 📱',
    'قسيمة بقيمة 5000 ر.ي 💵',
    'شاحن لاسلكي سريع مجاناً ⚡'
  ]);

  // Generate today's stable UTC date key
  const todayKey = useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  }, []);

  const lossHints = useMemo(() => [
    'حظ أوفر المرة القادمة! ⭐',
    'حاول غداً بكل شغف ✨',
    'تلميح: جرب العمود الأوسط 🔍',
    'تلميح: الجائزة قريبة جداً 🤞',
    'تلميح: الصف السفلي يحمل مفاجأة ⚡',
    'حظ طيب في محاولتك التالية! 🌟',
    'تلميح: جرب الأرقام الفردية 💡',
    'تلميح: حاول مجدداً غداً 🚀',
    'حظ أوفر غداً! 🌟',
    'تلميح: جرب حظك في الزوايا 🔍',
    'تلميح: لا تيأس، الحظ يحب المحاولة 💡',
    'حاول غداً للحصول على الجائزة ✨'
  ], []);

  useEffect(() => {
    if (!storeId || !customerPhone) return;

    const loadGameAndConfig = async () => {
      setLoading(true);
      try {
        // 1. Load Store Game Config
        const configRef = doc(db, 'daily_games_config', storeId);
        const configSnap = await getDoc(configRef);
        let activeQuestion = 'اختر 3 بطاقات واكشف الجائزة لليوم! 🌟';
        let activeWinners = [2, 7, 12];
        let activePrizes = [
          'خصم 50% على صيانة الشاشة 📱',
          'قسيمة بقيمة 5000 ر.ي 💵',
          'شاحن لاسلكي سريع مجاناً ⚡'
        ];

        if (configSnap.exists()) {
          const configData = configSnap.data();
          activeQuestion = configData.question || activeQuestion;
          activeWinners = configData.winningIndices || activeWinners;
          activePrizes = configData.prizes || activePrizes;
        }
        setGameQuestion(activeQuestion);
        setWinningIndices(activeWinners);
        setPrizes(activePrizes);

        // 2. Load Customer Game State for Today
        const cleanPhone = customerPhone.replace(/[\s\-\(\)]/g, '').trim();
        const docId = `${storeId}_${cleanPhone}_${todayKey}`;
        const gameRef = doc(db, 'user_daily_game', docId);
        const gameSnap = await getDoc(gameRef);

        if (gameSnap.exists()) {
          const gameData = gameSnap.data();
          setAttempts(gameData.attemptsCount || 0);
          setFlippedIndices(gameData.flippedIndices || []);
        } else {
          // Initialize fresh today session
          await setDoc(gameRef, {
            storeId,
            customerPhone: cleanPhone,
            date: todayKey,
            attemptsCount: 0,
            flippedIndices: [],
            createdAt: serverTimestamp()
          });
          setAttempts(0);
          setFlippedIndices([]);
        }
      } catch (err) {
        console.error('Error loading daily game / config:', err);
      } finally {
        setLoading(false);
      }
    };

    loadGameAndConfig();
  }, [storeId, customerPhone, todayKey]);

  // Real-time Countdown timer to 00:00 UTC tomorrow
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const tomorrowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const diffMs = tomorrowUTC.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeToReset('00:00:00');
        return;
      }

      const hrs = String(Math.floor(diffMs / (1000 * 60 * 60))).padStart(2, '0');
      const mins = String(Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
      const secs = String(Math.floor((diffMs % (1000 * 60)) / 1000)).padStart(2, '0');

      setTimeToReset(`${hrs}:${mins}:${secs}`);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleCardClick = async (index: number) => {
    if (loading || attempts >= 3 || flippedIndices.includes(index)) return;

    const updatedIndices = [...flippedIndices, index];
    const updatedAttempts = attempts + 1;

    setFlippedIndices(updatedIndices);
    setAttempts(updatedAttempts);

    try {
      const cleanPhone = customerPhone.replace(/[\s\-\(\)]/g, '').trim();
      const docId = `${storeId}_${cleanPhone}_${todayKey}`;
      const docRef = doc(db, 'user_daily_game', docId);
      await updateDoc(docRef, {
        flippedIndices: updatedIndices,
        attemptsCount: updatedAttempts,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error saving game play:', err);
    }
  };

  if (loading) {
    return (
      <div className="card-glass p-8 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#d4af37]"></div>
      </div>
    );
  }

  // Helper to determine what is behind a specific card index
  const getCardData = (idx: number): FortuneCard => {
    const isWin = winningIndices.includes(idx);
    let prize = '';
    if (isWin) {
      const winPos = winningIndices.indexOf(idx);
      prize = prizes[winPos] || prizes[0] || 'هدية مميزة! 🎉';
    } else {
      // Use a stable deterministic loss hint for this index
      prize = lossHints[idx % lossHints.length];
    }
    return { id: idx, prize, isWin };
  };

  return (
    <div className="bg-[#002244]/50 border-2 border-[#d4af37]/20 p-8 rounded-[3rem] relative overflow-hidden text-right" id="daily-game-section">
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#d4af37]/5 blur-[100px] -z-10" />
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-[#d4af37] to-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-[#d4af37]/20">
            <Trophy size={28} strokeWidth={2.5} className="text-navy-950" />
          </div>
          <div className="text-right">
            <h3 className="text-2xl font-black text-white flex items-center gap-2 justify-end">
              <span>جائزة اليوم الذكية 🌟</span>
            </h3>
            <p className="text-gray-400 text-xs mt-1">
              {gameQuestion}
            </p>
          </div>
        </div>

        {/* Action / Countdown Banner */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {attempts >= 3 ? (
            <div className="flex items-center gap-3 px-5 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-black">
              <Lock size={16} />
              <span>لقد استنفدت محاولاتك الـ 3 اليوم</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-5 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-black">
              <Sparkles size={16} className="animate-pulse" />
              <span>لديك {3 - attempts} محاولات متبقية لليوم</span>
            </div>
          )}

          <div className="flex items-center gap-3 px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-white/80 text-xs font-black">
            <Clock size={16} className="text-[#d4af37]" />
            <span>إعادة التعيين خلال: <span className="text-[#d4af37] font-mono tabular-nums">{timeToReset || '00:00:00'}</span></span>
          </div>
        </div>
      </div>

      {/* Grid of 15 Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
        {Array.from({ length: 15 }).map((_, idx) => {
          const card = getCardData(idx);
          const isFlipped = flippedIndices.includes(idx);
          const isLocked = attempts >= 3 && !isFlipped;

          return (
            <div
              key={idx}
              onClick={() => !isFlipped && !isLocked && handleCardClick(idx)}
              className={`relative h-28 cursor-pointer select-none rounded-2xl transition-all duration-500 transform-style-3d ${
                isFlipped ? '[transform:rotateY(180deg)]' : ''
              } ${isLocked ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
            >
              {/* Card Front (Unflipped) */}
              <div
                className={`absolute inset-0 bg-gradient-to-b from-slate-900 to-navy-950 border-2 border-white/10 rounded-2xl flex flex-col items-center justify-center transition-all backface-hidden ${
                  isLocked ? 'border-white/5' : 'hover:border-[#d4af37]/60 shadow-lg'
                }`}
              >
                <Gift className={`text-slate-500 ${!isLocked && 'group-hover:animate-bounce text-[#d4af37]'}`} size={24} />
                <span className="text-[10px] text-white/30 font-black mt-2">البطاقة {idx + 1}</span>
              </div>

              {/* Card Back (Flipped) */}
              <div
                className={`absolute inset-0 rounded-2xl border-2 flex flex-col items-center justify-center p-3 text-center backface-hidden [transform:rotateY(180deg)] ${
                  card.isWin
                    ? 'bg-gradient-to-b from-[#002244] to-slate-900 border-[#d4af37] text-[#d4af37]'
                    : 'bg-gradient-to-b from-slate-950 to-navy-900 border-white/10 text-white/60'
                }`}
              >
                {card.isWin ? (
                  <>
                    <Trophy className="text-[#d4af37] mb-1 animate-bounce" size={18} />
                    <span className="text-[9px] font-black uppercase text-[#d4af37] tracking-wider">مبروك! فوز</span>
                  </>
                ) : (
                  <>
                    <Gift className="text-white/20 mb-1" size={16} />
                    <span className="text-[9px] text-white/30 font-black">حظ أوفر</span>
                  </>
                )}
                <p className="text-[10px] font-black leading-tight mt-1 truncate w-full">{card.prize}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
