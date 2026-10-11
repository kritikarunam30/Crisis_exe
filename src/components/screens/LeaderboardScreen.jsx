import { useEffect, useState } from 'react';
import { useGameContext } from '../../context/GameContext';
import { getTopScores } from '../../firebase/leaderboard';
import { motion } from 'framer-motion';
import HudHeader from '../ui/HudHeader';

function getRankStyle(i) {
  if (i === 0) return { label: '01', color: '#ffd700', glow: 'rgba(255,215,0,0.5)' };
  if (i === 1) return { label: '02', color: '#c0c0c0', glow: 'rgba(192,192,192,0.4)' };
  if (i === 2) return { label: '03', color: '#cd7f32', glow: 'rgba(205,127,50,0.4)' };
  return { label: String(i + 1).padStart(2, '0'), color: '#4a5568', glow: 'transparent' };
}

export default function LeaderboardScreen({ onNext }) {
  const { dispatch } = useGameContext();
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadScores() {
      try {
        const data = await getTopScores(10);
        setScores(data);
      } catch (e) {
        console.error('Failed to load scores', e);
        setError('TELEMETRY FEED OFFLINE — COULD NOT RETRIEVE SCORES');
      } finally {
        setLoading(false);
      }
    }
    loadScores();
  }, []);

  const handlePlayAgain = () => {
    dispatch({ type: 'RESET' });
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="screen-wrapper flex flex-col"
    >
      <HudHeader />

      <main className="flex-1 flex flex-col items-center p-4 md:p-8 min-h-[calc(100vh-38px)] relative overflow-hidden">

        {/* Background glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(0,240,255,0.05) 0%, transparent 65%)' }}
        />

        <div className="relative z-10 w-full max-w-3xl mt-6 md:mt-10">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-3 border border-amber-400/40 bg-amber-400/10 font-mono text-[11px] text-amber-400 font-bold tracking-widest">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              GLOBAL TELEMETRY RANKINGS
            </div>
            <h1
              className="text-4xl md:text-5xl font-black uppercase text-white text-glow-cyan tracking-wider"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              HALL OF FAME
            </h1>
            <p className="font-mono text-sm text-slate-400 mt-2">TOP OPERATORS BY DISASTER RESPONSE EFFICIENCY</p>
          </motion.div>

          {/* Leaderboard table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="tactical-panel rounded overflow-hidden mb-6"
          >
            {/* Table header */}
            <div className="bg-black/50 border-b border-cyan-400/20 px-4 py-2.5 grid grid-cols-12 font-mono text-[10px] text-slate-500 uppercase tracking-widest">
              <div className="col-span-2">RANK</div>
              <div className="col-span-6">OPERATOR</div>
              <div className="col-span-4 text-right">SCORE</div>
            </div>

            {loading && (
              <div className="p-12 text-center font-mono text-cyan-400/60 animate-pulse tracking-widest text-sm">
                LOADING TELEMETRY DATA...
              </div>
            )}

            {error && (
              <div className="p-8 text-center font-mono text-red-400/70 text-xs tracking-wider">
                ⚠ {error}
              </div>
            )}

            {!loading && !error && scores.map((s, i) => {
              const rank = getRankStyle(i);
              const isTop3 = i < 3;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 + 0.3 }}
                  className="grid grid-cols-12 items-center px-4 py-3 border-b border-slate-800/60 hover:bg-cyan-400/5 transition-colors"
                  style={isTop3 ? { boxShadow: `inset 3px 0 0 ${rank.color}` } : {}}
                >
                  {/* Rank */}
                  <div className="col-span-2">
                    <span
                      className="font-black text-sm font-mono"
                      style={{
                        fontFamily: 'Orbitron, sans-serif',
                        color: rank.color,
                        textShadow: isTop3 ? `0 0 8px ${rank.glow}` : 'none',
                      }}
                    >
                      #{rank.label}
                    </span>
                  </div>

                  {/* Operator */}
                  <div className="col-span-6 flex items-center gap-2">
                    {s ? (
                      <span className="font-bold text-sm text-white uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch, sans-serif' }}>
                        {s.nickname}
                      </span>
                    ) : (
                      <span className="text-slate-600 font-mono text-xs">—</span>
                    )}
                  </div>

                  {/* Score */}
                  <div className="col-span-4 text-right">
                    {s ? (
                      <span
                        className="font-black font-mono text-sm tabular-nums"
                        style={{ color: '#00f0ff', textShadow: isTop3 ? '0 0 8px rgba(0,240,255,0.5)' : 'none', fontFamily: 'Orbitron, sans-serif' }}
                      >
                        {s.score?.toLocaleString() || '0'}
                      </span>
                    ) : (
                      <span className="text-slate-700 font-mono text-xs">—</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Play again */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              id="btn-play-again"
              onClick={handlePlayAgain}
              className="tactical-btn-danger tactical-btn w-full sm:w-auto px-10 py-4 text-base font-black tracking-widest flex items-center justify-center gap-3"
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-400" />
              </span>
              INITIATE NEW PROTOCOL
            </button>
            <p className="font-mono text-[11px] text-slate-600">
              PLAY AGAIN — RESET ALL ROUNDS
            </p>
          </motion.div>
        </div>
      </main>
    </motion.div>
  );
}
