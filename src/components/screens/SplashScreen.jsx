import { useState } from 'react';
import { useGameContext } from '../../context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import HudHeader from '../ui/HudHeader';
import TransitionHud from '../ui/TransitionHud';

const CITY_COORDS = {
  Mumbai:    { coords: '19.0760° N, 72.8777° E', pop: '20.6M', risk: 'LEVEL-4 DELUGE EMERGENCY' },
  Delhi:     { coords: '28.7041° N, 77.1025° E', pop: '32.9M', risk: 'LEVEL-5 HEATWAVE CRISIS' },
  Chennai:   { coords: '13.0827° N, 80.2707° E', pop: '7.1M',  risk: 'LEVEL-3 CYCLONE ALERT' },
  Hyderabad: { coords: '17.3850° N, 78.4867° E', pop: '10.0M', risk: 'LEVEL-3 FLOOD SURGE' },
  Bengaluru: { coords: '12.9716° N, 77.5946° E', pop: '13.2M', risk: 'LEVEL-2 INFRASTRUCTURE FAIL' },
  Kolkata:   { coords: '22.5726° N, 88.3639° E', pop: '14.8M', risk: 'LEVEL-2 MONSOON ALERT' },
};

const DIFFICULTY_CONFIG = {
  hard:   { color: '#ff2a55', label: 'HIGH THREAT',   bg: 'rgba(255,42,85,0.12)',   border: 'rgba(255,42,85,0.6)' },
  medium: { color: '#ffaa00', label: 'MODERATE RISK', bg: 'rgba(255,170,0,0.10)',   border: 'rgba(255,170,0,0.6)' },
  easy:   { color: '#00ff88', label: 'CONTAINED',     bg: 'rgba(0,255,136,0.08)',   border: 'rgba(0,255,136,0.55)' },
};

// Largest size at which the city name still fits on one line inside the card
// (card is at most 28rem wide; each Orbitron capital is roughly 0.85em).
function cityNameFontSize(name) {
  return `min(3.75rem, calc((min(100vw - 2rem, 28rem) - 4.5rem) / ${(name.length * 0.85).toFixed(2)}))`;
}

export default function SplashScreen({
  transitionStage = 'idle',
  onStartTransition,
  onNext,
}) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const { state, dispatch } = useGameContext();

  const isTransitioning = transitionStage !== 'idle' && transitionStage !== 'revealed';
  const isRevealed = transitionStage === 'revealed';
  const isLandingVisible = transitionStage === 'idle';

  const handleStart = (e) => {
    if (e) e.preventDefault();
    if (isTransitioning || isRevealed) return;

    let callsign = nickname.trim();
    if (!callsign) {
      callsign = 'OPERATOR-1';
    } else if (callsign.length < 3 || callsign.length > 10) {
      setError('CALLSIGN MUST BE 3–10 CHARACTERS');
      return;
    }

    dispatch({ type: 'SET_NICKNAME', payload: callsign });
    dispatch({ type: 'ASSIGN_CITY' });

    if (onStartTransition) {
      onStartTransition();
    }
  };

  const city = state.city;
  const meta = (city && CITY_COORDS[city.name]) || { coords: '19.0760° N, 72.8777° E', pop: '20.6M', risk: 'LEVEL-4 DELUGE EMERGENCY' };
  const diffCfg = (city && DIFFICULTY_CONFIG[city.difficulty]) || DIFFICULTY_CONFIG.hard;

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden">
      {/* HUD Header (Visible during Landing & Mission Reveal) */}
      <motion.div
        animate={{ opacity: isTransitioning ? 0 : 1, y: isTransitioning ? -20 : 0 }}
        transition={{ duration: 0.5 }}
        className={isTransitioning ? 'pointer-events-none' : ''}
      >
        <HudHeader />
      </motion.div>

      {/* Transition Progress HUD */}
      <AnimatePresence>
        {isTransitioning && (
          <TransitionHud stage={transitionStage} cityName={city?.name} />
        )}
      </AnimatePresence>

      {/* ── LANDING HERO (Step 1 Fades This Out) ── */}
      <motion.main
        animate={{
          opacity: isLandingVisible ? 1 : 0,
          scale: isLandingVisible ? 1 : 0.96,
          y: isLandingVisible ? 0 : -30,
        }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        className={`relative z-10 flex-1 flex flex-col justify-between p-4 md:p-8 min-h-[calc(100vh-38px)] ${
          !isLandingVisible ? 'pointer-events-none hidden' : ''
        }`}
      >
        {/* Hero Header */}
        <div className="relative z-10 max-w-4xl mx-auto text-center mt-6 md:mt-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center space-x-2 px-3 py-1 bg-cyan-400/10 border border-cyan-400/40 rounded-full mb-4 backdrop-blur-md"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-[11px] tracking-widest text-cyan-400 font-bold uppercase">
              STRATEGIC DISASTER MITIGATION SYSTEM // LEVEL 5 ENGAGEMENT
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, type: 'spring', stiffness: 100 }}
            className="text-5xl sm:text-7xl md:text-8xl font-black uppercase tracking-tight text-white text-glow-cyan hud-title"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            CRISIS<span className="text-cyan-400">.</span>EXE
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-2 text-lg sm:text-2xl font-bold text-slate-300 tracking-[0.15em] uppercase"
            style={{ fontFamily: 'Chakra Petch, sans-serif' }}
          >
            DISASTER RESPONSE <span className="text-cyan-400">COMMAND</span>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-4 text-sm sm:text-base font-mono text-cyan-400/70 max-w-2xl mx-auto leading-relaxed"
          >
            "Every decision saves a life. Every resource counts."
          </motion.p>
          <p className="mt-2 text-xs font-mono text-slate-500 max-w-xl mx-auto">
            Global early-warning sensors have triggered high-tier emergency protocols across high-density urban clusters. Tactical deployment clearance granted.
          </p>
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, type: 'spring' }}
          className="relative z-10 max-w-lg mx-auto w-full my-auto py-8 flex flex-col items-center space-y-6"
        >
          {/* Nickname Input Form */}
          <form onSubmit={handleStart} className="w-full flex flex-col items-center space-y-4">
            <div className="w-full relative">
              <label htmlFor="callsign-input" className="block font-mono text-[11px] text-cyan-400 tracking-[0.15em] uppercase mb-2 text-center hud-legible">
                ENTER OPERATOR CALLSIGN
              </label>
              <div className="relative corner-brackets">
                <input
                  id="callsign-input"
                  type="text"
                  value={nickname}
                  onChange={(e) => { setNickname(e.target.value); setError(''); }}
                  placeholder="CALLSIGN (3–10 CHARS)"
                  maxLength={10}
                  autoComplete="off"
                  disabled={isTransitioning}
                  className="tactical-input text-xl font-bold rounded-sm"
                />
              </div>
              {error && (
                <motion.p
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-red-400 text-xs font-mono mt-2 text-center tracking-wider"
                >
                  ⚠ {error}
                </motion.p>
              )}
            </div>

            <button
              id="btn-play-game"
              type="submit"
              disabled={isTransitioning}
              className="tactical-btn w-full py-4 sm:py-5 text-lg sm:text-xl font-black tracking-widest flex items-center justify-center space-x-3 group cursor-pointer"
              style={{ backgroundColor: 'rgba(3, 10, 20, 0.62)', backdropFilter: 'blur(6px)' }}
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400" />
              </span>
              <span className="group-hover:tracking-[0.25em] transition-all duration-300">
                INITIATE RESPONSE PROTOCOL
              </span>
              <svg className="w-5 h-5 text-cyan-400 group-hover:translate-x-2 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M13 5l7 7-7 7M5 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </button>
          </form>

          <p className="font-mono text-[11px] text-slate-300 tracking-wider text-center hud-legible">
            TACTICAL GRID READY • BROWSER DISPATCH TERMINAL V4.8 • 3-ROUND PROTOCOL
          </p>

          {/* Mini stat chips */}
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {[
              { label: 'CITIES', val: '6' },
              { label: 'DISASTERS', val: '9' },
              { label: 'ROUNDS', val: '3' },
            ].map(({ label, val }) => (
              <div key={label} className="px-3 py-1.5 tactical-clip-sm tactical-panel text-center">
                <div className="text-[10px] font-mono text-slate-500 tracking-widest">{label}</div>
                <div className="text-base font-bold text-cyan-400 font-mono">{val}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer coordinates */}
        <div className="relative z-10 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-300 border-t border-slate-500/40 pt-3 hud-legible">
          <div className="flex space-x-4">
            <span>LAT: 20.59° N</span>
            <span>LON: 78.96° E</span>
            <span>ALT: 412 KM (LEO-ORBIT)</span>
          </div>
          <span>DATA GTC-0026 EXTRACTION // ENCRYPTED QUANTUM STREAM</span>
        </div>
      </motion.main>

      {/* ── CITY MISSION VIEW (Step 6 Reveals This Over 3D Scene) ── */}
      <AnimatePresence>
        {isRevealed && city && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.7, type: 'spring', stiffness: 95 }}
            className="relative z-20 flex-1 flex flex-col items-center justify-center p-4 md:p-8 min-h-[calc(100vh-38px)]"
          >
            {/* Target Lock Card */}
            <div className="relative z-10 w-full max-w-md">
              <div className="mb-4 font-mono text-[10px] text-cyan-400 tracking-widest text-center">
                <span className="inline-block px-3 py-1 rounded-sm bg-black/70 backdrop-blur-sm">[ TARGET LOCK CONFIRMED // SECTOR 81 ]</span>
              </div>

              <div className="tactical-panel tactical-clip corner-brackets p-6 md:p-8 rounded bg-black/75 backdrop-blur-md border border-cyan-400/35 shadow-[0_0_40px_rgba(0,240,255,0.2)]">
                {/* Zone header */}
                <div className="text-center mb-4">
                  <div className="font-mono text-[11px] text-cyan-400/70 tracking-widest uppercase mb-1">
                    ZONE: INDIA // SECTOR 81
                  </div>
                  <motion.h1
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="font-black uppercase text-white text-glow-cyan tracking-wider whitespace-nowrap leading-tight"
                    style={{ fontFamily: 'Orbitron, sans-serif', fontSize: cityNameFontSize(city.name) }}
                  >
                    {city.name}
                  </motion.h1>
                  <div className="mt-2">
                    <span
                      className="inline-block px-3 py-1 text-[11px] font-mono uppercase font-bold rounded-sm border"
                      style={{
                        backgroundColor: diffCfg.bg,
                        borderColor: diffCfg.border,
                        color: diffCfg.color,
                        textShadow: `0 0 6px ${diffCfg.color}`,
                      }}
                    >
                      {meta.risk}
                    </span>
                  </div>
                </div>

                {/* Telemetry grid */}
                <div className="bg-black/60 border border-cyan-400/20 rounded p-3 font-mono text-xs space-y-2 mb-4">
                  {[
                    { label: 'COORDINATES', val: meta.coords, color: '#00f0ff' },
                    { label: 'POP AT RISK',  val: meta.pop,    color: '#ffffff' },
                    { label: 'DIFFICULTY',   val: diffCfg.label, color: diffCfg.color },
                    { label: 'MULTIPLIER',   val: `×${city.multiplier}`, color: '#ffaa00' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-slate-400">{label}:</span>
                      <span style={{ color }}>{val}</span>
                    </div>
                  ))}
                </div>

                {/* Quirk */}
                <div className="border-l-2 border-amber-400/70 pl-3 mb-6">
                  <div className="text-[10px] font-mono text-amber-400/70 tracking-widest uppercase mb-1">TACTICAL QUIRK</div>
                  <p className="text-sm text-slate-300 italic leading-relaxed">"{city.quirk}"</p>
                </div>

                {/* CONTINUE / DEPLOY RESOURCES CTA */}
                <button
                  id="btn-confirm-city"
                  onClick={onNext}
                  className="tactical-btn w-full py-4 text-base font-black tracking-widest flex items-center justify-center space-x-2 cursor-pointer group"
                >
                  <span className="group-hover:tracking-[0.2em] transition-all duration-300">
                    ENGAGE SECTOR DISPATCH
                  </span>
                  <svg className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                  </svg>
                </button>
              </div>

              {/* Scan calibration bar */}
              <div className="mt-4 text-center">
                <p className="inline-block px-3 py-1 rounded-sm bg-black/70 backdrop-blur-sm text-[10px] font-mono text-cyan-400 tracking-widest mb-2">
                  CALIBRATING ORBITAL DRONE RELAYS & EMERGENCY COMM FREQUENCIES...
                </p>
                <div className="w-64 h-1 bg-slate-800 rounded-full mx-auto overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: '#00f0ff', boxShadow: '0 0 8px #00f0ff' }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
