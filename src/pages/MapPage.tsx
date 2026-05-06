import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, Crosshair, List, Navigation, X, MapPin,
  Clock, Star, DollarSign, Bookmark,
  ChevronUp, Map, Pencil, Wand2, CalendarDays, AlertTriangle,
  Palmtree, Flame, Wind, Diamond, Scale,
} from 'lucide-react';
import { PaveyLogoMark } from '../components/PaveyLogo';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import PageHeader from '../components/PageHeader';
import { useApp } from '../context/AppContext';
import { formatCost } from '../lib/format';
import type { Currency } from '../data/wallet';
import { useToast } from '../components/Toast';
import type { Place, Vibe } from '../data/places';
import { getCulturalIntel } from '../data/cultural';
import TimePicker from '../components/TimePicker';

type ViewMode = 'map' | 'list';

const MAP_VIBES: { id: Vibe; label: string; tint: string }[] = [
  { id: 'chill', label: 'Chill', tint: '#10B981' },
  { id: 'chaos', label: 'Chaos', tint: '#F97316' },
  { id: 'zen', label: 'Zen', tint: '#3B5BFF' },
  { id: 'luxury', label: 'Luxury', tint: '#A855F7' },
  { id: 'balanced', label: 'Balanced', tint: '#6B7280' },
];

export default function MapPage() {
  const nav = useNavigate();
  const {
    itinerary, setIsNavigating, setNavIndex, removeStop, addStop, isNavigating,
    savePlace, removeSavedPlace, isSaved,
    destinations, activeDestIdx, setActiveDestIdx, activeTrip,
    setVibe, budget, setBudget,
  } = useApp();
  const { show } = useToast();
  const [view, setView] = useState<ViewMode>('map');
  const [selected, setSelected] = useState<Place | null>(null);
  // Issue 14: undo on remove
  const [mapUndoItem, setMapUndoItem] = useState<Place | null>(null);
  const mapUndoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Intent sheet (mirrors HomePage flow)
  const [intentSheet, setIntentSheet] = useState<'ai' | 'manual' | null>(null);
  const [intentDest, setIntentDest] = useState('');
  const [intentDate, setIntentDate] = useState('');
  const [intentEndDate, setIntentEndDate] = useState('');
  const [intentStartTime, setIntentStartTime] = useState('09:00');
  const [intentEndTime, setIntentEndTime] = useState('17:00');
  const [intentEndTimeSet, setIntentEndTimeSet] = useState(false);
  const [intentVibe, setIntentVibe] = useState<Vibe | null>(null);
  const [intentBudget, setIntentBudget] = useState<number | null>(null);
  const [intentErrors, setIntentErrors] = useState<{ dest?: string; date?: string }>({});

  useEffect(() => {
    if (intentDate && !intentEndDate) setIntentEndDate(intentDate);
  }, [intentDate, intentEndDate]);

  useEffect(() => {
    if (intentEndTimeSet) return;
    const [h, m] = intentStartTime.split(':').map(Number);
    const eh = (h + 8) % 24;
    setIntentEndTime(`${String(eh).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }, [intentStartTime, intentEndTimeSet]);

  const openIntentSheet = (mode: 'ai' | 'manual') => {
    setIntentDest(destinations[activeDestIdx]?.name.split(',')[0] ?? '');
    setIntentDate('');
    setIntentEndDate('');
    setIntentStartTime('09:00');
    setIntentEndTimeSet(false);
    setIntentVibe(null);
    setIntentBudget(null);
    setIntentErrors({});
    setIntentSheet(mode);
  };

  const handleIntentConfirm = () => {
    const errs: { dest?: string; date?: string } = {};
    if (!intentDest.trim()) errs.dest = 'Please enter your destination to continue';
    if (!intentDate) errs.date = 'Please pick a start date to continue';
    if (Object.keys(errs).length > 0) { setIntentErrors(errs); return; }
    setIntentErrors({});
    if (intentVibe) setVibe(intentVibe);
    if (intentBudget) setBudget(intentBudget);
    const mode = intentSheet;
    setIntentSheet(null);
    const params = new URLSearchParams();
    if (mode === 'manual') params.set('mode', 'manual');
    if (intentStartTime) params.set('startTime', intentStartTime);
    if (intentEndTime) params.set('endTime', intentEndTime);
    nav(`/generate${params.toString() ? `?${params}` : ''}`);
  };

  const handleRemoveStop = (place: Place) => {
    // Issue 34: block removal during navigation
    if (isNavigating) {
      show('Cannot remove stops while navigating', 'info');
      return;
    }
    removeStop(place.id);
    setMapUndoItem(place);
    if (mapUndoTimer.current) clearTimeout(mapUndoTimer.current);
    mapUndoTimer.current = setTimeout(() => setMapUndoItem(null), 6000);
    show(`Removed ${place.name}`, 'info');
  };

  // Active destination's itinerary: use full itinerary for active tab, empty for others
  const activeItinerary = itinerary;

  const totals = useMemo(() => {
    const cost = activeItinerary.reduce((s, p) => s + p.cost, 0);
    const time = activeItinerary.reduce((s, p) => s + p.durationMin, 0);
    const dist = activeItinerary.reduce((s, p) => s + p.distanceKm, 0);
    return { cost, time, dist };
  }, [activeItinerary]);

  const startNavigation = () => {
    // Issue 15: disable when no stops
    if (activeItinerary.length === 0) {
      show('Add stops before starting navigation', 'info');
      return;
    }
    setIsNavigating(true);
    setNavIndex(0);
    show('Starting your journey…', 'info');
    setTimeout(() => nav('/navigate'), 240);
  };

  const hasMultiDest = destinations.length > 1;

  return (
    <div className="absolute inset-0 bg-white flex flex-col">
      <StatusBar />

      {/* Header */}
      <PageHeader
        icon={Map}
        title="Map"
        sub={destinations.length > 0
          ? `${destinations[activeDestIdx]?.name ?? 'My Trip'} · ${activeItinerary.length} stops`
          : `${activeItinerary.length} stop${activeItinerary.length !== 1 ? 's' : ''}`}
        right={
          <button
            onClick={() => setView(view === 'map' ? 'list' : 'map')}
            className="press flex items-center gap-1.5 px-3 h-9 rounded-full bg-ink-50 text-ink-800 text-xs font-semibold"
          >
            <List className="w-4 h-4" /> {view === 'map' ? 'List' : 'Map'}
          </button>
        }
      />

      {/* ── Destination Switcher ── */}
      {hasMultiDest && (
        <div className="px-5 pb-2 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {destinations.map((d, i) => (
              <motion.button
                key={d.id}
                whileTap={{ scale: 0.94 }}
                onClick={() => setActiveDestIdx(i)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold press transition-colors whitespace-nowrap ${
                  i === activeDestIdx
                    ? 'bg-brand-500 text-white shadow-glow'
                    : 'bg-ink-50 text-ink-700 border border-ink-100'
                }`}
              >
                {i === activeDestIdx && (
                  <motion.span
                    layoutId="dest-active"
                    className="inline-block w-1.5 h-1.5 rounded-full bg-white mr-1.5 mb-0.5"
                  />
                )}
                {d.name.split(',')[0]}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {view === 'map' ? (
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeDestIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0"
            >
              <MapStage itinerary={activeItinerary} onPin={setSelected} />
            </motion.div>
          </AnimatePresence>

          <div className="absolute right-3 top-3 flex flex-col gap-2 z-20">
            <button onClick={() => show('Recentered on you', 'info')} className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center press">
              <Crosshair className="w-4 h-4 text-ink-700" />
            </button>
            <button onClick={() => nav('/generate?edit=1')} className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center press">
              <Pencil className="w-4 h-4 text-ink-700" />
            </button>
            <button onClick={startNavigation} disabled={activeItinerary.length === 0} className="w-10 h-10 rounded-full bg-brand-500 disabled:bg-ink-300 shadow-glow flex items-center justify-center press">
              <Navigation className="w-4 h-4 text-white" />
            </button>
          </div>

          {activeItinerary.length === 0 ? (
            <EmptyDestState
              destName={destinations[activeDestIdx]?.name.split(',')[0] ?? 'this destination'}
              onAiGenerate={() => openIntentSheet('ai')}
              onManual={() => openIntentSheet('manual')}
            />
          ) : (
            <ItineraryBottomSheet itinerary={activeItinerary} totals={totals} onStart={startNavigation} onRemove={handleRemoveStop} onEdit={() => nav('/generate?edit=1')} currency={activeTrip.currency} />
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 pb-40 no-scrollbar">
          {activeItinerary.length === 0 ? (
            <EmptyDestState
              destName={destinations[activeDestIdx]?.name.split(',')[0] ?? 'this destination'}
              onAiGenerate={() => openIntentSheet('ai')}
              onManual={() => openIntentSheet('manual')}
              inline
            />
          ) : (
            <ListView itinerary={activeItinerary} onStart={startNavigation} totals={totals} onPin={setSelected} onRemove={handleRemoveStop} onEdit={() => nav('/generate?edit=1')} currency={activeTrip.currency} />
          )}
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <PlaceCard
            place={selected}
            index={activeItinerary.findIndex((p) => p.id === selected.id)}
            prevPlace={activeItinerary[activeItinerary.findIndex((p) => p.id === selected.id) - 1]}
            onClose={() => setSelected(null)}
            onNavigate={() => { setSelected(null); startNavigation(); }}
            isSaved={isSaved(selected.id)}
            onSave={() => isSaved(selected.id) ? removeSavedPlace(selected.id) : savePlace(selected)}
            currency={activeTrip.currency}
          />
        )}
      </AnimatePresence>

      {/* Issue 14: undo snackbar */}
      <AnimatePresence>
        {mapUndoItem && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="absolute bottom-28 inset-x-4 z-50 bg-ink-900 text-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-xl"
          >
            <span className="text-sm font-medium truncate mr-3">{mapUndoItem.name} removed</span>
            <button
              onClick={() => { addStop(mapUndoItem); if (mapUndoTimer.current) clearTimeout(mapUndoTimer.current); setMapUndoItem(null); show('Stop restored', 'success'); }}
              className="text-brand-300 font-bold text-sm shrink-0 press"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Intent Sheet */}
      <AnimatePresence>
        {intentSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIntentSheet(null)} className="absolute inset-0 z-40 bg-ink-900/40" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-10 max-h-[92%] flex flex-col"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3 shrink-0" />
              <div className="px-5 pt-3 pb-2 flex items-center justify-between shrink-0">
                <div>
                  <div className="font-bold text-ink-900 font-display text-base">
                    {intentSheet === 'ai' ? '✨ Plan with AI' : '🗺️ Build your plan'}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    Fields marked <span className="text-red-400 font-semibold">*</span> are required
                  </div>
                </div>
                <button onClick={() => setIntentSheet(null)} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
              </div>

              <div className="overflow-y-auto no-scrollbar px-5 pb-4 space-y-5 flex-1">

                {/* WHERE */}
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-2">
                    WHERE <span className="text-red-400 font-bold">*</span>
                  </div>
                  <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border-2 transition-colors ${intentErrors.dest ? 'bg-red-50 border-red-400' : 'bg-ink-50 border-transparent focus-within:border-brand-400'}`}>
                    <MapPin className={`w-4 h-4 shrink-0 ${intentErrors.dest ? 'text-red-400' : 'text-ink-400'}`} />
                    <input
                      value={intentDest}
                      onChange={(e) => { setIntentDest(e.target.value); if (e.target.value.trim()) setIntentErrors((p) => ({ ...p, dest: undefined })); }}
                      placeholder={destinations[activeDestIdx]?.name.split(',')[0] ?? 'e.g. Ubud, Bali'}
                      className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none"
                    />
                    {intentDest && <button onClick={() => setIntentDest('')}><X className="w-3.5 h-3.5 text-ink-400" /></button>}
                  </div>
                  {intentErrors.dest && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {intentErrors.dest}
                    </div>
                  )}
                  {destinations.length > 1 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {destinations.map((d) => (
                        <button key={d.id} onClick={() => { setIntentDest(d.name.split(',')[0]); setIntentErrors((p) => ({ ...p, dest: undefined })); }}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold press border transition-colors ${intentDest === d.name.split(',')[0] ? 'bg-brand-500 text-white border-brand-500' : 'bg-ink-50 text-ink-700 border-ink-100'}`}>
                          {d.name.split(',')[0]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* WHEN */}
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-3">WHEN</div>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div>
                      <div className="text-[10px] font-semibold text-ink-500 mb-1.5 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> Start date <span className="text-red-400">*</span>
                      </div>
                      <input type="date" value={intentDate}
                        onChange={(e) => { setIntentDate(e.target.value); if (e.target.value) setIntentErrors((p) => ({ ...p, date: undefined })); }}
                        className={`w-full rounded-xl px-3 py-2 text-xs border outline-none focus:border-brand-400 ${intentErrors.date ? 'border-red-400 bg-red-50 text-red-700' : 'bg-ink-50 text-ink-700 border-ink-200'}`}
                      />
                      {intentErrors.date && (
                        <div className="flex items-center gap-1 text-xs text-red-600 mt-1.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" /> {intentErrors.date}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-ink-500 mb-1.5 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> End date
                      </div>
                      <input type="date" value={intentEndDate} min={intentDate || undefined}
                        onChange={(e) => setIntentEndDate(e.target.value)}
                        className="w-full bg-ink-50 rounded-xl px-3 py-2 text-xs text-ink-700 border border-ink-200 outline-none focus:border-brand-400" />
                      <div className="text-[9px] text-ink-400 mt-1">Defaults to same day</div>
                    </div>
                  </div>

                  <TimePicker label="START TIME" value={intentStartTime} onChange={(v) => setIntentStartTime(v)} />
                  <div className="mt-3">
                    <TimePicker label="END TIME" value={intentEndTime}
                      onChange={(v) => { setIntentEndTime(v); setIntentEndTimeSet(true); }}
                      warnIfBefore={intentDate === intentEndDate ? intentStartTime : undefined} />
                  </div>
                  {intentDate === intentEndDate && intentEndTime && intentEndTime <= intentStartTime && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> End time is before start time — the schedule may be incorrect.
                    </div>
                  )}
                </div>

                {/* Vibe */}
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-2">VIBE</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {MAP_VIBES.map((v) => {
                      const Icon = v.id === 'chill' ? Palmtree : v.id === 'chaos' ? Flame : v.id === 'zen' ? Wind : v.id === 'balanced' ? Scale : Diamond;
                      const active = intentVibe === v.id;
                      return (
                        <button key={v.id} onClick={() => setIntentVibe(v.id)}
                          className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 border-2 press transition-colors ${active ? 'border-brand-500 bg-brand-50' : 'border-ink-100 bg-white'}`}>
                          <Icon className="w-5 h-5" style={{ color: active ? '#3B5BFF' : v.tint }} strokeWidth={2.2} />
                          <span className={`text-[9px] font-semibold ${active ? 'text-brand-600' : 'text-ink-700'}`}>{v.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Budget */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-bold tracking-widest text-ink-500">BUDGET <span className="font-normal normal-case tracking-normal text-ink-400">(per stop)</span></div>
                    <div className="text-sm font-bold text-brand-600">{formatCost(intentBudget ?? budget, activeTrip.currency)}</div>
                  </div>
                  <input type="range" min={50_000} max={1_000_000} step={10_000}
                    value={intentBudget ?? budget} onChange={(e) => setIntentBudget(Number(e.target.value))}
                    className="vibe-slider w-full"
                    style={{ ['--val' as string]: `${Math.max(0, Math.min(100, (((intentBudget ?? budget) - 50_000) / 950_000) * 100))}%` } as React.CSSProperties} />
                  <div className="flex gap-2 mt-2">
                    {[150_000, 300_000, 600_000].map((v) => (
                      <button key={v} onClick={() => setIntentBudget(v)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-semibold press border transition-colors ${(intentBudget ?? budget) === v ? 'bg-brand-500 text-white border-brand-500' : 'bg-ink-50 text-ink-700 border-ink-100'}`}>
                        {formatCost(v, activeTrip.currency)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-5 pt-3 shrink-0 border-t border-ink-100">
                <button onClick={handleIntentConfirm}
                  className="w-full h-14 rounded-2xl bg-brand-500 text-white font-bold text-base press shadow-glow flex items-center justify-center gap-2">
                  {intentSheet === 'ai' ? <><Wand2 className="w-5 h-5" /> Generate my plan</> : <><Pencil className="w-5 h-5" /> Start planning</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Empty state for a destination with no plan ── */
function EmptyDestState({
  destName, onAiGenerate, onManual, inline = false,
}: {
  destName: string; onAiGenerate: () => void; onManual: () => void; inline?: boolean;
}) {
  const inner = (
    <>
      <div className="text-4xl mb-3">🗺️</div>
      <div className="font-bold text-ink-900 font-display">No plan for {destName}</div>
      <div className="text-sm text-ink-500 mt-1 mb-4">How do you want to plan your day?</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onAiGenerate}
          className="h-12 rounded-2xl bg-brand-500 text-white font-bold shadow-glow press flex items-center justify-center gap-2"
        >
          <Wand2 className="w-4 h-4" /> AI Plan
        </button>
        <button
          onClick={onManual}
          className="h-12 rounded-2xl border-2 border-brand-200 text-brand-600 font-bold press flex items-center justify-center gap-2"
        >
          <Pencil className="w-4 h-4" /> Manual
        </button>
      </div>
    </>
  );

  if (inline) {
    return <div className="mt-10 text-center py-8 px-4">{inner}</div>;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="absolute inset-x-0 bottom-0 z-10 bg-white rounded-t-3xl shadow-card p-5 pb-28"
    >
      <div className="text-center">{inner}</div>
    </motion.div>
  );
}

/* ---------------- MAP STAGE ----------------- */

function MapStage({ itinerary, onPin }: { itinerary: Place[]; onPin: (p: Place) => void }) {
  const positions = [
    { x: 70, y: 18 }, { x: 60, y: 34 }, { x: 46, y: 50 }, { x: 62, y: 64 }, { x: 30, y: 72 },
  ];
  const pts = itinerary.map((_, i) => positions[i % positions.length]);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="absolute inset-0 map-bg isolate">
      <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="#C7D2FE" strokeWidth="0.05" />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="#C7D2FE" strokeWidth="0.05" />
        ))}
      </svg>

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M -5 30 Q 30 35, 60 25 T 110 30" stroke="#FFFFFF" strokeWidth="1.4" fill="none" />
        <path d="M -5 60 Q 30 55, 60 65 T 110 60" stroke="#FFFFFF" strokeWidth="1.2" fill="none" />
        <path d="M 30 -5 Q 36 40, 30 60 T 36 110" stroke="#FFFFFF" strokeWidth="1.2" fill="none" />
        <path d="M 70 -5 Q 64 40, 72 60 T 70 110" stroke="#FFFFFF" strokeWidth="1.4" fill="none" />
      </svg>

      {pts.length > 0 && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <motion.path
            d={path} fill="none" stroke="#3B5BFF" strokeWidth="0.9" strokeLinecap="round"
            strokeDasharray="2 1.4"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
      )}

      <div className="absolute" style={{ left: '24%', top: '68%' }}>
        <div className="relative">
          <span className="absolute -inset-3 rounded-full bg-brand-500/30 animate-pulseDot" />
          <span className="block w-4 h-4 rounded-full bg-brand-500 ring-4 ring-white shadow" />
        </div>
      </div>

      {itinerary.map((p, i) => {
        const pos = pts[i];
        return (
          <motion.button
            key={p.id} onClick={() => onPin(p)}
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 400, damping: 18 }}
            whileTap={{ scale: 0.92 }}
            className="absolute press z-20 flex flex-col items-center"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translateX(-50%) translateY(-100%)' }}
          >
            <div className="mb-1 bg-white/95 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-ink-900 shadow-soft whitespace-nowrap border border-white">
              {p.name.split(' ').slice(0, 2).join(' ')}
            </div>
            <div className="w-8 h-8 rounded-full bg-brand-500 text-white text-sm font-bold flex items-center justify-center ring-[3px] ring-white shadow-card">
              {i + 1}
            </div>
            <div className="w-2 h-2 rotate-45 bg-brand-500 -mt-1 shadow-sm" />
          </motion.button>
        );
      })}
    </div>
  );
}

/* --------------- BOTTOM SHEET (collapsible) --------------- */

function ItineraryBottomSheet({ itinerary, totals, onStart, onRemove, onEdit, currency }: {
  itinerary: Place[]; totals: { cost: number; time: number; dist: number }; onStart: () => void; onRemove: (p: Place) => void; onEdit: () => void; currency: Currency;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ y: 120 }} animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      className="absolute inset-x-0 bottom-0 z-30 bg-white rounded-t-3xl shadow-card pb-28"
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex flex-col items-center pt-3 pb-2 press"
      >
        <div className="w-12 h-1.5 bg-ink-200 rounded-full" />
        <div className="flex items-center gap-1 text-[10px] text-ink-400 font-medium mt-1">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          {expanded ? 'Hide stops' : `${itinerary.length} stops · tap to expand`}
        </div>
      </button>

      <div className="px-5 grid grid-cols-3 text-center mb-3">
        <Block label="Est. Time" value={`${Math.floor(totals.time / 60)}h ${totals.time % 60}m`} />
        <Block label="Distance" value={`${totals.dist.toFixed(1)} km`} />
        <Block label="Est. Cost" value={formatCost(totals.cost, currency)} />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 max-h-[32vh] overflow-y-auto no-scrollbar space-y-2 mb-3">
              {itinerary.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 bg-white rounded-2xl p-2.5 border border-ink-100">
                  <div className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                  <img src={p.image} alt={p.name} className="w-11 h-11 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink-900 truncate text-sm">{p.name}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-ink-500 mt-0.5">
                      <Clock className="w-3 h-3 text-brand-500" />
                      <span className="text-brand-600 font-semibold">{nineColon(i)}</span>
                      <span className="text-ink-300">·</span>
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{p.rating}
                    </div>
                  </div>
                  <div className="text-right shrink-0 mr-1">
                    <div className="text-xs text-brand-600 font-semibold">{formatCost(p.priceRange.min, currency)}</div>
                    {p.priceRange.max !== p.priceRange.min && (
                      <div className="text-[10px] text-ink-400">– {formatCost(p.priceRange.max, currency)}</div>
                    )}
                  </div>
                  <button
                    onClick={() => onRemove(p)}
                    className="w-7 h-7 rounded-full bg-ink-50 hover:bg-red-50 flex items-center justify-center press shrink-0 transition-colors"
                    aria-label="Remove stop"
                  >
                    <X className="w-3.5 h-3.5 text-ink-400 hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-5 space-y-2">
        <button onClick={onEdit} className="w-full h-10 rounded-2xl border border-brand-200 text-brand-600 text-xs font-semibold press flex items-center justify-center gap-1.5">
          <Pencil className="w-3.5 h-3.5" /> Edit Plan
        </button>
        <button onClick={onStart} disabled={itinerary.length === 0} className="w-full h-12 bg-brand-500 disabled:bg-ink-200 disabled:text-ink-400 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-glow press disabled:shadow-none">
          <Navigation className="w-4 h-4" /> Start Navigation
        </button>
      </div>
    </motion.div>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-base font-bold text-ink-900 font-display">{value}</div>
      <div className="text-[11px] text-ink-500">{label}</div>
    </div>
  );
}

function nineColon(i: number, addMin = 0) {
  const start = 10 * 60 + 30 + i * 150 + addMin;
  const h = Math.floor(start / 60) % 24;
  const m = start % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* ----------------- LIST VIEW ----------------- */

function ListView({ itinerary, onStart, totals, onPin, onRemove, onEdit, currency }: {
  itinerary: Place[]; onStart: () => void; totals: { cost: number; time: number; dist: number }; onPin: (p: Place) => void; onRemove: (p: Place) => void; onEdit: () => void; currency: Currency;
}) {
  return (
    <div className="pt-2">
      <div className="grid grid-cols-3 bg-ink-50 rounded-2xl p-3 mb-4">
        <Block label="Time" value={`${Math.floor(totals.time / 60)}h ${totals.time % 60}m`} />
        <Block label="Distance" value={`${totals.dist.toFixed(1)} km`} />
        <Block label="Cost" value={formatCost(totals.cost, currency)} />
      </div>
      <div className="space-y-4">
        {itinerary.map((p, i) => (
          <div key={p.id}>
            {i > 0 && (
              <div className="flex items-center gap-2 py-1 px-2">
                <div className="flex-1 h-px bg-ink-100" />
                <span className="text-[10px] text-ink-400 font-medium shrink-0">
                  📍 {p.distanceKm} km · ~{Math.round(p.distanceKm * 3)} min drive
                </span>
                <div className="flex-1 h-px bg-ink-100" />
              </div>
            )}
            <div className="relative">
              <button
                onClick={() => onPin(p)}
                className="w-full rounded-2xl border border-ink-100 overflow-hidden press hover:border-brand-200 transition-colors text-left"
              >
              <div className="relative h-28">
                <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center ring-2 ring-white">
                  {i + 1}
                </div>
                <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                  <div>
                    <div className="text-white font-bold text-sm leading-tight">{p.name}</div>
                    <div className="text-white/80 text-xs">{p.category}</div>
                  </div>
                  <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="text-white text-xs font-semibold">{p.rating}</span>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1 text-ink-600">
                    <Clock className="w-3.5 h-3.5 text-ink-400" />
                    <span>{p.openingHours}</span>
                  </div>
                  <div className="flex items-center gap-1 text-ink-600">
                    <DollarSign className="w-3.5 h-3.5 text-ink-400" />
                    <span>{formatCost(p.priceRange.min, currency)}{p.priceRange.max !== p.priceRange.min ? '+' : ''}</span>
                  </div>
                  <div className="text-right text-[11px] text-brand-600 font-semibold">
                    {nineColon(i)} – {nineColon(i, p.durationMin)}
                  </div>
                </div>
                <div className="text-xs text-ink-500 mt-1.5 line-clamp-2">{p.description}</div>
              </div>
              </button>
              {/* Inline remove button */}
              <button
                onClick={() => onRemove(p)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center press z-10 transition-colors hover:bg-red-500/70"
                aria-label="Remove stop"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-2">
        <button onClick={onEdit} className="w-full h-10 rounded-2xl border border-brand-200 text-brand-600 text-xs font-semibold press flex items-center justify-center gap-1.5">
          <Pencil className="w-3.5 h-3.5" /> Edit Plan
        </button>
        <button onClick={onStart} disabled={itinerary.length === 0} className="w-full h-12 bg-brand-500 disabled:bg-ink-200 disabled:text-ink-400 text-white font-bold rounded-2xl shadow-glow press disabled:shadow-none flex items-center justify-center gap-2">
          <Navigation className="w-4 h-4" /> Start Navigation
        </button>
      </div>
    </div>
  );
}

/* ----------------- PLACE CARD (slides from bottom) ----------------- */

function PlaceCard({ place, index, prevPlace, onClose, onNavigate, isSaved, onSave, currency }: {
  place: Place; index: number; prevPlace?: Place; onClose: () => void; onNavigate: () => void;
  isSaved: boolean; onSave: () => void; currency: Currency;
}) {
  const [culturalExpanded, setCulturalExpanded] = useState(false);
  const intel = getCulturalIntel(place.id, place.category);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 z-30 bg-ink-900/30" />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="absolute inset-x-0 bottom-0 z-40 bg-white rounded-t-3xl shadow-card overflow-y-auto max-h-[80%]"
      >
        <div className="w-12 h-1.5 bg-ink-200 rounded-full mx-auto mt-3" />

        <div className="relative h-40 mt-2">
          <img src={place.image} alt={place.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center press">
            <X className="w-4 h-4 text-white" />
          </button>
          {index >= 0 && (
            <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-brand-500 text-white text-sm font-bold flex items-center justify-center ring-2 ring-white">
              {index + 1}
            </div>
          )}
          <div className="absolute bottom-3 left-4 right-4">
            <div className="font-bold text-white text-lg font-display leading-tight">{place.name}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-white/80 text-xs">{place.category}</span>
              <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs text-white">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {place.rating}
              </span>
              {index >= 0 && (
                <span className="flex items-center gap-1 bg-brand-500/80 rounded-full px-2 py-0.5 text-xs text-white font-semibold">
                  <Clock className="w-3 h-3" /> {nineColon(index)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <InfoBlock icon={<Clock className="w-3.5 h-3.5 text-brand-500" />} label="Hours" value={place.openingHours} />
            <InfoBlock
              icon={<DollarSign className="w-3.5 h-3.5 text-emerald-500" />} label="Price"
              value={place.priceRange.min === place.priceRange.max ? formatCost(place.priceRange.min, currency) : `${formatCost(place.priceRange.min, currency)}+`}
            />
            <InfoBlock
              icon={<MapPin className="w-3.5 h-3.5 text-orange-500" />}
              label={prevPlace ? 'From prev' : 'Distance'}
              value={`${place.distanceKm} km`}
              sub={prevPlace ? `from ${prevPlace.name.split(' ')[0]}` : undefined}
            />
          </div>

          <p className="text-sm text-ink-600 mb-3 leading-relaxed">{place.description}</p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {place.tags.map((tag) => (
              <span key={tag} className="px-2.5 py-1 rounded-full bg-ink-50 text-ink-600 text-xs font-medium">{tag}</span>
            ))}
            <span className="px-2.5 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-medium">{place.durationMin} min visit</span>
          </div>

          {intel && (
            <div className="mb-3 rounded-xl border overflow-hidden" style={{ borderColor: intel.accentColor + '40' }}>
              <button
                onClick={() => setCulturalExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                style={{ background: intel.accentColor + '12' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{intel.tips[0].icon}</span>
                  <div>
                    <div className="text-xs font-bold" style={{ color: intel.accentColor }}>{intel.prompt}</div>
                    <div className="text-[10px] text-ink-500">{intel.tips.length} tip{intel.tips.length > 1 ? 's' : ''}</div>
                  </div>
                </div>
                <motion.div animate={{ rotate: culturalExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="w-4 h-4 text-ink-400" />
                </motion.div>
              </button>
              <AnimatePresence>
                {culturalExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 pt-2 space-y-2">
                      {intel.tips.map((tip, i) => (
                        <div key={i} className="flex gap-2.5">
                          <span className="text-base shrink-0 leading-none mt-0.5">{tip.icon}</span>
                          <div>
                            <div className="text-xs font-semibold text-ink-900">{tip.title}</div>
                            <div className="text-[11px] text-ink-500 leading-snug mt-0.5">{tip.body}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onSave}
              className={`h-11 rounded-2xl font-semibold press inline-flex items-center justify-center gap-2 transition-colors ${isSaved ? 'bg-brand-50 text-brand-600 border border-brand-200' : 'bg-ink-50 text-ink-800'}`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-brand-500 text-brand-500' : ''}`} />
              {isSaved ? 'Saved' : 'Save'}
            </button>
            <button onClick={onNavigate} className="h-11 rounded-2xl bg-brand-500 text-white font-semibold shadow-glow press inline-flex items-center justify-center gap-2">
              <Navigation className="w-4 h-4" /> Navigate
            </button>
          </div>
          <button className="mt-2.5 w-full h-10 rounded-2xl bg-brand-50 text-brand-700 font-semibold inline-flex items-center justify-center gap-2 press">
            <PaveyLogoMark size={16} color="#3B5BFF" /> Ask Buddy about this
          </button>
        </div>
      </motion.div>
    </>
  );
}

function InfoBlock({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-ink-50 rounded-xl p-2.5">
      <div className="flex items-center gap-1 mb-1">{icon}<span className="text-[10px] text-ink-500 font-medium">{label}</span></div>
      <div className="text-xs font-bold text-ink-900 leading-snug">{value}</div>
      {sub && <div className="text-[10px] text-ink-400 mt-0.5">{sub}</div>}
    </div>
  );
}
