import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  RotateCcw, 
  Play, 
  ChevronRight, 
  Trophy, 
  CheckCircle2, 
  Cpu, 
  HelpCircle, 
  Sparkles,
  Award,
  Lightbulb,
  Radio,
  Shuffle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Cell {
  id: string;
  type: 'empty' | 'source' | 'bulb' | 'wire-I' | 'wire-L' | 'wire-T' | 'wire-X' | 'block';
  rotation: 0 | 1 | 2 | 3; // 0=0deg, 1=90deg, 2=180deg, 3=270deg
  correctRotation?: number; // One of the rotations that form a path
  powered: boolean;
  row: number;
  col: number;
}

// Sound generator
const playCircuitTone = (freq: number, type: OscillatorType, duration: number) => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio Context blocked or unsupported
  }
};

export default function CircuitGame() {
  const [level, setLevel] = useState<number>(() => {
    return Number(localStorage.getItem('jam_circuit_game_lvl')) || 1;
  });
  
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [gridSize, setGridSize] = useState<number>(3);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [moves, setMoves] = useState<number>(0);
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const [maxHints, setMaxHints] = useState<number>(3);
  const [hintMessage, setHintMessage] = useState<string>('');

  // Directions mapping: N, E, S, W
  const DIRECTIONS = {
    N: { dr: -1, dc: 0, opposite: 'S' },
    E: { dr: 0, dc: 1, opposite: 'W' },
    S: { dr: 1, dc: 0, opposite: 'N' },
    W: { dr: 0, dc: -1, opposite: 'E' }
  } as const;

  type DirKey = 'N' | 'E' | 'S' | 'W';

  // Get ports for a cell based on its type and rotation
  const getCellPorts = (type: string, rotation: number): DirKey[] => {
    let basePorts: DirKey[] = [];
    switch (type) {
      case 'source':
      case 'wire-X':
        basePorts = ['N', 'E', 'S', 'W'];
        break;
      case 'bulb':
        basePorts = ['N', 'E', 'S', 'W'];
        break;
      case 'wire-I': // Straight line: North & South originally
        basePorts = ['N', 'S'];
        break;
      case 'wire-L': // Corner: North & East originally
        basePorts = ['N', 'E'];
        break;
      case 'wire-T': // T-junction: West, North, East originally
        basePorts = ['W', 'N', 'E'];
        break;
      case 'block':
      case 'empty':
      default:
        basePorts = [];
    }

    // Rotate ports: shift right by rotation
    const dirOrder: DirKey[] = ['N', 'E', 'S', 'W'];
    return basePorts.map(p => {
      const idx = dirOrder.indexOf(p);
      const newIdx = (idx + rotation) % 4;
      return dirOrder[newIdx];
    });
  };

  // Generate a guaranteed solvable puzzle
  const generateSolvableCircuit = (lvl: number) => {
    // Determine grid size based on level (max 50)
    let size = 3;
    if (lvl <= 8) size = 3;
    else if (lvl <= 18) size = 4;
    else if (lvl <= 32) size = 5;
    else size = 6; // Impossible levels (Level 33-50)

    setGridSize(size);
    setIsCompleted(false);
    setMoves(0);
    setHintMessage('');

    // Initialize blank grid
    const newGrid: Cell[][] = Array(size).fill(null).map((_, r) => 
      Array(size).fill(null).map((_, c) => ({
        id: `${r}-${c}`,
        type: 'empty',
        rotation: 0,
        powered: false,
        row: r,
        col: c
      }))
    );

    // Place Power Source at (0, 0)
    newGrid[0][0] = {
      id: '0-0',
      type: 'source',
      rotation: 0,
      powered: true,
      row: 0,
      col: 0
    };

    // Place Bulbs at opposite corner(s)
    newGrid[size - 1][size - 1] = {
      id: `${size - 1}-${size - 1}`,
      type: 'bulb',
      rotation: 0,
      powered: false,
      row: size - 1,
      col: size - 1
    };

    // For Level 30+, let's add an extra bulb for extra complexity!
    if (lvl >= 30) {
      newGrid[size - 1][0] = {
        id: `${size - 1}-0`,
        type: 'bulb',
        rotation: 0,
        powered: false,
        row: size - 1,
        col: 0
      };
    }

    // Step 1: Generate a random walking path from source to target bulb to ensure solvability
    const generatePath = (startR: number, startC: number, targetR: number, targetC: number): {r: number, c: number}[] => {
      const path: {r: number, c: number}[] = [{ r: startR, c: startC }];
      let currR = startR;
      let currC = startC;
      const visited = new Set<string>();
      visited.add(`${currR}-${currC}`);

      let attempts = 0;
      while ((currR !== targetR || currC !== targetC) && attempts < 150) {
        attempts++;
        const neighbors: {r: number, c: number, dir: DirKey}[] = [];
        (Object.keys(DIRECTIONS) as DirKey[]).forEach(dir => {
          const nr = currR + DIRECTIONS[dir].dr;
          const nc = currC + DIRECTIONS[dir].dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
            if (!visited.has(`${nr}-${nc}`)) {
              neighbors.push({ r: nr, c: nc, dir });
            }
          }
        });

        if (neighbors.length > 0) {
          // Prefer moving closer to target
          neighbors.sort((a, b) => {
            const distA = Math.abs(a.r - targetR) + Math.abs(a.c - targetC);
            const distB = Math.abs(b.r - targetR) + Math.abs(b.c - targetC);
            return distA - distB;
          });
          
          // Add some randomness but guide to destination
          const next = Math.random() < 0.75 ? neighbors[0] : neighbors[Math.floor(Math.random() * neighbors.length)];
          currR = next.r;
          currC = next.c;
          path.push({ r: currR, c: currC });
          visited.add(`${currR}-${currC}`);
        } else {
          // Dead end, break out and try direct manhattan path
          break;
        }
      }

      // If we didn't reach the target, fill in with Manhattan steps
      while (currR !== targetR || currC !== targetC) {
        if (currR < targetR) currR++;
        else if (currR > targetR) currR--;
        else if (currC < targetC) currC++;
        else if (currC > targetC) currC--;

        if (!path.some(p => p.r === currR && p.c === currC)) {
          path.push({ r: currR, c: currC });
        }
      }

      return path;
    };

    const mainPath = generatePath(0, 0, size - 1, size - 1);
    const paths = [mainPath];

    // If level has a second bulb, generate a path to it as well
    if (lvl >= 30) {
      const secondPath = generatePath(0, 0, size - 1, 0);
      paths.push(secondPath);
    }

    // Step 2: Fit correct wire types along the path(s)
    const allPathCoords = new Set<string>();
    paths.forEach(p => p.forEach(cell => allPathCoords.add(`${cell.r}-${cell.c}`)));

    // Set wire types for path cells based on their connection needs
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if ((r === 0 && c === 0) || (r === size - 1 && c === size - 1) || (lvl >= 30 && r === size - 1 && c === 0)) {
          continue; // Keep source/bulb types
        }

        const isPath = allPathCoords.has(`${r}-${c}`);
        if (isPath) {
          // Analyze incoming/outgoing directions for this cell from the paths
          const connectedDirs = new Set<DirKey>();
          paths.forEach(path => {
            path.forEach((p, idx) => {
              if (p.r === r && p.c === c) {
                if (idx > 0) {
                  const prev = path[idx - 1];
                  const dr = prev.r - r;
                  const dc = prev.col !== undefined ? (prev as any).col - c : prev.c - c;
                  if (dr === -1 && dc === 0) connectedDirs.add('N');
                  else if (dr === 0 && dc === 1) connectedDirs.add('E');
                  else if (dr === 1 && dc === 0) connectedDirs.add('S');
                  else if (dr === 0 && dc === -1) connectedDirs.add('W');
                }
                if (idx < path.length - 1) {
                  const next = path[idx + 1];
                  const dr = next.r - r;
                  const dc = next.col !== undefined ? (next as any).col - c : next.c - c;
                  if (dr === -1 && dc === 0) connectedDirs.add('N');
                  else if (dr === 0 && dc === 1) connectedDirs.add('E');
                  else if (dr === 1 && dc === 0) connectedDirs.add('S');
                  else if (dr === 0 && dc === -1) connectedDirs.add('W');
                }
              }
            });
          });

          const dirs = Array.from(connectedDirs);
          let type: 'wire-I' | 'wire-L' | 'wire-T' | 'wire-X' = 'wire-I';
          let correctRot: 0 | 1 | 2 | 3 = 0;

          if (dirs.length === 1) {
            type = 'wire-I';
            correctRot = (dirs.includes('N') || dirs.includes('S')) ? 0 : 1;
          } else if (dirs.length === 2) {
            // Check if opposite directions (Straight line)
            if ((dirs.includes('N') && dirs.includes('S')) || (dirs.includes('E') && dirs.includes('W'))) {
              type = 'wire-I';
              correctRot = dirs.includes('N') ? 0 : 1;
            } else {
              // Corner wire
              type = 'wire-L';
              if (dirs.includes('N') && dirs.includes('E')) correctRot = 0;
              else if (dirs.includes('E') && dirs.includes('S')) correctRot = 1;
              else if (dirs.includes('S') && dirs.includes('W')) correctRot = 2;
              else if (dirs.includes('W') && dirs.includes('N')) correctRot = 3;
            }
          } else if (dirs.length === 3) {
            type = 'wire-T';
            if (dirs.includes('W') && dirs.includes('N') && dirs.includes('E')) correctRot = 0;
            else if (dirs.includes('N') && dirs.includes('E') && dirs.includes('S')) correctRot = 1;
            else if (dirs.includes('E') && dirs.includes('S') && dirs.includes('W')) correctRot = 2;
            else if (dirs.includes('S') && dirs.includes('W') && dirs.includes('N')) correctRot = 3;
          } else if (dirs.length >= 4) {
            type = 'wire-X';
            correctRot = 0;
          }

          newGrid[r][c] = {
            id: `${r}-${c}`,
            type,
            rotation: correctRot, // Initially aligned
            correctRotation: correctRot,
            powered: false,
            row: r,
            col: c
          };
        } else {
          // Random filler wire
          const types: ('wire-I' | 'wire-L' | 'wire-T' | 'wire-X' | 'block')[] = ['wire-I', 'wire-L', 'wire-T'];
          // High levels can have unmovable blocks
          if (lvl >= 25 && Math.random() < 0.15) {
            newGrid[r][c] = {
              id: `${r}-${c}`,
              type: 'block',
              rotation: 0,
              powered: false,
              row: r,
              col: c
            };
          } else {
            const randomType = types[Math.floor(Math.random() * types.length)];
            const randRot = Math.floor(Math.random() * 4) as (0 | 1 | 2 | 3);
            newGrid[r][c] = {
              id: `${r}-${c}`,
              type: randomType,
              rotation: randRot,
              powered: false,
              row: r,
              col: c
            };
          }
        }
      }
    }

    // Step 3: Randomize rotations of ALL movable wires so the user must solve it!
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = newGrid[r][c];
        if (cell.type !== 'source' && cell.type !== 'bulb' && cell.type !== 'empty' && cell.type !== 'block') {
          cell.rotation = Math.floor(Math.random() * 4) as (0 | 1 | 2 | 3);
        }
      }
    }

    // Solve initial power status
    recalculatePower(newGrid, size);
  };

  // Recalculate power routing across the grid
  const recalculatePower = (currentGrid: Cell[][], size: number) => {
    // Reset power status
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        currentGrid[r][c].powered = (currentGrid[r][c].type === 'source');
      }
    }

    // BFS Queue for electrical routing
    const queue: Cell[] = [];
    // Find all power sources
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (currentGrid[r][c].type === 'source') {
          queue.push(currentGrid[r][c]);
        }
      }
    }

    const visited = new Set<string>();

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const key = `${curr.row}-${curr.col}`;
      if (visited.has(key)) continue;
      visited.add(key);

      curr.powered = true;

      // Get ports available for current cell
      const activePorts = getCellPorts(curr.type, curr.rotation);

      // Check all directions
      activePorts.forEach(dir => {
        const diff = DIRECTIONS[dir];
        const nr = curr.row + diff.dr;
        const nc = curr.col + diff.dc;

        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          const neighbor = currentGrid[nr][nc];
          if (!visited.has(`${nr}-${nc}`)) {
            // Check if neighbor has matching connecting port
            const neighborPorts = getCellPorts(neighbor.type, neighbor.rotation);
            if (neighborPorts.includes(diff.opposite as DirKey)) {
              queue.push(neighbor);
            }
          }
        }
      });
    }

    // Determine win state: ALL bulbs are powered
    let win = true;
    let bulbCount = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (currentGrid[r][c].type === 'bulb') {
          bulbCount++;
          if (!currentGrid[r][c].powered) {
            win = false;
          }
        }
      }
    }

    if (bulbCount === 0) win = false;

    setGrid([...currentGrid]);

    if (win) {
      setIsCompleted(true);
      playCircuitTone(523.25, 'sine', 0.25);
      setTimeout(() => playCircuitTone(659.25, 'sine', 0.25), 120);
      setTimeout(() => playCircuitTone(783.99, 'sine', 0.5), 240);

      confetti({
        particleCount: 100,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#06b6d4', '#22c55e', '#fbbf24']
      });

      // Save level progress
      const nextLvl = Math.min(50, level + 1);
      setTimeout(() => {
        if (level < 50) {
          setLevel(nextLvl);
          localStorage.setItem('jam_circuit_game_lvl', nextLvl.toString());
        }
      }, 2500);
    }
  };

  // Run on level change
  useEffect(() => {
    generateSolvableCircuit(level);
  }, [level]);

  // Click on a wire cell to rotate it 90 deg
  const handleCellClick = (r: number, c: number) => {
    if (isCompleted) return;
    const cell = grid[r][c];

    // Cannot rotate sources, bulbs, blocks, or empty cells
    if (cell.type === 'source' || cell.type === 'bulb' || cell.type === 'empty' || cell.type === 'block') {
      return;
    }

    playCircuitTone(400 + (cell.rotation * 80), 'triangle', 0.08);

    const updatedGrid = grid.map(row => row.map(colCell => {
      if (colCell.id === cell.id) {
        return {
          ...colCell,
          rotation: ((colCell.rotation + 1) % 4) as (0 | 1 | 2 | 3)
        };
      }
      return colCell;
    }));

    setMoves(prev => prev + 1);
    recalculatePower(updatedGrid, gridSize);
  };

  // Provide a smart hint by fixing/aligning one of the incorrect pathway wires
  const handleGetHint = () => {
    if (isCompleted || hintsUsed >= maxHints) {
      setHintMessage('🚫 نفذ رصيد المساعدات المتاحة لهذا المستوى!');
      playCircuitTone(150, 'sawtooth', 0.2);
      return;
    }

    // Find any wire cell that is on the correct path but has incorrect rotation
    const incorrectPathCell: Cell[] = [];
    grid.forEach(row => row.forEach(cell => {
      if (cell.correctRotation !== undefined && cell.rotation !== cell.correctRotation) {
        incorrectPathCell.push(cell);
      }
    }));

    if (incorrectPathCell.length > 0) {
      // Choose one randomly and fix its rotation
      const target = incorrectPathCell[Math.floor(Math.random() * incorrectPathCell.length)];
      
      const updatedGrid = grid.map(row => row.map(colCell => {
        if (colCell.id === target.id) {
          return {
            ...colCell,
            rotation: target.correctRotation as (0 | 1 | 2 | 3)
          };
        }
        return colCell;
      }));

      setHintsUsed(prev => prev + 1);
      setHintMessage(`💡 تم تدوير أحد الموصلات التالفة بالاتجاه السليم!`);
      playCircuitTone(880, 'sine', 0.25);
      recalculatePower(updatedGrid, gridSize);
    } else {
      setHintMessage('💡 تبدو مساراتك الكهربائية ممتازة، تأكد من إكمال المسار لللمبة!');
    }
  };

  // Reset the current level entirely
  const resetLevel = () => {
    generateSolvableCircuit(level);
    playCircuitTone(250, 'triangle', 0.2);
  };

  // Next level trigger manual override if completed
  const handleNextLevel = () => {
    if (level < 50) {
      const nextLvl = level + 1;
      setLevel(nextLvl);
      localStorage.setItem('jam_circuit_game_lvl', nextLvl.toString());
    }
  };

  // Get difficulty category text
  const getDifficultyCategory = (lvl: number) => {
    if (lvl <= 10) return { label: 'سهل (برونزي) 🟢', color: 'text-green-400 border-green-500/30 bg-green-500/10' };
    if (lvl <= 25) return { label: 'متوسط (فضي) 🔵', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' };
    if (lvl <= 40) return { label: 'صعب جداً (بلاتيني) 🟡', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' };
    return { label: 'مستحيل تماماً (أسطوري) 🔥', color: 'text-red-500 border-red-500/40 bg-red-500/15 animate-pulse' };
  };

  const diff = getDifficultyCategory(level);

  return (
    <div className="w-full max-w-4xl mx-auto p-1.5 md:p-4 rounded-3xl bg-gradient-to-b from-[#0b0f19] via-[#090b13] to-black border border-cyan-500/20 shadow-[0_0_50px_rgba(6,182,212,0.08)] text-right" dir="rtl">
      
      {/* Game Title Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-[#0d1222]/90 border border-cyan-500/15 p-4 rounded-2xl mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Cpu className="text-cyan-400 animate-pulse" size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black text-cyan-100">تحدي الشبكة الكهربائية والدوائر المغلقة (Circuit Connect)</h2>
            <p className="text-[10px] text-cyan-500/70">قم بتدوير التوصيلات والقطع التالفة لتشكيل تيار مستمر وتوهج المصباح النهائي</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700/30 text-xs font-black text-white flex items-center gap-1 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
            🏆 مستوى التحدي {level} / 50
          </div>
          <span className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black border ${diff.color}`}>
            {diff.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* Playfield Area */}
        <div className="lg:col-span-8 flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-br from-[#0c0f1f] to-[#04060c] border border-cyan-500/10 shadow-inner relative overflow-hidden min-h-[420px]">
          
          {/* Cybernetic Grid Overlay background decoration */}
          <div className="absolute inset-0 bg-[radial-gradient(#0891b2_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.03] pointer-events-none" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="flex justify-between items-center mb-4 z-10">
            <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
              <span className="bg-slate-900/50 px-2.5 py-1 rounded border border-white/5">حجم الشبكة: {gridSize}x{gridSize}</span>
              <span className="bg-slate-900/50 px-2.5 py-1 rounded border border-white/5">عدد النقرات: <span className="text-cyan-400 font-mono">{moves}</span></span>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={resetLevel}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all border border-white/5 flex items-center gap-1 text-[10px] font-black"
                title="إعادة تعيين اللغز"
              >
                <RotateCcw size={12} />
                إعادة البدء
              </button>
            </div>
          </div>

          {/* Interactive Circuit Grid Display */}
          <div className="flex items-center justify-center my-6 z-10">
            <div 
              className="grid gap-3 p-4 bg-slate-950/80 rounded-3xl border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.15)] relative"
              style={{
                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                width: gridSize === 3 ? '240px' : gridSize === 4 ? '310px' : gridSize === 5 ? '360px' : '400px',
                height: gridSize === 3 ? '240px' : gridSize === 4 ? '310px' : gridSize === 5 ? '360px' : '400px',
              }}
            >
              {grid.map((row, rIdx) => 
                row.map((cell, cIdx) => {
                  const isPowerSource = cell.type === 'source';
                  const isBulb = cell.type === 'bulb';
                  const isBlock = cell.type === 'block';

                  return (
                    <motion.button
                      key={cell.id}
                      onClick={() => handleCellClick(rIdx, cIdx)}
                      whileHover={{ scale: isBlock ? 1 : 1.05 }}
                      whileTap={{ scale: isBlock ? 1 : 0.95 }}
                      className={`relative flex items-center justify-center rounded-xl transition-all border outline-none overflow-hidden ${
                        isPowerSource 
                          ? 'bg-gradient-to-tr from-cyan-600 to-blue-500 text-white border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-default'
                          : isBulb
                            ? cell.powered
                              ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-white border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.6)] cursor-default'
                              : 'bg-slate-900 text-slate-500 border-slate-800 cursor-default'
                            : isBlock
                              ? 'bg-red-950/40 text-red-600 border-red-950/80 cursor-default shadow-inner'
                              : cell.powered
                                ? 'bg-[#0f1d2e] text-cyan-400 border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                                : 'bg-slate-900/60 text-slate-600 border-white/5 hover:border-cyan-500/20'
                      }`}
                    >
                      {/* Interactive wire paths inside cell */}
                      <div 
                        className="w-full h-full flex items-center justify-center transition-transform duration-300"
                        style={{ transform: `rotate(${cell.rotation * 90}deg)` }}
                      >
                        {isPowerSource && (
                          <div className="relative">
                            <Zap size={22} className="text-white animate-pulse" />
                            {/* Energy ripples */}
                            <span className="absolute inset-0 bg-white/20 rounded-full animate-ping scale-150" />
                          </div>
                        )}

                        {isBulb && (
                          <div className="relative">
                            <Lightbulb size={24} className={cell.powered ? "text-yellow-200" : "text-slate-600"} />
                            {cell.powered && (
                              <motion.span 
                                animate={{ opacity: [0.3, 0.7, 0.3] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="absolute -inset-1 bg-yellow-500/30 rounded-full blur" 
                              />
                            )}
                          </div>
                        )}

                        {isBlock && (
                          <span className="text-xs font-black select-none">⛔</span>
                        )}

                        {cell.type === 'wire-I' && (
                          <svg className="w-full h-full" viewBox="0 0 100 100">
                            {/* Draw straight vertical line */}
                            <line 
                              x1="50" y1="0" x2="50" y2="100" 
                              stroke={cell.powered ? "#06b6d4" : "#1e293b"} 
                              strokeWidth="8" 
                              strokeLinecap="round"
                            />
                            {cell.powered && (
                              <line 
                                x1="50" y1="0" x2="50" y2="100" 
                                stroke="#fff" 
                                strokeWidth="3" 
                                strokeLinecap="round"
                                className="animate-pulse"
                              />
                            )}
                          </svg>
                        )}

                        {cell.type === 'wire-L' && (
                          <svg className="w-full h-full" viewBox="0 0 100 100">
                            {/* Draw corner curve from Top to Right */}
                            <path 
                              d="M 50 0 Q 50 50 100 50" 
                              fill="none" 
                              stroke={cell.powered ? "#06b6d4" : "#1e293b"} 
                              strokeWidth="8" 
                              strokeLinecap="round"
                            />
                            {cell.powered && (
                              <path 
                                d="M 50 0 Q 50 50 100 50" 
                                fill="none" 
                                stroke="#fff" 
                                strokeWidth="3" 
                                strokeLinecap="round"
                                className="animate-pulse"
                              />
                            )}
                          </svg>
                        )}

                        {cell.type === 'wire-T' && (
                          <svg className="w-full h-full" viewBox="0 0 100 100">
                            {/* Draw West to East, and Top connection */}
                            <path 
                              d="M 0 50 L 100 50 M 50 50 L 50 0" 
                              fill="none" 
                              stroke={cell.powered ? "#06b6d4" : "#1e293b"} 
                              strokeWidth="8" 
                              strokeLinecap="round"
                            />
                            {cell.powered && (
                              <path 
                                d="M 0 50 L 100 50 M 50 50 L 50 0" 
                                fill="none" 
                                stroke="#fff" 
                                strokeWidth="3" 
                                strokeLinecap="round"
                              />
                            )}
                          </svg>
                        )}

                        {cell.type === 'wire-X' && (
                          <svg className="w-full h-full" viewBox="0 0 100 100">
                            <line 
                              x1="50" y1="0" x2="50" y2="100" 
                              stroke={cell.powered ? "#06b6d4" : "#1e293b"} 
                              strokeWidth="8" 
                            />
                            <line 
                              x1="0" y1="50" x2="100" y2="50" 
                              stroke={cell.powered ? "#06b6d4" : "#1e293b"} 
                              strokeWidth="8" 
                            />
                            {cell.powered && (
                              <>
                                <line x1="50" y1="0" x2="50" y2="100" stroke="#fff" strokeWidth="3" />
                                <line x1="0" y1="50" x2="100" y2="50" stroke="#fff" strokeWidth="3" />
                              </>
                            )}
                          </svg>
                        )}
                      </div>
                    </motion.button>
                  );
                })
              )}

              {/* Holographic overlay when puzzle completed */}
              <AnimatePresence>
                {isCompleted && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-[#020617]/90 rounded-3xl flex flex-col items-center justify-center gap-3 border-2 border-emerald-500/40 p-4"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500 animate-bounce">
                      <CheckCircle2 className="text-emerald-400" size={24} />
                    </div>
                    <h3 className="text-white text-base font-black">اكتمل التوصيل بنجاح! 🎉</h3>
                    <p className="text-gray-400 text-[10px] text-center px-4">تم تشغيل المصابيح وتوليد طاقة مستقرة. رصيدك الفني يتصاعد!</p>
                    
                    {level < 50 ? (
                      <button 
                        onClick={handleNextLevel}
                        className="mt-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-[0_4px_12px_rgba(16,185,129,0.3)] cursor-pointer"
                      >
                        التحدي التالي
                        <ChevronRight size={14} />
                      </button>
                    ) : (
                      <div className="px-3 py-1 bg-yellow-500/15 border border-yellow-500/30 rounded-lg text-yellow-500 font-bold text-xs flex items-center gap-1">
                        <Award size={14} />
                        لقد أكملت جميع الـ 50 مستوى بنجاح أسطوري!
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Hint messages */}
          {hintMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/80 border border-cyan-500/20 p-2.5 rounded-xl text-center text-[10.5px] font-bold text-cyan-300 mb-2.5"
            >
              {hintMessage}
            </motion.div>
          )}

          <div className="text-center text-[9.5px] text-gray-500 font-bold mt-2">
            💡 اضغط على القطع السلكية لتدويرها حتى تتدفق الطاقة من المولّد المائي (الأزرق ⚡) إلى المصابيح (الصفراء 💡).
          </div>
        </div>

        {/* Level Selector & Statistics Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Level description detail card */}
          <div className="p-4 rounded-2xl bg-[#0d1223] border border-cyan-500/10 space-y-3.5">
            <h4 className="text-xs font-black text-cyan-300 uppercase tracking-widest">توجيه فني للغز الحالي</h4>
            
            <div className="text-xs leading-relaxed text-gray-400 space-y-2 font-bold">
              <p>• في المستويات المتقدمة (فوق المستوى 20)، يتم حشو الشبكة بالعديد من المسارات المزيفة والعقبات والكتل غير القابلة للحركة.</p>
              <p>• المستويات من 41 إلى 50 مستحيلة الحل تقريباً ومصممة بدقة فيدرالية تتطلب تدوير الأطراف لضمان بقاء الشبكة مستقرة.</p>
            </div>

            <div className="border-t border-white/5 pt-3">
              <span className="block text-[9px] text-gray-500 font-black mb-1.5 uppercase">مساعدات المهندس</span>
              <button 
                onClick={handleGetHint}
                disabled={isCompleted || hintsUsed >= maxHints}
                className="w-full py-2 px-3 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 hover:from-cyan-500/20 hover:to-blue-500/20 text-cyan-300 disabled:opacity-40 disabled:pointer-events-none rounded-xl border border-cyan-500/20 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Sparkles size={13} className="text-cyan-400 animate-spin animate-duration-[2500ms]" />
                طلب مساعدة فنية ({maxHints - hintsUsed} متبقي)
              </button>
            </div>
          </div>

          {/* Quick Level Selector Grid */}
          <div className="p-4 rounded-2xl bg-[#090b14] border border-white/5 flex flex-col gap-3 flex-1">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black text-white">خريطة المستويات (50 مستوى)</h4>
              <span className="text-[10px] text-gray-500 font-bold">انتقل لأي تحدي</span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 overflow-y-auto no-scrollbar max-h-[195px] p-1 bg-slate-950/60 rounded-xl border border-white/5">
              {Array.from({ length: 50 }).map((_, idx) => {
                const lvlNum = idx + 1;
                // Determine if unlocked
                const isUnlocked = lvlNum <= Math.max(level, 1);
                const isCurrent = lvlNum === level;

                return (
                  <button
                    key={lvlNum}
                    onClick={() => {
                      if (isUnlocked) {
                        setLevel(lvlNum);
                        playCircuitTone(500 + (lvlNum * 10), 'sine', 0.1);
                      }
                    }}
                    disabled={!isUnlocked}
                    className={`h-9 rounded-lg text-xs font-black flex items-center justify-center transition-all ${
                      isCurrent
                        ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)] border border-cyan-400'
                        : isUnlocked
                          ? 'bg-slate-900 text-cyan-400 hover:bg-slate-800 border border-white/5'
                          : 'bg-slate-950 text-gray-800 border-transparent opacity-30 cursor-not-allowed'
                    }`}
                  >
                    {lvlNum}
                  </button>
                );
              })}
            </div>

            <button 
              onClick={() => {
                setLevel(1);
                localStorage.setItem('jam_circuit_game_lvl', '1');
                generateSolvableCircuit(1);
                playCircuitTone(200, 'sawtooth', 0.3);
              }}
              className="mt-auto w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <RotateCcw size={11} />
              تصفير كل التقدم والبدء من المستوى الأول
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
