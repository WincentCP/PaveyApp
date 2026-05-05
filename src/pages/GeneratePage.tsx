import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowDown, Check, GripVertical, Plus, RefreshCw, Wand2, X,
  Clock, Star, DollarSign, Pencil, Search, ChevronUp, ChevronDown, AlertTriangle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import { useApp } from '../context/AppContext';
import type { Place } from '../data/places';
import { PLACES } from '../data/places';
import { formatRp } from '../lib/format';
import { useToast } from '../components/Toast';
import { getCulturalIntel, type CulturalIntel } from '../data/cultural';
import TimePicker from '../components/TimePicker';

const STEPS = [
  'Finding nearby places…',
  'Matching spots to your vibe…',
  'Optimizing route…',
  'Crafting your perfect journey…',
];

export default function GeneratePage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const isManualMode = searchParams.get('mode') === 'manual';

  const { vibe, budget, buildItinerary, setItinerary, itinerary, removeStop, replaceStop, addStop, reorderStop, alternatives } = useApp();
  const { show } = useToast();

  const isEditMode = searchParams.get('edit') === '1';
  const [phase, setPhase] = useState<'loading' | 'reveal'>((isManualMode || isEditMode) ? 'reveal' : 'loading');
  const [stepIdx, setStepIdx] = useState(0);
  // Issue 8: AI generation error state
  const [generationError, setGenerationError] = useState(false);
  const [replaceFor, setReplaceFor] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  // UI5 — what-if comparison: { currentPlace, alt }
  const [whatIf, setWhatIf] = useState<{ current: Place; alt: Place } | null>(null);
  const [confirmingPulse, setConfirmingPulse] = useState(false);
  const [stopTimes, setStopTimes] = useState<Record<string, string>>({});
  const [editingTimeFor, setEditingTimeFor] = useState<string | null>(null);
  const [dismissedCultural, setDismissedCultural] = useState<Set<string>>(new Set());

  // Undo support for stop removal
  const [undoItem, setUndoItem] = useState<{ place: Place; index: number } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const removeWithUndo = (place: Place, idx: number, isManual: boolean) => {
    if (isManual) {
      setManualStops((prev) => prev.filter((s) => s.id !== place.id));
    } else {
      removeStop(place.id);
    }
    setUndoItem({ place, index: idx });
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoItem(null), 4000);
  };

  const handleUndo = () => {
    if (!undoItem) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const restored = undoItem;
    setUndoItem(null);
    if (isManualMode) {
      setManualStops((prev) => {
        const next = prev.slice();
        next.splice(Math.min(restored.index, next.length), 0, restored.place);
        return next;
      });
    } else {
      addStop(restored.place);
    }
    show(`${restored.place.name} restored`, 'success');
  };

  // Manual mode state
  const [manualStops, setManualStops] = useState<Place[]>(isManualMode ? [] : []);
  const [manualSearch, setManualSearch] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);

  useEffect(() => {
    if (!isManualMode && !isEditMode) setItinerary(buildItinerary());
  }, []); // eslint-disable-line

  useEffect(() => {
    if (phase !== 'loading') return;
    const t1 = setInterval(() => setStepIdx((s) => (s + 1) % STEPS.length), 700);
    const t2 = setTimeout(() => {
      setPhase('reveal');
      if (!isManualMode && !isEditMode && itinerary.length === 0) {
        setGenerationError(true);
      }
    }, 2200);
    return () => { clearInterval(t1); clearTimeout(t2); };
  }, [phase]); // eslint-disable-line

  const activeItinerary = isManualMode ? manualStops : itinerary;

  const totals = useMemo(() => ({
    cost: activeItinerary.reduce((s, p) => s + p.cost, 0),
    time: activeItinerary.reduce((s, p) => s + p.durationMin, 0),
    dist: activeItinerary.reduce((s, p) => s + p.distanceKm, 0),
  }), [activeItinerary]);

  const getTime = (id: string, idx: number) => {
    if (stopTimes[id]) return stopTimes[id];
    const start = 10 * 60 + 30 + idx * 90;
    const h = Math.floor(start / 60) % 24;
    const m = start % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // UI2 — conflict detection: returns true if scheduled end time exceeds closeHour
  const hasConflict = (place: Place, timeStr: string) => {
    const [hStr, mStr] = timeStr.split(':');
    const startMin = parseInt(hStr) * 60 + parseInt(mStr);
    const endMin = startMin + place.durationMin;
    const closeMin = place.closeHour * 60;
    return endMin > closeMin;
  };

  const onConfirm = () => {
    // Issue 9: Cancel pending undo on confirm
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoItem(null);
    if (isManualMode) setItinerary(manualStops);
    setConfirmingPulse(true);
    show('Journey confirmed ✨', 'success');
    setTimeout(() => nav('/transition', { replace: true }), 700);
  };

  const manualSearchResults = useMemo(() => {
    if (!manualSearch.trim()) return PLACES.slice(0, 6);
    const q = manualSearch.toLowerCase();
    return PLACES.filter((p) =>
      p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [manualSearch]);

  const importAi = () => {
    setManualStops((prev) => {
      const existing = new Set(prev.map((p) => p.id));
      return [...prev, ...itinerary.filter((p) => !existing.has(p.id))];
    });
    show('AI suggestions imported', 'success');
  };

  return (
    <div className="absolute inset-0 bg-white overflow-hidden flex flex-col">
      <StatusBar />
      <div className="px-5 py-2 flex items-center justify-between shrink-0">
        <button onClick={() => nav(-1)} className="w-10 h-10 -ml-2 flex items-center justify-center text-ink-700 press">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="font-bold text-ink-900 font-display">
          {isManualMode ? 'Build Your Journey' : isEditMode ? 'Edit Journey' : 'Your Journey'}
        </div>
        <div className="text-xs text-brand-600 font-semibold capitalize bg-brand-50 px-2 py-1 rounded-full">
          {isManualMode ? 'Manual' : `${vibe} · ${formatRp(budget)}`}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!isManualMode ? (
          /* ── AI GENERATED FLOW ── */
          <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-hidden">
            <AnimatePresence mode="wait">
              {phase === 'loading' ? (
                <LoadingState key="loading" stepIdx={stepIdx} />
              ) : (
                <motion.div
                  key="reveal"
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  {/* Summary card */}
                  <div className="mx-5 mt-2 p-4 rounded-2xl bg-brand-600 text-white shrink-0">
                    <div className="flex items-center gap-2 text-sm font-semibold opacity-90">
                      <Wand2 className="w-4 h-4" /> Crafted for your {vibe} day
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <SummStat label="Stops" value={String(itinerary.length)} />
                      <SummStat label="Distance" value={`${totals.dist.toFixed(1)} km`} />
                      <SummStat label="Est. Time" value={`${Math.round(totals.time / 60)}h ${totals.time % 60}m`} />
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between">
                      <span className="text-xs opacity-80">Total Budget</span>
                      <span className="font-bold">{formatRp(totals.cost)}</span>
                    </div>
                  </div>

                  {/* Stop list */}
                  <div className="flex-1 overflow-y-auto no-scrollbar mt-3 px-5 pb-28">
                    {/* Issue 8: Error state when generation yields empty itinerary */}
                    {generationError && itinerary.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4 py-12">
                        <div className="text-5xl">😕</div>
                        <div className="font-bold text-ink-900 text-lg font-display">Couldn't generate a plan</div>
                        <div className="text-sm text-ink-500">Check your vibe and budget settings and try again.</div>
                        <button
                          onClick={() => { setGenerationError(false); setPhase('loading'); setItinerary(buildItinerary()); }}
                          className="h-12 px-6 rounded-2xl bg-brand-500 text-white font-bold press shadow-glow flex items-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" /> Try Again
                        </button>
                      </div>
                    ) : (<>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold tracking-widest text-ink-500">ITINERARY · {itinerary.length} STOPS</span>
                      <button className="text-xs text-brand-600 font-semibold press" onClick={() => setShowAdd(true)}>+ Add stop</button>
                    </div>

                    {/* Gesture hint */}
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] text-ink-400">
                      <span>←</span>
                      <span>Swipe left to remove · Use arrows to reorder</span>
                    </div>

                    <div className="space-y-0">
                      <AnimatePresence>
                        {itinerary.map((p, i) => {
                          const intel = getCulturalIntel(p.id, p.category);
                          const timeStr = getTime(p.id, i);
                          const conflict = hasConflict(p, timeStr);
                          return (
                            <div key={p.id}>
                              <StopCard
                                index={i} total={itinerary.length} place={p}
                                scheduledTime={timeStr}
                                hasConflict={conflict}
                                onTimeEdit={() => setEditingTimeFor(p.id)}
                                onRemove={() => removeWithUndo(p, i, false)}
                                onReplace={() => setReplaceFor(p.id)}
                                onMoveUp={() => reorderStop(i, Math.max(0, i - 1))}
                                onMoveDown={() => reorderStop(i, Math.min(itinerary.length - 1, i + 1))}
                              />
                              {intel && !dismissedCultural.has(p.id) && (
                                <div className="mb-2">
                                  <CulturalCard
                                    intel={intel}
                                    onDismiss={() => setDismissedCultural((s) => new Set(s).add(p.id))}
                                  />
                                </div>
                              )}
                              {i < itinerary.length - 1 && (
                                <StopConnector
                                  distanceKm={itinerary[i + 1].distanceKm}
                                  fromTime={getTime(p.id, i)}
                                  durationMin={p.durationMin}
                                />
                              )}
                            </div>
                          );
                        })}
                      </AnimatePresence>
                    </div>

                    <button
                      onClick={() => { setItinerary(buildItinerary()); show('Re-rolled itinerary', 'info'); }}
                      className="mt-4 mx-auto flex items-center gap-2 text-xs font-semibold text-ink-600 px-4 py-2 rounded-full bg-ink-50 press"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Re-roll suggestions
                    </button>

                    {/* Recommendations */}
                    {alternatives(itinerary.map((p) => p.id)).length > 0 && (
                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold tracking-widest text-ink-500">RECOMMENDATIONS</span>
                          <span className="text-[10px] text-ink-400">Tap + to add to plan</span>
                        </div>
                        <div className="space-y-2">
                          {alternatives(itinerary.map((p) => p.id)).slice(0, 4).map((altP) => (
                            <motion.div
                              key={altP.id}
                              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                              className="bg-ink-50/60 border border-ink-100 rounded-2xl p-3 flex items-center gap-3"
                            >
                              <img src={altP.image} alt={altP.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-ink-900 text-sm truncate">{altP.name}</div>
                                <div className="flex items-center gap-1.5 text-xs text-ink-500 mt-0.5">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{altP.rating}
                                  <span className="text-ink-300">·</span>{altP.category}
                                </div>
                                <div className="text-xs text-brand-600 font-semibold mt-0.5">{formatRp(altP.cost)}</div>
                              </div>
                              {/* UI5 — "Try instead" opens what-if comparison if plan has stops */}
                              {itinerary.length > 0 ? (
                                <button
                                  onClick={() => setWhatIf({ current: itinerary[itinerary.length - 1], alt: altP })}
                                  className="text-[10px] font-semibold text-brand-600 bg-brand-50 border border-brand-200 px-2.5 py-1.5 rounded-lg press shrink-0"
                                >
                                  Try instead
                                </button>
                              ) : (
                                <button
                                  onClick={() => { addStop(altP); show(`${altP.name} added`, 'success'); }}
                                  className="w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center press shadow-soft shrink-0"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                    </>)}
                  </div>

                  {/* Sticky CTA — above bottom nav */}
                  <div className="absolute inset-x-0 bottom-0 px-5 pt-4 pb-24 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      animate={confirmingPulse ? { boxShadow: ['0 0 0 0 rgba(59,91,255,0.4)', '0 0 0 20px rgba(59,91,255,0)'] } : {}}
                      transition={{ duration: 0.7 }}
                      onClick={onConfirm}
                      disabled={itinerary.length === 0}
                      className="w-full h-14 rounded-2xl bg-brand-500 disabled:bg-ink-300 text-white font-bold text-base flex items-center justify-center gap-2 pointer-events-auto"
                    >
                      <Check className="w-5 h-5" /> Confirm My Journey
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* ── MANUAL FLOW ── */
          <motion.div key="manual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-hidden">
            {/* Summary bar */}
            {manualStops.length > 0 && (
              <div className="mx-5 mb-2 p-3 rounded-2xl bg-brand-600 text-white shrink-0 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold opacity-80">Your Plan</div>
                  <div className="text-sm font-bold">{manualStops.length} stops · {formatRp(totals.cost)}</div>
                </div>
                <button onClick={importAi} className="text-xs font-semibold press flex items-center gap-1 bg-white/20 rounded-full px-3 py-1.5">
                  <Wand2 className="w-3.5 h-3.5" /> Mix AI
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-28">

              {/* ── YOUR PLAN (TOP PRIORITY) ── */}
              {manualStops.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-2 mt-1">
                    <span className="text-[11px] font-bold tracking-widest text-ink-500">YOUR PLAN · {manualStops.length} STOPS</span>
                    <span className="text-[11px] text-ink-400">← swipe to remove</span>
                  </div>
                  <div className="space-y-0 mb-4">
                    <AnimatePresence>
                      {manualStops.map((p, i) => {
                        const intel = getCulturalIntel(p.id, p.category);
                        return (
                          <div key={p.id}>
                            <StopCard
                              index={i} total={manualStops.length} place={p}
                              scheduledTime={getTime(p.id, i)}
                              onTimeEdit={() => setEditingTimeFor(p.id)}
                              onRemove={() => removeWithUndo(p, i, true)}
                              onReplace={() => {}}
                              isManual
                              onMoveUp={() => setManualStops((prev) => { const n = prev.slice(); const [x] = n.splice(i, 1); n.splice(Math.max(0, i - 1), 0, x); return n; })}
                              onMoveDown={() => setManualStops((prev) => { const n = prev.slice(); const [x] = n.splice(i, 1); n.splice(Math.min(prev.length - 1, i + 1), 0, x); return n; })}
                            />
                            {intel && !dismissedCultural.has(p.id) && (
                              <div className="mb-2">
                                <CulturalCard
                                  intel={intel}
                                  onDismiss={() => setDismissedCultural((s) => new Set(s).add(p.id))}
                                />
                              </div>
                            )}
                            {i < manualStops.length - 1 && (
                              <StopConnector distanceKm={manualStops[i + 1].distanceKm} fromTime={getTime(p.id, i)} durationMin={p.durationMin} />
                            )}
                          </div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-ink-100" />
                    <span className="text-[11px] text-ink-400 font-semibold shrink-0">ADD MORE STOPS</span>
                    <div className="flex-1 h-px bg-ink-100" />
                  </div>
                </>
              )}

              {/* Issue 10: empty plan nudge */}
              {manualStops.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-6 text-ink-400">
                  <ArrowDown className="w-5 h-5 animate-bounce" />
                  <p className="text-sm font-medium">Search below to add your first stop</p>
                </div>
              )}

              {/* ── SEARCH & ADD ── */}
              <div className="bg-ink-50 rounded-2xl px-3 py-2.5 flex items-center gap-2 mb-3">
                <Search className="w-4 h-4 text-ink-400 shrink-0" />
                <input
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  placeholder="Search and add a place…"
                  className="flex-1 bg-transparent text-sm text-ink-800 placeholder:text-ink-400 outline-none"
                />
                {manualSearch && (
                  <button onClick={() => setManualSearch('')} className="press">
                    <X className="w-3.5 h-3.5 text-ink-400" />
                  </button>
                )}
              </div>

              <div className="space-y-2 mb-3">
                {manualSearchResults.filter((p) => !manualStops.some((s) => s.id === p.id)).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setManualStops((prev) => [...prev, p]); show(`${p.name} added`, 'success'); }}
                    className="w-full flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-2.5 text-left press hover:border-brand-200 transition-colors"
                  >
                    <img src={p.image} alt={p.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink-900 truncate text-sm">{p.name}</div>
                      <div className="flex items-center gap-1.5 text-xs text-ink-500 mt-0.5">
                        <span>{p.category}</span>
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{p.rating}</span>
                        <span>·</span>
                        <Clock className="w-3 h-3" />
                        <span>{p.openingHours}</span>
                      </div>
                      <div className="text-xs text-brand-600 font-semibold mt-0.5">
                        {formatRp(p.priceRange.min)}{p.priceRange.max !== p.priceRange.min ? ` – ${formatRp(p.priceRange.max)}` : ''}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
                      <Plus className="w-4 h-4 text-white" />
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowCustomForm((v) => !v)}
                className="w-full h-10 rounded-2xl border-2 border-dashed border-ink-200 text-ink-500 text-sm font-semibold flex items-center justify-center gap-2 press mb-4"
              >
                <Plus className="w-4 h-4" /> Add custom place
              </button>

              <AnimatePresence>
                {showCustomForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
                    <CustomPlaceForm onAdd={(p) => { setManualStops((prev) => [...prev, p]); setShowCustomForm(false); show(`${p.name} added`, 'success'); }} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── RECOMMENDATIONS (secondary) ── */}
              {alternatives(manualStops.map((p) => p.id)).length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold tracking-widest text-ink-500">RECOMMENDATIONS</span>
                    <span className="text-[10px] text-ink-400">Tap + to add</span>
                  </div>
                  <div className="space-y-2">
                    {alternatives(manualStops.map((p) => p.id)).slice(0, 4).map((p) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-ink-50/60 border border-ink-100 rounded-2xl p-3 flex items-center gap-3"
                      >
                        <img src={p.image} alt={p.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-ink-900 text-sm truncate">{p.name}</div>
                          <div className="flex items-center gap-1.5 text-xs text-ink-500 mt-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{p.rating}
                            <span className="text-ink-300">·</span>{p.category}
                          </div>
                          <div className="text-xs text-brand-600 font-semibold mt-0.5">{formatRp(p.cost)}</div>
                        </div>
                        <button
                          onClick={() => { setManualStops((prev) => [...prev, p]); show(`${p.name} added`, 'success'); }}
                          className="w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center press shadow-soft shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {manualStops.length === 0 && !manualSearch && (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">📝</div>
                  <div className="font-semibold text-ink-700">No stops yet</div>
                  <div className="text-sm text-ink-500 mt-1">Search above or pick from recommendations</div>
                  <button onClick={importAi} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 text-brand-600 text-sm font-semibold press">
                    <Wand2 className="w-4 h-4" /> Import AI suggestions
                  </button>
                </div>
              )}
            </div>

            <div className="absolute inset-x-0 bottom-0 px-5 pt-4 pb-24 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onConfirm}
                disabled={manualStops.length === 0}
                className="w-full h-14 rounded-2xl bg-brand-500 disabled:bg-ink-300 text-white font-bold text-base flex items-center justify-center gap-2 pointer-events-auto"
              >
                <Check className="w-5 h-5" /> Confirm My Journey ({manualStops.length} stops)
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time picker */}
      <AnimatePresence>
        {editingTimeFor && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingTimeFor(null)} className="absolute inset-0 z-40 bg-ink-900/40" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl pb-8"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3" />
              <div className="px-5 pt-3 pb-2 flex items-center justify-between">
                <div className="font-bold text-ink-900 font-display">Set arrival time</div>
                <button
                  onClick={() => setEditingTimeFor(null)}
                  className="h-8 px-4 rounded-full bg-brand-500 text-white text-xs font-bold press"
                >
                  Done
                </button>
              </div>
              <div className="px-5 py-4 flex justify-center">
                <TimePicker
                  value={stopTimes[editingTimeFor] ?? getTime(editingTimeFor, activeItinerary.findIndex((p) => p.id === editingTimeFor))}
                  onChange={(t) => setStopTimes((prev) => ({ ...prev, [editingTimeFor]: t }))}
                />
              </div>
              {/* Issue 11: time picker context */}
              <p className="text-center text-xs text-ink-400 -mt-2 mb-2 px-4">
                All stop times are estimated from this departure time.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Replace sheet */}
      <AlternativesSheet open={!!replaceFor} onClose={() => setReplaceFor(null)}
        excludeIds={itinerary.map((p) => p.id)} title="Replace stop"
        onPick={(p) => { if (replaceFor) replaceStop(replaceFor, p); setReplaceFor(null); show('Stop replaced', 'success'); }}
        alternatives={alternatives}
      />

      {/* Undo snackbar */}
      <AnimatePresence>
        {undoItem && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute inset-x-4 bottom-28 z-50 flex items-center gap-3 bg-ink-900 text-white rounded-2xl px-4 py-3 shadow-xl"
          >
            <div className="flex-1 text-sm font-medium truncate">
              {undoItem.place.name} removed
            </div>
            <button
              onClick={handleUndo}
              className="text-brand-300 font-bold text-sm press shrink-0"
            >
              Undo
            </button>
            <button onClick={() => setUndoItem(null)} className="text-white/50 press">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add sheet */}
      <AlternativesSheet open={showAdd} onClose={() => setShowAdd(false)}
        excludeIds={itinerary.map((p) => p.id)} title="Add a stop"
        onPick={(p) => { addStop(p); setShowAdd(false); show(`${p.name} added`, 'success'); }}
        alternatives={alternatives}
      />

      {/* UI5 — What-if comparison modal */}
      <AnimatePresence>
        {whatIf && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setWhatIf(null)} className="absolute inset-0 z-40 bg-ink-900/50" />
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-card overflow-hidden"
            >
              <div className="p-4 border-b border-ink-100">
                <div className="font-bold text-ink-900 font-display text-center">Try instead?</div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-ink-100">
                {[
                  { label: 'CURRENT', place: whatIf.current, isPrimary: false },
                  { label: 'ALTERNATIVE', place: whatIf.alt, isPrimary: true },
                ].map(({ label, place, isPrimary }) => (
                  <div key={place.id} className={`p-3 ${isPrimary ? 'bg-brand-50/30' : ''}`}>
                    <div className={`text-[9px] font-bold tracking-widest mb-2 ${isPrimary ? 'text-brand-600' : 'text-ink-400'}`}>{label}</div>
                    <img src={place.image} alt={place.name} className="w-full h-20 object-cover rounded-xl mb-2" />
                    <div className="font-semibold text-ink-900 text-xs leading-snug mb-1">{place.name}</div>
                    <div className="flex items-center gap-1 text-[10px] text-ink-500 mb-0.5">
                      <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                      <span className="font-semibold text-ink-700">{place.rating}</span>
                      <span>· {formatRp(place.cost)}</span>
                    </div>
                    <div className="text-[10px] text-ink-400">{place.durationMin}min · {place.distanceKm}km</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 border-t border-ink-100">
                <button
                  onClick={() => setWhatIf(null)}
                  className="h-10 rounded-xl bg-ink-50 text-ink-700 text-sm font-semibold press"
                >Keep Current</button>
                <button
                  onClick={() => {
                    replaceStop(whatIf.current.id, whatIf.alt);
                    setWhatIf(null);
                    show(`Switched to ${whatIf.alt.name}`, 'success');
                  }}
                  className="h-10 rounded-xl bg-brand-500 text-white text-sm font-semibold press shadow-glow"
                >Switch</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────── */

function SummStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/15 rounded-xl py-2 px-2 text-center">
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-base font-bold leading-tight">{value}</div>
    </div>
  );
}

function LoadingState({ stepIdx }: { stepIdx: number }) {
  return (
    <motion.div key="loading" initial={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} className="flex-1 px-5 pt-4 flex flex-col">
      <div className="flex items-center gap-2 text-brand-600 font-semibold">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}>
          <RefreshCw className="w-5 h-5" />
        </motion.div>
        <AnimatePresence mode="wait">
          <motion.span key={stepIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="text-[15px]">
            {STEPS[stepIdx]}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="mt-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-ink-100 p-3 flex gap-3 items-center">
            <div className="w-16 h-16 rounded-xl shimmer" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded shimmer" /><div className="h-3 w-1/3 rounded shimmer" /><div className="h-3 w-1/4 rounded shimmer" />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Visual connector between stops ── */
function StopConnector({ distanceKm, fromTime, durationMin }: { distanceKm: number; fromTime: string; durationMin: number }) {
  const driveMin = Math.round(distanceKm * 3);
  const [h, m] = fromTime.split(':').map(Number);
  const arriveMin = h * 60 + m + durationMin + driveMin;
  const nextH = Math.floor(arriveMin / 60) % 24;
  const nextM = arriveMin % 60;
  const nextTime = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-3 ml-5 my-1">
      <div className="flex flex-col items-center w-4 shrink-0">
        <div className="w-px bg-ink-200" style={{ height: 28 }} />
      </div>
      <div className="flex items-center gap-2 text-[11px] text-ink-400 py-0.5">
        <span className="font-medium">{distanceKm} km</span>
        <span>·</span>
        <span>~{driveMin} min drive</span>
        <span>·</span>
        <Clock className="w-3 h-3" />
        <span>Arrive {nextTime}</span>
      </div>
    </div>
  );
}

/* ── Cultural Intelligence Card ── */
function CulturalCard({ intel, onDismiss }: { intel: CulturalIntel; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const visibleTips = expanded ? intel.tips : intel.tips.slice(0, 1);
  const extraCount = intel.tips.length - 1;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      className="mx-0 mb-0 overflow-hidden"
    >
      <div className="rounded-2xl border border-ink-100 bg-ink-50/70 overflow-hidden">
        <div className="flex items-start gap-2.5 p-3">
          <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: intel.accentColor }} />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-ink-500 mb-1.5">{intel.prompt}</div>
            <div className="space-y-2">
              {visibleTips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5 shrink-0">{tip.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-ink-800">{tip.title}</div>
                    <div className="text-xs text-ink-500 mt-0.5 leading-relaxed">{tip.body}</div>
                  </div>
                </div>
              ))}
            </div>
            {!expanded && extraCount > 0 && (
              <button onClick={() => setExpanded(true)} className="mt-1.5 text-[11px] font-semibold text-brand-600 press">
                + {extraCount} more tip{extraCount > 1 ? 's' : ''}
              </button>
            )}
            {expanded && (
              <button onClick={() => setExpanded(false)} className="mt-1.5 text-[11px] font-semibold text-ink-400 press">
                Show less
              </button>
            )}
          </div>
          <button onClick={onDismiss} className="shrink-0 w-6 h-6 rounded-full hover:bg-ink-200 flex items-center justify-center press">
            <X className="w-3 h-3 text-ink-400" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Stop Card ── */
function StopCard({
  index, total, place, scheduledTime, hasConflict, onTimeEdit, onRemove, onReplace, onMoveUp, onMoveDown, isManual,
}: {
  index: number; total: number; place: Place;
  scheduledTime: string; hasConflict?: boolean; onTimeEdit: () => void;
  onRemove: () => void; onReplace: () => void; onMoveUp: () => void; onMoveDown: () => void;
  isManual?: boolean;
}) {
  const [dragX, setDragX] = useState(0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -80, height: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="relative mb-2"
    >
      {/* Swipe-to-delete reveal */}
      <div className="absolute inset-0 bg-red-500 rounded-2xl flex items-center justify-end pr-5">
        <div className="text-white text-center">
          <X className="w-5 h-5 mx-auto" />
          <div className="text-[10px] font-semibold mt-0.5">Remove</div>
        </div>
      </div>

      <motion.div
        drag="x" dragConstraints={{ left: -90, right: 0 }} dragElastic={0.15}
        onDrag={(_, info) => setDragX(info.offset.x)}
        onDragEnd={(_, info) => { if (info.offset.x < -55) onRemove(); setDragX(0); }}
        className="relative bg-white rounded-2xl border border-ink-100 p-3 flex items-start gap-2.5 cursor-grab active:cursor-grabbing"
        style={{ x: dragX }}
      >
        {/* Reorder arrows */}
        <div className="flex flex-col items-center gap-0.5 pt-0.5 shrink-0">
          <button onClick={onMoveUp} disabled={index === 0} className="p-0.5 text-ink-300 disabled:opacity-20 press hover:text-ink-600">
            <ChevronUp className="w-4 h-4" />
          </button>
          <div className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">{index + 1}</div>
          <button onClick={onMoveDown} disabled={index === total - 1} className="p-0.5 text-ink-300 disabled:opacity-20 press hover:text-ink-600">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <div className="relative shrink-0">
          <img src={place.image} alt={place.name} className="w-16 h-16 rounded-xl object-cover" />
          {isManual && (
            <div className="absolute -bottom-1.5 -right-1.5 bg-ink-700 text-white text-[9px] font-bold px-1 py-0.5 rounded-full">✎</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-ink-900 text-sm truncate leading-tight">{place.name}</div>
          <div className="flex items-center gap-1.5 text-xs text-ink-500 mt-0.5">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" /><span>{place.rating}</span>
            <span className="text-ink-300">·</span><span>{place.category}</span>
          </div>
          <button onClick={onTimeEdit} className="mt-1.5 flex items-center gap-1 bg-brand-50 rounded-full px-2 py-1 press">
            <Clock className="w-3 h-3 text-brand-500" />
            <span className="text-xs font-semibold text-brand-600">{scheduledTime}</span>
            <Pencil className="w-2.5 h-2.5 text-brand-400" />
          </button>
          <div className="flex items-center gap-1.5 text-[11px] mt-1.5 flex-wrap">
            <Clock className="w-3 h-3 text-ink-400" />
            <span className="text-ink-400">{place.openingHours}</span>
            <span className="text-ink-300">·</span>
            <DollarSign className="w-3 h-3 text-ink-400" />
            <span className="text-brand-600 font-semibold">
              {formatRp(place.priceRange.min)}{place.priceRange.max !== place.priceRange.min ? '+' : ''}
            </span>
            {hasConflict && (
              <span className="flex items-center gap-0.5 text-amber-600 font-semibold ml-1">
                <AlertTriangle className="w-3 h-3" /> Closes before visit ends
              </span>
            )}
          </div>
        </div>

        {!isManual && (
          <button onClick={onReplace} className="shrink-0 px-2 h-7 rounded-lg bg-ink-50 text-ink-600 text-[11px] font-semibold press">
            Swap
          </button>
        )}
        <GripVertical className="w-4 h-4 text-ink-200 shrink-0 self-center" />
      </motion.div>
    </motion.div>
  );
}

/* ── Custom Place Form ── */
const CUSTOM_CATEGORIES = ['Restaurant', 'Café', 'Temple', 'Market', 'Beach', 'Museum', 'Park', 'Shop', 'Hotel', 'Hidden Gem', 'Other'];

function CustomPlaceForm({ onAdd }: { onAdd: (p: Place) => void }) {
  const [name, setName] = useState('');
  const [cost, setCost] = useState('50000');
  const [dur, setDur] = useState('60');
  const [category, setCategory] = useState('Restaurant');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="bg-ink-50 rounded-2xl p-3 space-y-2">
      <input ref={ref} value={name} onChange={(e) => setName(e.target.value)} placeholder="Place name" className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-300 border border-ink-100" />
      {/* Issue 12: category selector */}
      <div className="bg-white rounded-xl px-3 py-2 border border-ink-100">
        <div className="text-[10px] text-ink-400 mb-0.5">Category</div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-transparent text-sm font-bold text-ink-900 outline-none">
          {CUSTOM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-xl px-3 py-2 border border-ink-100">
          <div className="text-[10px] text-ink-400">Cost (Rp)</div>
          <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full bg-transparent text-sm font-bold text-ink-900 outline-none" />
        </div>
        <div className="bg-white rounded-xl px-3 py-2 border border-ink-100">
          <div className="text-[10px] text-ink-400">Duration (min)</div>
          <input type="number" value={dur} onChange={(e) => setDur(e.target.value)} className="w-full bg-transparent text-sm font-bold text-ink-900 outline-none" />
        </div>
      </div>
      <button disabled={!name.trim()} onClick={() => {
        onAdd({ id: `custom-${Date.now()}`, name: name.trim(), category: category as import('../data/places').Category, tags: ['Custom'], vibes: ['chill','chaos','zen','luxury'], image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80', cost: Number(cost) || 0, priceRange: { min: Number(cost) || 0, max: Number(cost) || 0 }, durationMin: Number(dur) || 60, distanceKm: 1.0, lat: -8.5055, lng: 115.2620, rating: 0, description: 'Custom stop.', openingHours: 'All day', indoor: true, openHour: 0, closeHour: 24 });
      }} className="w-full h-10 rounded-xl bg-brand-500 disabled:bg-ink-300 text-white font-semibold press flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" /> Add Custom Stop
      </button>
    </div>
  );
}

/* ── Alternatives Sheet ── */
function AlternativesSheet({ open, onClose, excludeIds, onPick, title, alternatives }: {
  open: boolean; onClose: () => void; excludeIds: string[]; title: string;
  onPick: (p: Place) => void; alternatives: (ids: string[]) => Place[];
}) {
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    if (!query.trim()) return alternatives(excludeIds);
    const q = query.toLowerCase();
    return PLACES.filter((p) => !excludeIds.includes(p.id) && (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))).slice(0, 12);
  }, [query, excludeIds, alternatives]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 z-40 bg-ink-900/40" />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute inset-x-0 bottom-0 z-50 max-h-[80%] bg-white rounded-t-3xl shadow-card flex flex-col"
          >
            <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3" />
            <div className="px-5 pt-3 pb-2 flex items-center justify-between shrink-0">
              <div className="font-bold text-ink-900 font-display">{title}</div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 pb-2 shrink-0">
              <div className="bg-ink-50 rounded-2xl px-3 py-2.5 flex items-center gap-2">
                <Search className="w-4 h-4 text-ink-400 shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search places by name or category…"
                  className="flex-1 bg-transparent text-sm text-ink-800 placeholder:text-ink-400 outline-none"
                  autoFocus
                />
                {query && <button onClick={() => setQuery('')} className="p-0.5 press"><X className="w-3.5 h-3.5 text-ink-400" /></button>}
              </div>
            </div>
            <div className="overflow-y-auto px-5 pb-6 space-y-2 no-scrollbar">
              {list.length === 0 && <div className="text-sm text-ink-500 py-10 text-center">No places found.</div>}
              {list.map((p) => (
                <button key={p.id} onClick={() => onPick(p)} className="w-full bg-white border border-ink-100 hover:border-brand-300 rounded-2xl p-3 flex items-center gap-3 text-left press">
                  <img src={p.image} alt={p.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink-900 truncate">{p.name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-ink-500 mt-0.5">
                      <span>{p.category}</span>
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" /><span>{p.rating}</span>
                    </div>
                    <div className="text-[11px] text-ink-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />{p.openingHours}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-brand-600">{formatRp(p.cost)}</div>
                    <div className="text-[11px] text-ink-500">{p.distanceKm} km</div>
                  </div>
                  <Plus className="w-4 h-4 text-ink-400 shrink-0" />
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
