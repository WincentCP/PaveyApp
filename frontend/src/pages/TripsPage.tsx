import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, MapPin, Clock, Star, Navigation, Pencil, ChevronRight, Trash2, Settings2, X, CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import PageHeader from '../components/PageHeader';
import PlaceCard from '../components/PlaceCard';
import { useApp } from '../context/AppContext';
import type { TripPace } from '../context/AppContext';
import { formatCost } from '../lib/format';
import { useToast } from '../components/Toast';
import type { Place } from '../data/places';
import { useMemo, useState } from 'react';

function formatDateRange(startISO: string, days: number): string {
  const start = new Date(startISO);
  const end = new Date(start.getTime() + (days - 1) * 86400000);
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function dayTabDate(startISO: string, dayIndex: number): string {
  const d = new Date(new Date(startISO).getTime() + dayIndex * 86400000);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const VIBES: { id: string; label: string }[] = [
  { id: 'nature', label: 'Nature' },
  { id: 'cafe', label: 'Café Hopping' },
  { id: 'activities', label: 'Activities' },
  { id: 'cultural', label: 'Cultural' },
  { id: 'balanced', label: 'Balanced' },
];

export default function TripsPage() {
  const nav = useNavigate();
  const {
    destinations, activeDestIdx, setActiveDestIdx,
    itinerary, setItinerary, vibe, activeTrip, isNavigating, navIndex,
    journeyStart, perDayItineraries, setPerDayItineraries,
    pace, setPace,
    savePlace, removeSavedPlace, isSaved, setBuddyOpen,
    trips, setActiveTripId, activeTripId,
  } = useApp();
  const { show } = useToast();

  const [activeDay, setActiveDay] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const activeDest = destinations[activeDestIdx];
  const hasMultiDest = destinations.length > 1;
  const hasPlan = perDayItineraries.flat().length > 0 || itinerary.length > 0;

  const vibeInfo = VIBES.find((v) => v.id === vibe) ?? VIBES[4];

  const allStops = perDayItineraries.length > 0 ? perDayItineraries.flat() : itinerary;
  const totalCost = useMemo(() => allStops.reduce((s, p) => s + p.cost, 0), [allStops]);
  const totalTime = useMemo(() => allStops.reduce((s, p) => s + p.durationMin, 0), [allStops]);

  const stopsForDay = useMemo(() => {
    if (perDayItineraries.length > 0) return perDayItineraries[activeDay] ?? [];
    if (!hasPlan) return [];
    const perDay = Math.ceil(itinerary.length / Math.max(1, journeyStart.days));
    const start = activeDay * perDay;
    return itinerary.slice(start, start + perDay);
  }, [perDayItineraries, itinerary, activeDay, journeyStart.days, hasPlan]);

  const dayCount = perDayItineraries.length > 0 ? perDayItineraries.length : Math.max(1, journeyStart.days);

  function nineColon(i: number) {
    const base = 9 * 60 + 30 + i * 150;
    const h = Math.floor(base / 60) % 24;
    const m = base % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      {/* Scrollable page body */}
      <div className="absolute inset-0 overflow-y-auto pb-32 no-scrollbar">
        <StatusBar />
      <PageHeader
        icon={CalendarDays}
        title="My Plan"
        sub={activeDest ? activeDest.name.split(',')[0] : 'Your trip'}
        right={
          hasPlan ? (
            <button
              onClick={() => nav('/map')}
              className="press flex items-center gap-1.5 px-3 h-9 rounded-full bg-ink-50 text-ink-800 text-xs font-semibold"
            >
              <MapPin className="w-4 h-4" /> Map
            </button>
          ) : undefined
        }
      />

      {/* Destination tabs — show full names */}
      {hasMultiDest && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {destinations.map((d, i) => (
              <motion.button
                key={d.id}
                whileTap={{ scale: 0.94 }}
                onClick={() => { setActiveDestIdx(i); setActiveDay(0); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold press transition-colors whitespace-nowrap ${
                  i === activeDestIdx
                    ? 'bg-brand-500 text-white shadow-glow'
                    : 'bg-ink-50 text-ink-700 border border-ink-100'
                }`}
              >
                {d.name}
                <span className={`ml-1.5 text-[10px] ${i === activeDestIdx ? 'text-white/70' : 'text-ink-400'}`}>{d.days}d</span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 space-y-4">

        {/* Trip summary card — redesigned */}
        {hasPlan && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl p-4 text-white"
          >
            {/* Top row: trip name + status chip + manage button */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {activeTripId !== 'default-trip' && (
                    <span className="bg-white/25 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">Active</span>
                  )}
                </div>
                <div className="font-bold text-white text-lg font-display leading-tight truncate">
                  {activeTrip.name !== 'My Trip' ? activeTrip.name : (activeDest ? activeDest.name.split(',')[0] : 'My Trip')}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3 h-3 text-white/70 shrink-0" />
                  <span className="text-xs text-white/80 truncate">{activeDest ? activeDest.name : 'Your destination'}</span>
                </div>
                {dayCount > 1 && journeyStart.date && journeyStart.date !== 'today' && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <CalendarDays className="w-3 h-3 text-white/70 shrink-0" />
                    <span className="text-xs text-white/80">{formatDateRange(journeyStart.date, dayCount)}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => { setConfirmDelete(false); setSettingsOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold press shrink-0 transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" /> Manage
              </button>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2 mt-1">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-white/70" />
                <span className="text-xs font-semibold text-white">{allStops.length} stops</span>
              </div>
              <div className="w-px h-3 bg-white/20" />
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-white/70" />
                <span className="text-xs font-semibold text-white">{Math.floor(totalTime / 60)}h {totalTime % 60}m</span>
              </div>
              {dayCount > 1 && (
                <>
                  <div className="w-px h-3 bg-white/20" />
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-3 h-3 text-white/70" />
                    <span className="text-xs font-semibold text-white">{dayCount} days</span>
                  </div>
                </>
              )}
              <div className="flex-1" />
              <span className="text-xs font-bold text-white">{formatCost(totalCost, activeTrip.currency)}</span>
            </div>

            {isNavigating && (
              <button
                onClick={() => nav('/navigate')}
                className="mt-2.5 w-full flex items-center gap-2 bg-white/15 rounded-xl px-4 py-2.5 press"
              >
                <motion.span
                  animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0.3, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                  className="block w-2 h-2 rounded-full bg-white shrink-0"
                />
                <span className="text-white font-semibold text-sm flex-1 text-left">
                  Navigating to {itinerary[navIndex]?.name ?? 'stop'}
                </span>
                <ChevronRight className="w-4 h-4 text-white/70" />
              </button>
            )}

            {!isNavigating && (
              <button
                onClick={() => nav('/map')}
                className="mt-2.5 w-full h-10 bg-white/15 hover:bg-white/25 text-white font-semibold text-sm rounded-xl press flex items-center justify-center gap-2 transition-colors"
              >
                <Navigation className="w-4 h-4" /> Start Navigation
              </button>
            )}
          </motion.div>
        )}

        {/* Empty state */}
        {!hasPlan && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 px-4"
          >
            <div className="text-5xl mb-3">🗺️</div>
            <div className="font-bold text-ink-900 font-display text-lg">No plan yet</div>
            <div className="text-sm text-ink-500 mt-1 mb-6">
              {activeDest ? `Build your ${activeDest.name.split(',')[0]} itinerary` : 'Start planning your trip'}
            </div>
            <button
              onClick={() => nav('/?newPlan=1')}
              className="h-12 px-8 rounded-2xl bg-brand-500 text-white font-bold shadow-glow press flex items-center justify-center gap-2 mx-auto"
            >
              <img src="/mascot.svg" alt="TinTin" className="w-6 h-6 object-contain" /> Plan My Trip
            </button>
          </motion.div>
        )}

        {/* Day tabs */}
        {hasPlan && dayCount > 1 && (
          <div>
            <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-2">DAY</div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {Array.from({ length: dayCount }).map((_, i) => {
                const dateStr = journeyStart.date && journeyStart.date !== 'today'
                  ? ` · ${dayTabDate(journeyStart.date, i)}`
                  : '';
                const label = `Day ${i + 1}${dateStr}`;
                return (
                  <button
                    key={i}
                    onClick={() => setActiveDay(i)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold press transition-colors ${
                      activeDay === i
                        ? 'bg-brand-500 text-white'
                        : 'bg-ink-50 text-ink-700 border border-ink-100'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Stop list */}
        {hasPlan && (
          <div>
            <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-3">
              {dayCount > 1 ? `DAY ${activeDay + 1} STOPS` : 'STOPS'}
            </div>
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-ink-100" />
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {(dayCount > 1 ? stopsForDay : itinerary).map((p, i) => (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 * i }}
                      className="relative pl-8"
                    >
                      <span className="absolute left-0.5 top-4 w-5 h-5 rounded-full bg-brand-500 ring-4 ring-brand-50 flex items-center justify-center z-10">
                        <span className="text-[8px] text-white font-bold">{i + 1}</span>
                      </span>
                      <button
                        onClick={() => setSelectedPlace(p)}
                        className="w-full flex items-center gap-3 bg-white border border-ink-100 rounded-2xl p-3 press hover:border-brand-200 transition-colors text-left"
                      >
                        <img src={p.image} alt={p.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-ink-900 text-sm truncate">{p.name}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-ink-500 mt-0.5">
                            <Clock className="w-3 h-3 text-brand-500" />
                            <span className="text-brand-600 font-semibold">{nineColon(i)}</span>
                            <span className="text-ink-300">·</span>
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{p.rating}</span>
                          </div>
                          <div className="text-[10px] text-ink-400 mt-0.5">{p.category} · {p.durationMin} min</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-brand-600">{formatCost(p.cost, activeTrip.currency)}</div>
                        </div>
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Trip Settings Sheet */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setSettingsOpen(false); setConfirmDelete(false); }} className="absolute inset-0 z-40 bg-ink-900/40" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-8 flex flex-col max-h-[90%] overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3" />
              <div className="px-5 pt-3 pb-2 flex items-center justify-between">
                <div className="font-bold text-ink-900 font-display">Manage trip</div>
                <button onClick={() => { setSettingsOpen(false); setConfirmDelete(false); }} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 pt-2 space-y-2 flex-1 overflow-y-auto no-scrollbar">
                {/* Set as Current Trip */}
                {activeTripId === 'default-trip' && trips.filter((t) => t.id !== 'default-trip').length > 0 && (
                  <button
                    onClick={() => {
                      const realTrip = trips.find((t) => t.id !== 'default-trip');
                      if (realTrip) {
                        setActiveTripId(realTrip.id);
                        show(`"${realTrip.name}" is now your current trip`, 'success');
                        setSettingsOpen(false);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-brand-50 hover:bg-brand-100 transition-colors press text-left"
                  >
                    <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-brand-700">Set as Current Trip</div>
                      <div className="text-[11px] text-brand-500">Make this your active trip for tracking</div>
                    </div>
                  </button>
                )}

                {/* Edit plan */}
                <button
                  onClick={() => { setSettingsOpen(false); nav('/generate?edit=1'); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-ink-50 hover:bg-ink-100 transition-colors press text-left"
                >
                  <Pencil className="w-4 h-4 text-brand-600 shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-ink-900">Edit plan</div>
                    <div className="text-[11px] text-ink-500">Re-arrange, add or remove stops</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-400" />
                </button>

                {/* Change pace */}
                <div className="px-3 py-3 rounded-xl bg-ink-50">
                  <div className="text-sm font-semibold text-ink-900 mb-2">Trip pace</div>
                  <div className="flex gap-2">
                    {([
                      { id: 'relaxed', label: 'Relaxed' },
                      { id: 'balanced', label: 'Balanced' },
                      { id: 'fast', label: 'Fast' },
                    ] as { id: TripPace; label: string }[]).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setPace(p.id); show(`Pace set to ${p.label}`, 'success'); }}
                        className={`flex-1 flex flex-col items-center gap-0.5 py-3 rounded-lg text-xs font-semibold press transition-colors ${pace === p.id ? 'bg-brand-50 border-2 border-brand-400 text-brand-700' : 'bg-white border border-ink-200 text-ink-600'}`}
                      >
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] text-ink-500 mt-2">Regenerate the plan to apply.</div>
                </div>

                {/* Delete plan */}
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-50 transition-colors press text-left"
                  >
                    <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-red-600">Delete plan</div>
                      <div className="text-[11px] text-ink-500">Permanently clear the current itinerary</div>
                    </div>
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <div className="text-xs font-semibold text-red-800 mb-2">Delete this plan? This can't be undone.</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 h-8 rounded-lg bg-white border border-red-200 text-red-600 text-xs font-semibold press"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => { setItinerary([]); setPerDayItineraries([]); setConfirmDelete(false); setSettingsOpen(false); show('Plan deleted', 'info'); }}
                        className="flex-1 h-8 rounded-lg bg-red-500 text-white text-xs font-bold press"
                      >
                        Delete plan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Place detail card overlay */}
      <AnimatePresence>
        {selectedPlace && (
          <PlaceCard
            place={selectedPlace}
            index={(dayCount > 1 ? stopsForDay : itinerary).findIndex((p) => p.id === selectedPlace.id)}
            onClose={() => setSelectedPlace(null)}
            onNavigate={() => { setSelectedPlace(null); nav('/map'); }}
            isSaved={isSaved(selectedPlace.id)}
            onSave={() => isSaved(selectedPlace.id) ? removeSavedPlace(selectedPlace.id) : savePlace(selectedPlace)}
            currency={activeTrip.currency}
            onBuddy={() => { setSelectedPlace(null); setBuddyOpen(true); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
