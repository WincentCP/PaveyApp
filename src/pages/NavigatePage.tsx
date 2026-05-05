import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, CheckCircle2, SkipForward, ListTree, X,
  Navigation, AlertTriangle, Clock,
} from 'lucide-react';
import { PaveyLogoMark } from '../components/PaveyLogo';
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

const SKIP_REASONS = ['Closed', 'Too crowded', 'Changed mind', 'Other'];
const RATING_EMOJIS = ['😞', '😐', '😊', '🤩'];

export default function NavigatePage() {
  const nav = useNavigate();
  const {
    itinerary, navIndex, setNavIndex, markVisited, setIsNavigating, completeTrip,
    setBuddyOpen, ratePlace, markVisitedPermanent, removeStop, alternatives,
  } = useApp();
  const { show } = useToast();

  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [nearArrival, setNearArrival] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showBackTooltip, setShowBackTooltip] = useState(false);
  // UI8 — rating overlay
  const [ratingPlace, setRatingPlace] = useState<typeof itinerary[number] | null>(null);
  const ratingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // UI9 — early finish
  const [earlyFinishStop, setEarlyFinishStop] = useState<typeof itinerary[number] | null>(null);
  const visitedAtRef = useRef<number | null>(null);
  // 3A — skip reasons
  const [skipReasonSheet, setSkipReasonSheet] = useState(false);
  const [altPlace, setAltPlace] = useState<typeof itinerary[number] | null>(null);
  // 3B — running late
  const [lateWarning, setLateWarning] = useState(false);
  const [lateMinutes, setLateMinutes] = useState(0);
  const startedAtRef = useRef(Date.now());
  const backTappedRef = useRef(false);
  const backTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptedRef = useRef(false);

  const current = itinerary[navIndex];
  const next = itinerary[navIndex + 1];
  const isLastStop = navIndex >= itinerary.length - 1;

  useEffect(() => {
    if (paused || arrived || !current) return;
    const id = setInterval(() => {
      setProgress((p) => {
        const np = Math.min(0.999, p + 0.012);
        if (np >= 0.97 && !nearArrival) setNearArrival(true);
        if (np > 0.55 && !promptedRef.current) {
          promptedRef.current = true;
          setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
        }
        return np;
      });
    }, 120);
    return () => clearInterval(id);
  }, [paused, arrived, current, nearArrival]);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) setPaused(true); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // 3B — check running late when stop changes
  useEffect(() => {
    const elapsed = (Date.now() - startedAtRef.current) / 60000;
    const expectedMin = itinerary.slice(0, navIndex).reduce((s, p) => s + p.durationMin + 15, 0);
    const over = Math.round(elapsed - expectedMin);
    if (navIndex > 1 && over > 60) {
      setLateMinutes(over);
      setLateWarning(true);
    }
  }, [navIndex]); // eslint-disable-line

  const eta = useMemo(() => {
    if (!current) return '0m';
    return `${Math.round((1 - progress) * 12)} min`;
  }, [progress, current]);

  const distRemain = useMemo(() => {
    if (!current) return '0 km';
    return `${(current.distanceKm * (1 - progress)).toFixed(1)} km`;
  }, [progress, current]);

  // UI3 — time at stop calculation
  const timeAtStop = useMemo(() => {
    if (!current) return null;
    const durationMin = current.durationMin;
    const toNextKm = next?.distanceKm ?? 0;
    const toNextMin = Math.round(toNextKm * 4); // ~15 km/h walking
    return { durationMin, toNextMin, nextName: next?.name };
  }, [current, next]);

  const onMarkVisited = () => {
    if (!current) return;
    markVisited(current.id);
    markVisitedPermanent(current.id);
    visitedAtRef.current = Date.now();
    show(`Marked ${current.name} as visited 🎉`, 'success');

    // UI8 — show rating overlay
    setRatingPlace(current);
    if (ratingTimerRef.current) clearTimeout(ratingTimerRef.current);
    ratingTimerRef.current = setTimeout(() => setRatingPlace(null), 3000);

    // UI9 — simulate early finish (show if not last stop)
    if (!isLastStop) {
      setTimeout(() => {
        setEarlyFinishStop(current);
        setTimeout(() => setEarlyFinishStop(null), 5000);
      }, 3500);
    }
  };

  const onNext = () => {
    if (isLastStop) {
      setShowFinishConfirm(true);
      return;
    }
    setNavIndex(navIndex + 1);
    setProgress(0);
    setArrived(false);
    setNearArrival(false);
    promptedRef.current = false;
    setPrompt(null);
    show(`Heading to ${itinerary[navIndex + 1].name}`, 'info');
  };

  const confirmFinish = () => {
    show('Trip complete! 🎉', 'success');
    setIsNavigating(false);
    completeTrip();
    setShowFinishConfirm(false);
    setTimeout(() => nav('/profile'), 600);
  };

  // 3A — skip: open reason sheet instead of skipping immediately
  const onSkip = () => {
    setSkipReasonSheet(true);
  };

  const confirmSkip = (reason: string) => {
    setSkipReasonSheet(false);
    show(`Skipped ${current?.name} — ${reason}`, 'info');
    // Surface an alternative
    const excludeIds = itinerary.map((p) => p.id);
    const alts = alternatives(excludeIds);
    if (alts.length > 0) setAltPlace(alts[0]);
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

      {/* ── Top bar ── */}
      <div className="px-4 pb-2 flex items-center gap-2 shrink-0">
        <div className="relative">
          <button
            onClick={() => {
              if (!backTappedRef.current) {
                backTappedRef.current = true;
                setShowBackTooltip(true);
                if (backTooltipTimer.current) clearTimeout(backTooltipTimer.current);
                backTooltipTimer.current = setTimeout(() => { setShowBackTooltip(false); backTappedRef.current = false; }, 3000);
              } else {
                nav('/map');
              }
            }}
            className="w-10 h-10 -ml-1 flex items-center justify-center text-ink-700 press"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <AnimatePresence>
            {showBackTooltip && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute top-12 left-0 bg-ink-900 text-white text-xs font-medium rounded-xl px-3 py-2 whitespace-nowrap z-50 shadow-lg"
              >
                Tap again to exit navigation
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 bg-brand-500 text-white rounded-2xl px-4 py-2.5 shadow-glow">
          <div className="flex items-center gap-2">
            <motion.div animate={{ rotate: [0, 15, -10, 5, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}>
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
        >
          <span className="text-ink-800 font-bold text-sm">{paused ? '▶' : '⏸'}</span>
        </button>
      </div>

      {/* 3B — Running late warning */}
      <AnimatePresence>
        {lateWarning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mx-4 mb-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-center gap-2 overflow-hidden"
          >
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-amber-800">Running ~{lateMinutes}min behind schedule</div>
            </div>
            <button
              onClick={() => { if (!isLastStop) removeStop(itinerary[itinerary.length - 1].id); setLateWarning(false); show('Last stop removed', 'info'); }}
              className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg press shrink-0"
            >Remove last</button>
            <button onClick={() => setLateWarning(false)} className="text-amber-400 press shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Map area ── */}
      <div className="flex-1 relative map-bg overflow-hidden">
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

        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M -5 30 Q 30 35, 60 25 T 110 30" stroke="#FFFFFF" strokeWidth="1.4" fill="none" />
          <path d="M -5 60 Q 30 55, 60 65 T 110 60" stroke="#FFFFFF" strokeWidth="1.2" fill="none" />
          <path d="M 30 -5 Q 36 40, 30 60 T 36 110" stroke="#FFFFFF" strokeWidth="1.2" fill="none" />
        </svg>

        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <motion.path d="M 25 78 Q 38 60, 50 50 T 70 26" fill="none" stroke="#3B5BFF" strokeWidth="1.8" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} />
          <motion.path d="M 25 78 Q 38 60, 50 50 T 70 26" fill="none" stroke="#172A8C" strokeWidth="1.8" strokeLinecap="round" style={{ pathLength: progress }} />
        </svg>

        <motion.div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: '70%', top: '26%' }} animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
          <div className="bg-brand-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-card flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-white text-brand-500 flex items-center justify-center text-[11px] font-bold">{navIndex + 1}</span>
            {current.name.split(' ').slice(0, 2).join(' ')}
          </div>
          <div className="w-2 h-2 bg-brand-500 rotate-45 mx-auto -mt-1" />
        </motion.div>

        <UserDot progress={progress} />

        <AnimatePresence>
          {prompt && (
            <motion.div
              initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
              className="absolute top-3 left-3 right-3 bg-white shadow-card rounded-2xl p-3 flex items-start gap-2 z-20"
            >
              <div className="shrink-0 mt-0.5"><PaveyLogoMark size={20} color="#3B5BFF" /></div>
              <div className="text-sm text-ink-800 flex-1">{prompt}</div>
              <button onClick={() => setPrompt(null)} className="text-xs text-ink-500 font-semibold px-2 py-1 press">Dismiss</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3A — Alternative place suggestion */}
        <AnimatePresence>
          {altPlace && (
            <motion.div
              initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
              className="absolute top-3 left-3 right-3 bg-white shadow-card rounded-2xl p-3 z-20"
            >
              <div className="text-xs font-bold text-brand-600 mb-1">Nearby alternative</div>
              <div className="flex items-center gap-2">
                <img src={altPlace.image} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink-900 text-sm truncate">{altPlace.name}</div>
                  <div className="text-xs text-ink-500">{altPlace.distanceKm} km away · {altPlace.durationMin}min</div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => { setAltPlace(null); show(`${altPlace.name} added`, 'success'); }}
                    className="text-[10px] font-bold text-white bg-brand-500 px-2 py-1 rounded-lg press"
                  >Add</button>
                  <button onClick={() => setAltPlace(null)} className="text-[10px] font-semibold text-ink-400 press text-center">Skip</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* UI9 — Early finish banner */}
        <AnimatePresence>
          {earlyFinishStop && next && (
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="absolute bottom-4 inset-x-4 z-20 bg-white rounded-2xl shadow-card p-3 flex items-center gap-3"
            >
              <div className="text-xl">⚡</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink-900">Finished early — head to {next.name} now?</div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => { onNext(); setEarlyFinishStop(null); }} className="text-xs font-bold text-white bg-brand-500 px-2.5 py-1.5 rounded-xl press">Go</button>
                <button onClick={() => setEarlyFinishStop(null)} className="text-xs font-semibold text-ink-500 press">Stay</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {nearArrival && !arrived && (
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="absolute bottom-4 inset-x-4 z-20"
            >
              <button
                onClick={() => { setArrived(true); setNearArrival(false); setProgress(1); }}
                className="w-full h-14 rounded-2xl bg-emerald-500 text-white font-bold shadow-glow press flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" /> I've arrived!
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute top-3 right-3 z-10 space-y-1">
          {itinerary.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-soft ${
                i === navIndex ? 'bg-brand-500 text-white' : i < navIndex ? 'bg-emerald-500/80 text-white' : 'bg-white/90 text-ink-600'
              }`}
            >
              <span>{i < navIndex ? '✓' : i === navIndex ? '→' : String(i + 1)}</span>
              <span className="max-w-[80px] truncate">{p.name.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* UI8 — Rating overlay */}
      <AnimatePresence>
        {ratingPlace && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="absolute inset-x-0 bottom-0 z-60 bg-white rounded-t-3xl shadow-card p-5"
          >
            <div className="text-center">
              <div className="font-bold text-ink-900 font-display mb-1">How was {ratingPlace.name}?</div>
              <div className="text-xs text-ink-500 mb-4">Tap to rate · auto-dismisses</div>
              <div className="flex items-center justify-center gap-4">
                {RATING_EMOJIS.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => { ratePlace(ratingPlace.id, i + 1); setRatingPlace(null); if (ratingTimerRef.current) clearTimeout(ratingTimerRef.current); show(`Thanks for rating ${ratingPlace.name}!`, 'success'); }}
                    className="text-4xl press hover:scale-110 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3A — Skip reasons sheet */}
      <AnimatePresence>
        {skipReasonSheet && current && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSkipReasonSheet(false)} className="absolute inset-0 z-40 bg-ink-900/40" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-8"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3" />
              <div className="px-5 pt-3 pb-4">
                <div className="font-bold text-ink-900 font-display">Why are you skipping?</div>
                <div className="text-xs text-ink-500 mt-0.5">{current.name}</div>
              </div>
              <div className="px-5 grid grid-cols-2 gap-2">
                {SKIP_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => confirmSkip(reason)}
                    className="h-12 rounded-xl bg-ink-50 border border-ink-200 text-ink-800 font-semibold text-sm press hover:border-brand-300 transition-colors"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Cancel confirmation ── */}
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
                <div className="text-sm text-ink-500 mt-1">You've visited {navIndex} of {itinerary.length} stops. Progress will be saved.</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowCancelConfirm(false)} className="flex-1 h-12 rounded-xl bg-ink-50 text-ink-700 font-semibold press">Keep Going</button>
                <button onClick={confirmCancel} className="flex-1 h-12 rounded-xl bg-red-500 text-white font-semibold press">Cancel Trip</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Finish confirmation ── */}
      <AnimatePresence>
        {showFinishConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFinishConfirm(false)} className="absolute inset-0 z-40 bg-ink-900/50" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="absolute inset-x-6 top-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl p-5 shadow-card"
            >
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🏁</div>
                <div className="font-bold text-ink-900 font-display text-lg">Finish your trip?</div>
                <div className="text-sm text-ink-500 mt-1">You've completed all {itinerary.length} stops. This will end navigation.</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowFinishConfirm(false)} className="flex-1 h-12 rounded-xl bg-ink-50 text-ink-700 font-semibold press">Not yet</button>
                <button onClick={confirmFinish} className="flex-1 h-12 rounded-xl bg-brand-500 text-white font-semibold press shadow-glow">Finish trip 🎉</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Sticky bottom card ── */}
      <div className="bg-white px-4 pt-3 pb-5 border-t border-ink-100 shrink-0">
        <AnimatePresence mode="wait">
          {arrived ? (
            <motion.div
              key="arrived"
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-2xl bg-emerald-500 text-white p-4"
            >
              <div className="flex items-center gap-2 font-bold text-lg mb-1">
                <CheckCircle2 className="w-5 h-5" /> You've arrived! 🎉
              </div>
              <div className="text-sm opacity-90 mb-1">{current.name}</div>
              {/* UI3 — Time at stop */}
              {timeAtStop && (
                <div className="text-xs opacity-75 mb-3 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ~{timeAtStop.durationMin}min here
                  {timeAtStop.nextName && ` · then ${timeAtStop.toNextMin}min to ${timeAtStop.nextName.split(' ')[0]}`}
                </div>
              )}
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
            <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                    <motion.div className="h-full bg-brand-500 rounded-full" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.3 }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-ink-400">
                    <span>{Math.round(progress * 100)}%</span>
                    <span>{eta} away · {distRemain}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-2.5">
                <ActionBtn icon={<CheckCircle2 className="w-4 h-4" />} label="Visited" onClick={onMarkVisited} />
                <ActionBtn icon={<SkipForward className="w-4 h-4" />} label="Skip" onClick={onSkip} />
                <ActionBtn icon={<PaveyLogoMark size={16} color="#1E293B" />} label="Buddy" onClick={() => setBuddyOpen(true)} />
              </div>

              <button
                onClick={() => setShowCancelConfirm(true)}
                className="w-full h-10 rounded-xl border border-red-200 text-red-500 text-xs font-semibold press flex items-center justify-center gap-1.5 hover:bg-red-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Cancel Navigation
              </button>

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
    <div className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-200" style={{ left: `${x}%`, top: `${y}%` }}>
      <div className="relative">
        <span className="absolute -inset-3 rounded-full bg-brand-500/30 animate-pulseDot" />
        <span className="block w-4 h-4 rounded-full bg-brand-500 ring-4 ring-white shadow" />
      </div>
    </div>
  );
}
