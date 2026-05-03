import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, CheckCircle2, SkipForward, Smile, ListTree, X,
  Navigation, AlertTriangle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/Toast';

const PROMPTS = [
  '🌧 Rain in 15 mins — want indoor options nearby?',
  '💸 Next stop is above your budget — suggest alternative?',
  '📍 You\'re close! Ready to check in?',
];

export default function NavigatePage() {
  const nav = useNavigate();
  const { itinerary, navIndex, setNavIndex, markVisited, setIsNavigating, completeTrip } = useApp();
  const { show } = useToast();

  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [arrived, setArrived] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const promptedRef = useRef(false);

  const current = itinerary[navIndex];
  const next = itinerary[navIndex + 1];
  const isLastStop = navIndex >= itinerary.length - 1;

  useEffect(() => {
    if (paused || arrived || !current) return;
    const id = setInterval(() => {
      setProgress((p) => {
        const np = Math.min(1, p + 0.012);
        if (np >= 1) setArrived(true);
        if (np > 0.55 && !promptedRef.current) {
          promptedRef.current = true;
          setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
        }
        return np;
      });
    }, 120);
    return () => clearInterval(id);
  }, [paused, arrived, current]);

  const eta = useMemo(() => {
    if (!current) return '0m';
    return `${Math.round((1 - progress) * 12)} min`;
  }, [progress, current]);

  const distRemain = useMemo(() => {
    if (!current) return '0 km';
    return `${(current.distanceKm * (1 - progress)).toFixed(1)} km`;
  }, [progress, current]);

  const onMarkVisited = () => {
    if (!current) return;
    markVisited(current.id);
    show(`Marked ${current.name} as visited 🎉`, 'success');
  };

  const onNext = () => {
    if (isLastStop) {
      show('Trip complete! 🎉', 'success');
      setIsNavigating(false);
      completeTrip();
      setTimeout(() => nav('/profile'), 600);
      return;
    }
    setNavIndex(navIndex + 1);
    setProgress(0);
    setArrived(false);
    promptedRef.current = false;
    setPrompt(null);
    show(`Heading to ${itinerary[navIndex + 1].name}`, 'info');
  };

  const onSkip = () => {
    show(`Skipped ${current?.name}`, 'info');
    onNext();
  };

  const confirmCancel = () => {
    setIsNavigating(false);
    setShowCancelConfirm(false);
    nav('/map');
  };

  if (!current) {
    return (
      <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-6 gap-4">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <div className="text-ink-700 font-semibold text-center">No active route. Go back to the map to start navigation.</div>
        <button onClick={() => nav('/map')} className="px-6 py-3 bg-brand-500 text-white rounded-2xl font-bold press shadow-glow">
          Back to Map
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-white overflow-hidden">
      <StatusBar />

      {/* ── Persistent top bar — destination + ETA + pause ── */}
      <div className="px-4 pb-2 flex items-center gap-2 shrink-0">
        <button
          onClick={() => nav('/map')}
          className="w-10 h-10 -ml-1 flex items-center justify-center text-ink-700 press"
          aria-label="Back to map"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 bg-brand-500 text-white rounded-2xl px-4 py-2.5 shadow-glow">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 15, -10, 5, 0] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            >
              <Navigation className="w-4 h-4 opacity-90" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wide opacity-80">Navigating to</div>
              <div className="font-bold leading-tight truncate text-sm">{current.name}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-bold text-sm">{eta}</div>
              <div className="text-[11px] opacity-80">{distRemain}</div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setPaused((p) => !p)}
          className="w-10 h-10 rounded-full bg-ink-50 flex items-center justify-center press shrink-0"
          aria-label={paused ? 'Resume' : 'Pause'}
        >
          <span className="text-ink-800 font-bold text-sm">{paused ? '▶' : '⏸'}</span>
        </button>
      </div>

      {/* ── Map area ── */}
      <div className="flex-1 relative map-bg overflow-hidden">
        {/* Paused overlay */}
        <AnimatePresence>
          {paused && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/30 z-10 flex items-center justify-center"
            >
              <div className="bg-white rounded-2xl px-5 py-3 shadow-card flex items-center gap-3">
                <span className="text-2xl">⏸</span>
                <div>
                  <div className="font-bold text-ink-900">Navigation paused</div>
                  <div className="text-xs text-ink-500">Tap ▶ to resume</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Location error overlay */}
        <AnimatePresence>
          {locationError && (
            <motion.div
              initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
              className="absolute top-3 left-3 right-3 z-20 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2"
            >
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-amber-800 text-sm">Enable location to continue</div>
                <div className="text-xs text-amber-700 mt-0.5">Navigation uses your location for accurate directions</div>
              </div>
              <button
                onClick={() => setLocationError(false)}
                className="text-xs font-bold text-amber-700 px-2 py-1 bg-amber-100 rounded-lg press shrink-0"
              >
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M -5 30 Q 30 35, 60 25 T 110 30" stroke="#FFFFFF" strokeWidth="1.4" fill="none" />
          <path d="M -5 60 Q 30 55, 60 65 T 110 60" stroke="#FFFFFF" strokeWidth="1.2" fill="none" />
          <path d="M 30 -5 Q 36 40, 30 60 T 36 110" stroke="#FFFFFF" strokeWidth="1.2" fill="none" />
        </svg>

        {/* Route line */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <motion.path
            d="M 25 78 Q 38 60, 50 50 T 70 26"
            fill="none" stroke="#3B5BFF" strokeWidth="1.8" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }}
          />
          <motion.path
            d="M 25 78 Q 38 60, 50 50 T 70 26"
            fill="none" stroke="#172A8C" strokeWidth="1.8" strokeLinecap="round"
            style={{ pathLength: progress }}
          />
        </svg>

        {/* Destination marker */}
        <motion.div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: '70%', top: '26%' }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <div className="bg-brand-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-card flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-white text-brand-500 flex items-center justify-center text-[11px] font-bold">{navIndex + 1}</span>
            {current.name.split(' ').slice(0, 2).join(' ')}
          </div>
          <div className="w-2 h-2 bg-brand-500 rotate-45 mx-auto -mt-1" />
        </motion.div>

        {/* User dot */}
        <UserDot progress={progress} />

        {/* Buddy prompt */}
        <AnimatePresence>
          {prompt && (
            <motion.div
              initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
              className="absolute top-3 left-3 right-3 bg-white shadow-card rounded-2xl p-3 flex items-start gap-2 z-20"
            >
              <Smile className="w-5 h-5 text-brand-500 mt-0.5 shrink-0" />
              <div className="text-sm text-ink-800 flex-1">{prompt}</div>
              <button onClick={() => setPrompt(null)} className="text-xs text-ink-500 font-semibold px-2 py-1 press">Dismiss</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* All stops mini list (top-right) */}
        <div className="absolute top-3 right-3 z-10 space-y-1">
          {itinerary.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-soft ${
                i === navIndex
                  ? 'bg-brand-500 text-white'
                  : i < navIndex
                    ? 'bg-emerald-500/80 text-white'
                    : 'bg-white/90 text-ink-600'
              }`}
            >
              <span>{i < navIndex ? '✓' : i === navIndex ? '→' : String(i + 1)}</span>
              <span className="max-w-[80px] truncate">{p.name.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cancel confirmation modal ── */}
      <AnimatePresence>
        {showCancelConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCancelConfirm(false)} className="absolute inset-0 z-40 bg-ink-900/50" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="absolute inset-x-6 top-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl p-5 shadow-card"
            >
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🛑</div>
                <div className="font-bold text-ink-900 font-display text-lg">Cancel navigation?</div>
                <div className="text-sm text-ink-500 mt-1">
                  You've visited {navIndex} of {itinerary.length} stops. Progress will be saved.
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowCancelConfirm(false)} className="flex-1 h-12 rounded-xl bg-ink-50 text-ink-700 font-semibold press">Keep Going</button>
                <button onClick={confirmCancel} className="flex-1 h-12 rounded-xl bg-red-500 text-white font-semibold press">Cancel Trip</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Sticky bottom card ── */}
      <div className="bg-white px-4 pt-3 pb-5 border-t border-ink-100 shrink-0">
        <AnimatePresence mode="wait">
          {arrived ? (
            /* ── Arrived state ── */
            <motion.div
              key="arrived"
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-2xl bg-emerald-500 text-white p-4"
            >
              <div className="flex items-center gap-2 font-bold text-lg mb-1">
                <CheckCircle2 className="w-5 h-5" /> You've arrived! 🎉
              </div>
              <div className="text-sm opacity-90 mb-3">{current.name}</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onMarkVisited}
                  className="bg-white text-emerald-600 rounded-xl py-2.5 text-sm font-semibold press flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Mark visited
                </button>
                <button
                  onClick={onNext}
                  className="bg-ink-900 text-white rounded-xl py-2.5 text-sm font-semibold press flex items-center justify-center gap-1.5"
                >
                  {isLastStop ? 'Finish trip 🏁' : 'Next stop ›'}
                </button>
              </div>
            </motion.div>
          ) : (
            /* ── In-progress state ── */
            <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Current stop card */}
              <div className="flex items-center gap-3 mb-3">
                <div className="relative shrink-0">
                  <img src={current.image} alt="" className="w-14 h-14 rounded-xl object-cover" />
                  <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                    {navIndex + 1}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-ink-900 truncate">{current.name}</div>
                  <div className="text-xs text-ink-500">{current.category} · {current.openingHours}</div>
                  <div className="mt-2 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-brand-500 rounded-full"
                      animate={{ width: `${progress * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-ink-400">
                    <span>{Math.round(progress * 100)}%</span>
                    <span>{eta} away · {distRemain}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-3 gap-2 mb-2.5">
                <ActionBtn icon={<CheckCircle2 className="w-4 h-4" />} label="Visited" onClick={onMarkVisited} />
                <ActionBtn icon={<SkipForward className="w-4 h-4" />} label="Skip" onClick={onSkip} />
                <ActionBtn icon={<Smile className="w-4 h-4" />} label="Buddy" onClick={() => show('Tap the Buddy button to get help', 'info')} />
              </div>

              {/* Cancel button */}
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="w-full h-10 rounded-xl border border-red-200 text-red-500 text-xs font-semibold press flex items-center justify-center gap-1.5 hover:bg-red-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Cancel Navigation
              </button>

              {/* Up next preview */}
              {next && (
                <div className="mt-2.5 flex items-center gap-2 text-[11px] text-ink-500 bg-ink-50 rounded-xl px-3 py-2">
                  <ListTree className="w-3.5 h-3.5 shrink-0" />
                  <span>After this:</span>
                  <img src={next.image} alt="" className="w-5 h-5 rounded-lg object-cover" />
                  <span className="font-semibold text-ink-700 truncate">{next.name}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="press flex flex-col items-center gap-1 bg-ink-50 rounded-xl py-2.5 text-ink-800 text-[11px] font-semibold">
      {icon}
      {label}
    </button>
  );
}

function UserDot({ progress }: { progress: number }) {
  const t = progress;
  const x = (1 - t) * (1 - t) * 25 + 2 * (1 - t) * t * 50 + t * t * 70;
  const y = (1 - t) * (1 - t) * 78 + 2 * (1 - t) * t * 50 + t * t * 26;
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-200"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div className="relative">
        <span className="absolute -inset-3 rounded-full bg-brand-500/30 animate-pulseDot" />
        <span className="block w-4 h-4 rounded-full bg-brand-500 ring-4 ring-white shadow" />
      </div>
    </div>
  );
}
