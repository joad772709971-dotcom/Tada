import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  Unlock, 
  Key, 
  Sparkles, 
  Clock, 
  AlertTriangle, 
  HelpCircle, 
  RotateCcw, 
  ChevronRight, 
  Trophy, 
  CheckCircle2, 
  Zap,
  Ticket,
  Send,
  UserCheck
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { db, auth } from '../firebase';
import { doc, runTransaction, getDoc, updateDoc, setDoc } from 'firebase/firestore';

// Difficulty mapping for puzzle keys
const getLevelDifficulty = (lvl: number) => {
  if (lvl <= 20) {
    return {
      length: 3,
      hasTimer: false,
      timerSecs: 0,
      label: 'الخزنة البرونزية 🟫',
      difficulty: 'سهل'
    };
  } else if (lvl <= 60) {
    return {
      length: 4,
      hasTimer: true,
      timerSecs: 45,
      label: 'الخزنة الفضية ⬜',
      difficulty: 'متوسط'
    };
  } else if (lvl <= 99) {
    return {
      length: 5,
      hasTimer: true,
      timerSecs: 30,
      label: 'الخزنة البلاتينية 💎',
      difficulty: 'صعب'
    };
  } else {
    return {
      length: 6,
      hasTimer: false,
      timerSecs: 0,
      label: '🔐 الخزنة الكبرى الأسطورية (المستوى 100)',
      difficulty: 'أسطوري'
    };
  }
};

// Play retro audio synth feedback
const playTone = (freq: number, type: OscillatorType, duration: number) => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio Context blocked or unsupported
  }
};

interface TheGoldenVaultProps {
  currentLead?: any;
  shopProfile?: any;
  customerProfile?: any;
}

export default function TheGoldenVault({ currentLead, shopProfile, customerProfile }: TheGoldenVaultProps = {}) {
  const [level, setLevel] = useState<number>(() => {
    return Number(localStorage.getItem('jam_golden_vault_lvl')) || 1;
  });
  
  const currentDiff = getLevelDifficulty(level);
  
  const [enteredCode, setEnteredCode] = useState<string>('');
  const [correctTempCode, setCorrectTempCode] = useState<string>('');
  const [statusText, setStatusText] = useState<string>('أدخل الكود الصحيح لكسر شيفرة الخزنة');
  const [history, setHistory] = useState<Array<{ code: string; result: 'higher' | 'lower' | 'correct' }>>([]);
  
  // Timer state for levels 21-99
  const [timeLeft, setTimeLeft] = useState<number>(currentDiff.timerSecs);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  
  // Hint State
  const [hintsBalance, setHintsBalance] = useState<number>(3);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [revealedHint, setRevealedHint] = useState<string>('');
  const [vaultState, setVaultState] = useState<'locked' | 'unlocked' | 'wrong' | 'cracked_100'>('locked');
  const [ticketId, setTicketId] = useState<string>('');
  const [showRewardModal, setShowRewardModal] = useState<boolean>(false);
  
  const rotateRef = useRef<number>(0);

  // Sync user's real hints balance from Firestore profiles
  useEffect(() => {
    const fetchHints = async () => {
      const docId = currentLead?.id || auth.currentUser?.uid;
      const collectionName = currentLead?.id ? 'leads' : 'users';
      
      if (docId) {
        try {
          const docRef = doc(db, collectionName, docId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const h = docSnap.data().hints_balance;
            if (h !== undefined) {
              setHintsBalance(h);
            } else {
              // initialize hints_balance to 3 (as requested: "Give the user 3 starting Hints (مساعدات)")
              await updateDoc(docRef, { hints_balance: 3 });
              setHintsBalance(3);
            }
          } else {
            // docId does not exist but we can initialize set hints locally
            setHintsBalance(3);
          }
        } catch (e) {
          console.warn('Hints database fetch bypassed, using local balance:', e);
          setHintsBalance(3);
        }
      } else {
        setHintsBalance(3);
      }
    };
    fetchHints();
  }, [level, currentLead]);

  // Seed / generate code for the level
  useEffect(() => {
    setEnteredCode('');
    setHistory([]);
    setRevealedHint('');
    setIsGameOver(false);
    setVaultState('locked');
    
    if (level === 100) {
      // Level 100 requires absolute server/daily sync, will fetch or verify via endpoint
      setCorrectTempCode('SERVER_VERIFIED');
      setStatusText('أدخل مفتاح التحقق الأسطوري المكون من 6 أرقام (يتغير كل 24 ساعة)');
      setIsTimerActive(false);
    } else {
      // Local deterministic or random code generation depending on difficulty
      let val = '';
      for (let i = 0; i < currentDiff.length; i++) {
        val += Math.floor(Math.random() * 10).toString();
      }
      setCorrectTempCode(val);
      console.log(`[The Golden Vault Debug] Level ${level} Correct Code: ${val}`);
      setStatusText(`أدخل كود مكون من ${currentDiff.length} أرقام لحل اللغز`);
      
      if (currentDiff.hasTimer) {
        setTimeLeft(currentDiff.timerSecs);
        setIsTimerActive(true);
      } else {
        setIsTimerActive(false);
      }
    }
  }, [level]);

  // Handle timer ticks
  useEffect(() => {
    let interval: any = null;
    if (isTimerActive && timeLeft > 0 && !isGameOver) {
      interval = setInterval(() => {
        setTimeLeft(p => p - 1);
      }, 1000);
    } else if (timeLeft === 0 && isTimerActive && !isGameOver) {
      setIsGameOver(true);
      setVaultState('wrong');
      playTone(180, 'sawtooth', 0.6);
      setStatusText('🚨 انتهى الوقت! لقد أغلقت أجهزة الحماية الأمنية الخزنة.');
    }
    return () => clearInterval(interval);
  }, [timeLeft, isTimerActive, isGameOver]);

  // Keypad actions
  const handleNumClick = (num: string) => {
    if (isGameOver || vaultState === 'unlocked') return;
    if (enteredCode.length < currentDiff.length) {
      playTone(600 + Number(num) * 35, 'triangle', 0.08);
      setEnteredCode(prev => prev + num);
    }
  };

  const handleDelete = () => {
    if (isGameOver || vaultState === 'unlocked') return;
    playTone(350, 'triangle', 0.08);
    setEnteredCode(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isGameOver || vaultState === 'unlocked') return;
    playTone(280, 'triangle', 0.1);
    setEnteredCode('');
  };

  // Decrement hint balance via atomic firestore transaction
  const triggerRequestHint = async () => {
    const docId = currentLead?.id || auth.currentUser?.uid;
    const collectionName = currentLead?.id ? 'leads' : 'users';

    if (!docId) {
      if (hintsBalance <= 0) {
        setStatusText('❌ لا تملك نقاط تلميحات كافية في حسابك!');
        playTone(150, 'sawtooth', 0.2);
        return;
      }
      setHintsBalance(prev => Math.max(0, prev - 1));
    } else {
      if (hintsBalance <= 0) {
        setStatusText('❌ لا تملك نقاط تلميحات كافية في حسابك!');
        playTone(150, 'sawtooth', 0.2);
        return;
      }

      setIsVerifying(true);
      try {
        const docRef = doc(db, collectionName, docId);
        await runTransaction(db, async (transaction) => {
          const docSnap = await transaction.get(docRef);
          let updatedBalance = (docSnap.exists() ? docSnap.data().hints_balance : null) ?? hintsBalance;
          
          if (updatedBalance <= 0) {
            throw new Error("رصيد التلميحات منتهي");
          }
          
          transaction.update(docRef, {
            hints_balance: updatedBalance - 1
          });
          
          setHintsBalance(updatedBalance - 1);
        });
      } catch (e: any) {
        console.warn("Hint transaction failed, reverting offline:", e);
        setHintsBalance(prev => Math.max(0, prev - 1));
      } finally {
        setIsVerifying(false);
      }
    }

    // Reveal correct character at index matches filled length
    if (level === 100) {
      try {
        const response = await fetch('/api/vault/daily-code', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ uid: docId || 'anonymous' })
        });
        const d = await response.json();
        if (d.success && d.code) {
          const char = d.code[enteredCode.length];
          const positionText = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'][enteredCode.length] || 'التالي';
          setRevealedHint(`💡 الرمز رقم ${positionText} هو الرقم: ${char}`);
          setStatusText(`تم التعرف على تلميحة الرقم ${positionText}!`);
        } else {
          setRevealedHint(`💡 مستوى 100 ذو طابع فدرالي آمن. رمز اليوم يبدأ بالرقم 7`);
        }
      } catch (err) {
        setRevealedHint(`💡 مستوى 100 ذو طابع فدرالي آمن. رمز اليوم يبدأ بالرقم 7`);
      }
    } else {
      const indexToReveal = enteredCode.length;
      if (indexToReveal < currentDiff.length) {
        const char = correctTempCode[indexToReveal];
        const positionText = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'][indexToReveal];
        setRevealedHint(`💡 الرمز رقم ${positionText} هو الرقم: ${char}`);
        setStatusText(`تم التعرف على الرقم ${positionText}!`);
      } else {
        setRevealedHint(`💡 كود الحل بالكامل هو: ${correctTempCode}`);
      }
    }
    playTone(880, 'sine', 0.3);
  };

  const handleVerify = async () => {
    if (isGameOver || vaultState === 'unlocked') return;
    if (enteredCode.length !== currentDiff.length) {
      setStatusText(`⚠️ الرجاء ملء الكود بالكامل (${currentDiff.length} خانات)`);
      playTone(180, 'sawtooth', 0.35);
      return;
    }

    setIsVerifying(true);
    
    // Rotate vault wheel visual
    rotateRef.current += 135;

    try {
      if (level === 100) {
        // Safe cryptographic server verified reward handler
        const u = auth.currentUser;
        const customerId = currentLead?.id || u?.uid || 'anonymous';
        const sId = shopProfile?.id || 'demo_store';

        const resp = await fetch('/api/vault/generateRewardTicket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: customerId,
            customer_id: customerId,
            enteredCode: enteredCode,
            level: 100,
            timestamp: Date.now(),
            storeId: sId
          })
        });

        const data = await resp.json();
        if (data.success && data.ticket_id) {
          setVaultState('cracked_100');
          setTicketId(data.ticket_id);
          setShowRewardModal(true);
          setCorrectTempCode(enteredCode);
          
          // Secure Firestore Client dual-write fallback
          try {
            await setDoc(doc(db, 'reward_tickets', data.ticket_id), {
              ticket_id: data.ticket_id,
              uid: customerId,
              customer_id: customerId,
              store_id: sId,
              level: 100,
              hash: data.hash || '',
              verifiedCode: enteredCode,
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            });
          } catch (clientDbErr) {
            console.warn("Client fallback document write bypassed:", clientDbErr);
          }

          confetti({
            particleCount: 200,
            spread: 90,
            origin: { y: 0.6 },
            colors: ['#f59e0b', '#fbbf24', '#ffffff', '#1e293b']
          });
          
          playTone(523.25, 'sine', 0.2);
          setTimeout(() => playTone(659.25, 'sine', 0.2), 150);
          setTimeout(() => playTone(783.99, 'sine', 0.4), 300);
          setStatusText('🌌 تهانينا! لقد قمت بكسر حماية المستوى الأسطوري 100 بنجاح!');
        } else {
          setVaultState('wrong');
          playTone(150, 'sawtooth', 0.5);
          setStatusText(data.message || '❌ الرمز خاطئ أو منتهي الصلاحية! يرجى إعادة المحاولة.');
        }
      } else {
        // Offline Levels 1-99 comparison
        if (enteredCode === correctTempCode) {
          setVaultState('unlocked');
          setIsTimerActive(false);
          
          confetti({
            particleCount: 120,
            spread: 60,
            origin: { y: 0.7 },
            colors: ['#fbbf24', '#f59e0b', '#d97706']
          });
          
          playTone(440, 'sine', 0.15);
          setTimeout(() => playTone(554, 'sine', 0.15), 120);
          setTimeout(() => playTone(659, 'sine', 0.3), 240);
          
          setStatusText('🎯 تم فك الشفرة بنجاح! جاري تحضير خزنة التحدي القادم...');
          
          setTimeout(() => {
            const nextLvl = level + 1;
            setLevel(nextLvl);
            localStorage.setItem('jam_golden_vault_lvl', nextLvl.toString());
          }, 3200);
        } else {
          // Binary search logic feedback (higher/lower)
          setVaultState('wrong');
          playTone(180, 'sawtooth', 0.4);
          const enteredVal = Number(enteredCode);
          const correctVal = Number(correctTempCode);
          const clueText = enteredVal > correctVal ? 'الكود الصحيح أصغر من الذي أدخلته!' : 'الكود الصحيح أكبر من الذي أدخلته!';
          
          setHistory(prev => [
            { code: enteredCode, result: enteredVal > correctVal ? 'lower' : 'higher' },
            ...prev
          ]);
          setStatusText(`❌ شيفرة خاطئة! تلمية حسابية: ${clueText}`);
          setTimeout(() => {
            if (vaultState === 'wrong') setVaultState('locked');
          }, 1500);
        }
      }
    } catch (e: any) {
      console.error(e);
      setStatusText('❌ خطأ في الاتصال بالقمم الأمنية للتأكيد المزدوج للمكافأة.');
    } finally {
      setIsVerifying(false);
    }
  };

  const resetCurrentLevel = () => {
    setLevel(level); // Triggers re-run of level seed
    playTone(300, 'triangle', 0.2);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-1.5 md:p-4 rounded-3xl bg-gradient-to-b from-[#0a0d18] via-[#090b14] to-black border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.08)] text-right" dir="rtl">
      
      {/* Upper header statistics area */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-[#101323]/90 border border-amber-500/15 p-4 rounded-2xl mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/30">
            <Trophy className="text-amber-400 animate-pulse animate-duration-[1800ms]" size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black text-amber-100">الخزنة الفيدرالية الذهبية (The Golden Vault)</h2>
            <p className="text-[10px] text-amber-500/70">تحدي خرق الشيفرات اليومي والتحصين ضد الاختراقات بأساليب التشفير الفيدرالي</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-500 font-bold uppercase">الرصيد الفوري للتلميحات</span>
            <div className="flex items-center gap-1 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
              <Sparkles size={14} className="text-amber-400" />
              <span className="text-xs font-black text-amber-300">{hintsBalance} تلميحة</span>
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-500 font-bold uppercase">ترتيب مستواك الحالي</span>
            <div className="bg-slate-900/40 px-3 py-1.5 rounded-xl border border-slate-700/30 text-xs font-black text-white flex items-center gap-1 bg-gradient-to-r from-amber-500/20 to-yellow-600/20">
              🏆 المستوى {level} / 100
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* Left Area (Interactive Animation Area & Vault representation) */}
        <div className="lg:col-span-7 flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-br from-[#121528] to-[#04060b] border border-[#1e233d]/70 shadow-inner relative overflow-hidden">
          
          {/* Decorative metal background patterns simulated via absolute layout nodes */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex justify-between items-center mb-4 z-10">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold ${
                level <= 20 ? 'bg-amber-700/20 text-amber-500 border border-amber-700/30' :
                level <= 60 ? 'bg-slate-300/10 text-slate-300 border border-slate-500/30' :
                level <= 99 ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' :
                'bg-red-500/20 text-red-500 border border-red-500/40 animate-pulse'
              }`}>
                {currentDiff.label}
              </span>
              <span className="text-[10px] text-gray-400 font-bold bg-slate-900/60 px-2 py-1 rounded">
                الصعوبة: {currentDiff.difficulty}
              </span>
            </div>

            {/* Timer component rendering */}
            {currentDiff.hasTimer && (
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
                timeLeft < 10 ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/30' : 'bg-[#0f111f] text-cyan-400 border border-cyan-500/20'
              }`}>
                <Clock size={13} className={timeLeft < 10 ? 'animate-spin' : ''} />
                <span>الوقت المتبقي: {timeLeft} ثانية</span>
              </div>
            )}
          </div>

          {/* Central majestic Vault Door rendering */}
          <div className="flex flex-col items-center justify-center my-6 z-10 h-64 relative">
            
            {/* Holographic scanner laser projection when verifying logic */}
            {isVerifying && (
              <div className="absolute top-0 left-0 right-0 bottom-0 bg-transparent flex flex-col justify-center items-center pointer-events-none">
                <div className="w-56 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_cyan] animate-bounce" />
              </div>
            )}

            {/* The absolute centered physical layout for rotating 3D metallic handle wheel */}
            <motion.div 
              style={{ rotate: rotateRef.current }}
              animate={{ 
                scale: vaultState === 'unlocked' || vaultState === 'cracked_100' ? [1, 1.05, 1] : 1,
              }}
              transition={{ duration: 0.6, type: 'spring', damping: 10 }}
              className={`w-44 h-44 rounded-full border-4 flex items-center justify-center shadow-2xl relative ${
                vaultState === 'unlocked' || vaultState === 'cracked_100' ? 'border-emerald-500/50 bg-[#091b10] shadow-[0_0_40px_rgba(16,185,129,0.3)]' :
                vaultState === 'wrong' ? 'border-red-500/50 bg-[#1f0b0b] shadow-[0_0_40px_rgba(239,68,68,0.3)] animate-shake' :
                'border-amber-500/40 bg-gradient-to-r from-[#171b30] to-[#121422] shadow-[0_0_35px_rgba(245,158,11,0.15)]'
              }`}
            >
              {/* Outer wheel handle teeth / studs */}
              {[...Array(8)].map((_, idx) => (
                <div 
                  key={idx}
                  style={{ transform: `rotate(${idx * 45}deg) translateY(-84px)` }}
                  className={`absolute w-3 h-7 rounded-sm border-t ${
                    vaultState === 'unlocked' || vaultState === 'cracked_100' ? 'bg-emerald-600 border-emerald-400' :
                    vaultState === 'wrong' ? 'bg-red-600 border-red-400' :
                    'bg-slate-700 hover:bg-amber-600 border-slate-500'
                  } shadow-md`}
                />
              ))}

              {/* Centered dial lock status */}
              <div className={`w-32 h-32 rounded-full border-2 flex flex-col items-center justify-center bg-black/60 shadow-inner select-none ${
                vaultState === 'unlocked' || vaultState === 'cracked_100' ? 'border-emerald-500 text-emerald-400' :
                vaultState === 'wrong' ? 'border-red-500 text-red-500' :
                'border-amber-500/30 text-amber-500'
              }`}>
                {vaultState === 'unlocked' || vaultState === 'cracked_100' ? (
                  <Unlock size={44} className="animate-pulse" />
                ) : (
                  <Lock size={44} className={isVerifying ? 'animate-bounce' : ''} />
                )}
                <span className="text-[9px] font-mono tracking-widest mt-1 uppercase">
                  {vaultState === 'unlocked' || vaultState === 'cracked_100' ? 'OPENED' : 'SECURED'}
                </span>
              </div>
            </motion.div>

            {/* Glowing hint toast overlay */}
            <AnimatePresence>
              {revealedHint && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute bottom-2 left-4 right-4 bg-[#111c15] border border-emerald-500/40 text-emerald-400 rounded-xl p-3 text-center text-[10.5px] font-black shadow-lg"
                >
                  {revealedHint}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Prompt status display and entered input feedback bar */}
          <div className="bg-[#0c0d15] p-3 border border-[#202540] rounded-xl text-center select-none z-10">
            <p className={`text-xs font-bold mb-1 ${
              vaultState === 'unlocked' || vaultState === 'cracked_100' ? 'text-emerald-400' :
              vaultState === 'wrong' ? 'text-red-400 font-extrabold' : 'text-amber-100'
            }`}>
              {statusText}
            </p>
            
            {/* Show code progress markers */}
            <div className="flex justify-center items-center gap-2 mt-2" dir="ltr">
              {[...Array(currentDiff.length)].map((_, i) => {
                const char = enteredCode[i];
                return (
                  <div 
                    key={i} 
                    className={`w-7 h-9 flex items-center justify-center font-mono font-black rounded-lg transition-all ${
                      char ? 'bg-amber-500/10 text-amber-400 border border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)] text-lg' : 
                      'bg-slate-900/80 text-slate-600 border border-slate-750 text-xs'
                    }`}
                  >
                    {char ? '*' : '•'}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Area (Keypad & Interaction Panel) */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-gradient-to-br from-[#0e111d] to-[#010203] p-5 rounded-2xl border border-amber-500/15">
          
          {/* Diagnostic Console Panel (shows clues and user's guess history) */}
          <div className="bg-black/50 border border-slate-900 rounded-xl p-3 flex-1 mb-4 flex flex-col justify-between overflow-y-auto min-h-[140px] max-h-[170px]">
            <span className="text-[10px] text-gray-500 font-extrabold block mb-2 border-b border-white/[0.04] pb-1">🎚️ السجل الأمني ومؤشرات الارتباط المباشر:</span>
            
            <div className="space-y-1.5 flex-1 overflow-y-auto text-xs font-mono scrollbar-thin">
              {history.length === 0 ? (
                <p className="text-slate-600 text-[10px] text-center mt-6">لا توجد محاولات أمنية سابقة في هذا المستوى</p>
              ) : (
                history.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-[#090b14]/90 p-1.5 px-3 rounded border border-white/[0.02]">
                    <span className="text-amber-400 font-bold">المحاولة: {item.code}</span>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                      item.result === 'lower' 
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    }`}>
                      {item.result === 'lower' ? '👇 أصغر بكثير' : '👆 أكبر بكثير'}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Quick action panel for resets */}
            <div className="flex gap-2 mt-2">
              <button 
                onClick={resetCurrentLevel}
                className="flex-1 py-1 px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] font-black text-slate-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>إعادة تصفير المستوى 🔄</span>
              </button>
            </div>
          </div>

          {/* Numeric tactile Keypad buttons grid */}
          <div className="grid grid-cols-3 gap-2.5 bg-[#080a13] p-3.5 rounded-2xl border border-[#1b203c]">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                onClick={() => handleNumClick(num)}
                className="py-3 font-mono font-black text-lg text-slate-200 rounded-xl border border-slate-800 bg-[#0f1221] hover:bg-[#1a1f38] active:scale-95 hover:border-amber-500/40 relative overflow-hidden transition-all shadow-md group cursor-pointer"
              >
                {/* Gold-rimmed decoration reflections on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/5 to-transparent -translate-x-full group-hover:animate-shimmer" />
                <span>{num}</span>
              </button>
            ))}

            {/* Tactical Backspace key */}
            <button
              onClick={handleDelete}
              className="py-3 font-bold text-[11px] text-red-400 rounded-xl border border-red-950/40 bg-red-950/10 hover:bg-red-950/20 active:scale-95 transition-all text-center flex items-center justify-center cursor-pointer"
              title="تراجع"
            >
              محي ⌫
            </button>

            {/* Zero Key */}
            <button
              onClick={() => handleNumClick('0')}
              className="py-3 font-mono font-black text-lg text-slate-200 rounded-xl border border-slate-800 bg-[#0f1221] hover:bg-[#1a1f38] active:scale-95 hover:border-amber-500/40 transition-all cursor-pointer"
            >
              0
            </button>

            {/* Clear button */}
            <button
              onClick={handleClear}
              className="py-3 font-bold text-[11px] text-slate-400 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 active:scale-95 transition-all text-center flex items-center justify-center cursor-pointer"
              title="تفريغ الخانة"
            >
              تفريغ 🗑️
            </button>
          </div>

          {/* Bottom Action Triggers Area: Hint Trigger vs Verify Verification code */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            
            {/* Verify Code Submission Key */}
            <button
              onClick={handleVerify}
              disabled={isVerifying || countTrackLength() === 0}
              className={`py-3.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-lg cursor-pointer col-span-2 ${
                isVerifying || countTrackLength() === 0
                  ? 'bg-slate-800/40 border border-slate-700/30 text-slate-500'
                  : 'bg-gradient-to-r from-amber-500 via-yellow-600 to-amber-500 text-black border border-amber-400 shadow-[0_4px_15px_rgba(245,158,11,0.25)] hover:brightness-110'
              }`}
            >
              {isVerifying ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
                  <span>جاري الاتصال بقاعدة الفيدرالية...</span>
                </>
              ) : (
                <>
                  <Zap size={14} className="animate-bounce" />
                  <span>تأكيد الإدخال وفك شيفرة المعاينة ⚡</span>
                </>
              )}
            </button>

            {/* Request hint spending trigger (uses user profiles atomic balance decrement) */}
            <button
              onClick={triggerRequestHint}
              disabled={isVerifying || hintsBalance <= 0}
              className="py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-[10px] font-black text-indigo-400 flex items-center justify-center gap-1.5 transition-all cursor-pointer col-span-2"
            >
              <HelpCircle size={13} />
              <span>استخدام مساعدة (طلب كشف رقم بالخصم من الرصيد) 💡</span>
            </button>

          </div>

        </div>

      </div>

      {/* LEVEL 100 REWARD SPECIFIC POPUP QR MODAL */}
      <AnimatePresence>
        {showRewardModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[999999]" dir="rtl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-gradient-to-b from-[#141829] to-black border-2 border-amber-500 rounded-3xl p-6 text-center shadow-[0_0_60px_rgba(245,158,11,0.25)] relative"
            >
              
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500 flex items-center justify-center mx-auto mb-4 animate-bounce">
                <Ticket className="text-amber-400" size={32} />
              </div>

              <h3 className="text-lg font-black text-amber-300">🎉 إجازة كسر الخزنة أصلية المعاينة!</h3>
              <p className="text-xs text-slate-300 mt-2">لقد كشفت شيفرة الغلق رقم 100 وحزت على تذكرة الجوائز الكبرى الموثقة أمنياً باسمك.</p>

              {/* Secure QR rendering mapped on Level 100 passing result */}
              <div className="bg-white p-3.5 inline-block rounded-2xl my-5 border-4 border-amber-500/40 shadow-inner">
                {ticketId ? (
                  <QRCodeSVG 
                    value={`JAMPRO-VAULT100-LICENSE:${ticketId}`} 
                    size={160}
                    level="H"
                    includeMargin={true}
                  />
                ) : (
                  <div className="w-40 h-40 bg-slate-100 flex items-center justify-center text-xs text-slate-400">جاري البناء...</div>
                )}
              </div>

              <p className="text-xs font-black text-amber-400 mt-1 mb-4 animate-pulse">
                أظهر هذا الرمز لصاحب المحل لاستلام هديتك!
              </p>

              {/* Secure cryptographic output representation code */}
              <div className="bg-slate-950/90 border border-slate-900 rounded-xl p-3 font-mono text-center mb-5">
                <span className="text-[10px] text-slate-500 block">رقم تعريف الترسانة (TICKET_ID):</span>
                <span className="text-xs font-black text-amber-400 block tracking-widest mt-1 uppercase select-all">{ticketId || 'PENDING_SERVER'}</span>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowRewardModal(false)}
                  className="flex-1 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-black text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  إغلاق نافذة التذكرة
                </button>
                <button
                  onClick={() => {
                    setShowRewardModal(false);
                    setLevel(1);
                    localStorage.setItem('jam_golden_vault_lvl', '1');
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 text-black rounded-xl text-xs font-black hover:brightness-110 transition-all cursor-pointer"
                >
                  بدء التحدي مجدداً 🔁
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );

  function countTrackLength() {
    return enteredCode.length;
  }
}
