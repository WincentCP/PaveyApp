import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, Crosshair, Navigation,
  Clock, Star,
  ChevronUp, Map, Pencil, Wallet,
  Trees, Coffee, Landmark, Scale, Compass
} from 'lucide-react';
import PlaceCard from '../components/PlaceCard';
import { useEffect, useMemo, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import PageHeader from '../components/PageHeader';
import { useApp } from '../context/AppContext';
import { formatCost } from '../lib/format';
import type { Currency } from '../data/wallet';
import { useToast } from '../components/Toast';
import type { Place, Vibe } from '../data/places';



const MAP_VIBES: { id: Vibe; label: string; tint: string }[] = [
  { id: 'nature', label: 'Nature', tint: '#10B981' },
  { id: 'cafe', label: 'Café', tint: '#F97316' },
  { id: 'activities', label: 'Activities', tint: '#3B5BFF' },
  { id: 'cultural', label: 'Cultural', tint: '#A855F7' },
  { id: 'balanced', label: 'Balanced', tint: '#6B7280' },
];

function getVibeIcon(id: Vibe, className = "w-6 h-6") {
  switch (id) {
    case 'nature':
      return <Trees className={className} />;
    case 'cafe':
      return <Coffee className={className} />;
    case 'activities':
      return <Compass className={className} />;
    case 'cultural':
      return <Landmark className={className} />;
    case 'balanced':
    default:
      return <Scale className={className} />;
  }
}

export default function MapPage() {
  const nav = useNavigate();
  const {
    itinerary, setIsNavigating, setNavIndex, isNavigating,
    savePlace, removeSavedPlace, isSaved,
    destinations, activeDestIdx, setActiveDestIdx, activeTrip,
    vibe, setVibe, budget, setBudget, setBuddyOpen,
    perDayItineraries, journeyStart,
  } = useApp();
  const { show } = useToast();

  const [activeMapDay, setActiveMapDay] = useState(0);
  const [selected, setSelected] = useState<Place | null>(null);
  const [walletPromptVisible, setWalletPromptVisible] = useState(false);

  // Show wallet popup if navigated from Start My Trip flow
  useEffect(() => {
    try {
      const flag = sessionStorage.getItem('pavey_show_wallet_prompt');
      if (flag === '1') {
        sessionStorage.removeItem('pavey_show_wallet_prompt');
        setTimeout(() => setWalletPromptVisible(true), 600);
      }
    } catch { /* ignore */ }
  }, []);







  // Per-day slice for map view
  const dayCount = perDayItineraries.length > 0
    ? perDayItineraries.length
    : (journeyStart.days > 1 ? journeyStart.days : 0);
  const activeItinerary = perDayItineraries.length > 0
    ? (perDayItineraries[activeMapDay] ?? [])
    : itinerary;

  useEffect(() => { setActiveMapDay(0); }, [activeDestIdx]);

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
        sub={dayCount > 1
          ? `${destinations[activeDestIdx]?.name.split(',')[0] ?? 'My Trip'} · Day ${activeMapDay + 1} · ${activeItinerary.length} stops`
          : destinations.length > 0
            ? `${destinations[activeDestIdx]?.name.split(',')[0] ?? 'My Trip'} · ${activeItinerary.length} stops`
            : `${activeItinerary.length} stop${activeItinerary.length !== 1 ? 's' : ''}`}
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

      {/* Day tabs — visible when multi-day plan exists */}
      {dayCount > 1 && activeItinerary.length > 0 && (
        <div className="px-5 pb-2 shrink-0">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {Array.from({ length: dayCount }).map((_, i) => {
              const dateStr = journeyStart.date && journeyStart.date !== 'today'
                ? ` · ${new Date(new Date(journeyStart.date).getTime() + i * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                : '';
              return (
                <button
                  key={i}
                  onClick={() => setActiveMapDay(i)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold press whitespace-nowrap transition-colors ${
                    activeMapDay === i ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-700 border border-ink-100'
                  }`}
                >
                  {`Day ${i + 1}${dateStr}`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeItinerary.length === 0 ? (
        <div className="flex-1 overflow-y-auto px-5 pb-40 no-scrollbar">
          <EmptyDestState
            destName={destinations[activeDestIdx]?.name.split(',')[0] ?? 'this destination'}
            onAiGenerate={() => nav('/generate')}
            onManual={() => nav('/generate?mode=manual')}
            inline
          />
        </div>
      ) : (
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
          </div>

          <ItineraryBottomSheet
            itinerary={activeItinerary}
            totals={totals}
            onStart={startNavigation}
            onEdit={() => nav('/generate?edit=1')}
            currency={activeTrip.currency}
            onSelectPlace={setSelected}
          />
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
            onBuddy={() => { setSelected(null); setBuddyOpen(true); }}
          />
        )}
      </AnimatePresence>

      {/* Wallet prompt — shown after Start My Trip via sessionStorage flag */}
      <AnimatePresence>
        {walletPromptVisible && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setWalletPromptVisible(false)}
              className="absolute inset-0 z-50 bg-ink-900/40 backdrop-blur-sm"
            />
            <div className="absolute inset-0 z-50 flex items-end justify-center pb-12 px-5 pointer-events-none">
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                className="w-full max-w-sm bg-white rounded-3xl shadow-card p-6 pointer-events-auto"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5 text-brand-500" />
                  </div>
                  <div>
                    <div className="font-bold text-ink-900 font-display text-base">Track your spending?</div>
                    <div className="text-xs text-ink-500 mt-0.5">Link a wallet to stay on budget.</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setWalletPromptVisible(false)}
                    className="h-10 rounded-2xl bg-ink-50 text-ink-700 text-xs font-semibold press"
                  >
                    Later
                  </button>
                  <button
                    onClick={() => { setWalletPromptVisible(false); nav('/wallet'); }}
                    className="h-10 rounded-2xl bg-brand-500 text-white text-xs font-bold press shadow-glow"
                  >
                    Create Wallet
                  </button>
                </div>
              </motion.div>
            </div>
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
          <img src="/mascot.svg" alt="TinTin" className="w-5 h-5 object-contain" /> TinTin Plan
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (itinerary.length === 0) return;

    // Initialize Leaflet map on the ref element
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false
    });

    // Add zoom control manually to position it at the top-right (offset down via CSS)
    L.control.zoom({
      position: 'topright'
    }).addTo(map);

    // Add Voyager TileLayer (CartoDB has a premium, clean light aesthetic that matches PaveyApp perfectly)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);

    const latlngs = itinerary.map(p => [p.lat, p.lng] as L.LatLngTuple);

    // Create markers for each place
    const markers: L.Marker[] = [];
    itinerary.forEach((place, i) => {
      const customIcon = L.divIcon({
        html: `<div class="bg-brand-500 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-lg press">${i + 1}</div>`,
        className: 'custom-leaflet-icon',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([place.lat, place.lng], { icon: customIcon }).addTo(map);
      marker.on('click', () => onPin(place));
      markers.push(marker);
    });

    // Draw route path line between stops
    if (latlngs.length > 1) {
      L.polyline(latlngs, {
        color: '#3B5BFF',
        weight: 3.5,
        dashArray: '6, 6', // Dashed line
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    }

    // Set bounds to fit all markers
    if (latlngs.length > 0) {
      if (latlngs.length === 1) {
        map.setView(latlngs[0], 15);
      } else {
        map.fitBounds(latlngs, { padding: [50, 50] });
      }
    }

    return () => {
      map.remove();
    };
  }, [itinerary, onPin]);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" style={{ background: '#E6ECF8', zIndex: 0 }} />;
}

/* --------------- BOTTOM SHEET (collapsible) --------------- */

function ItineraryBottomSheet({ itinerary, totals, onStart, onEdit, currency, onSelectPlace }: {
  itinerary: Place[]; totals: { cost: number; time: number; dist: number }; onStart: () => void; onEdit: () => void; currency: Currency; onSelectPlace: (p: Place) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.2}
      onDragEnd={(_, info) => {
        if (info.offset.y < -30) {
          setExpanded(true);
        } else if (info.offset.y > 30) {
          setExpanded(false);
        }
      }}
      initial={{ y: 120 }} animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      className="absolute inset-x-0 bottom-0 z-30 bg-white rounded-t-3xl shadow-card pb-28 cursor-grab active:cursor-grabbing"
    >
      <div className="w-full flex flex-col items-center pt-3 pb-2 select-none">
        <div className="w-12 h-1.5 bg-ink-200 rounded-full" />
        <div className="flex items-center gap-1 text-[10px] text-ink-400 font-medium mt-1">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          {expanded ? 'Hide stops · drag down to collapse' : `${itinerary.length} stops · drag up to expand`}
        </div>
      </div>

      <div className="px-5 grid grid-cols-3 text-center mb-3">
        <Block label="Est. Time" value={`${Math.floor(totals.time / 60)}h ${totals.time % 60}m`} />
        <Block label="Distance" value={`${totals.dist.toFixed(2)} km`} />
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
            <div className="px-5 max-h-[32vh] overflow-y-auto no-scrollbar space-y-2 mb-3 cursor-default">
              {itinerary.map((p, i) => (
                <div
                  key={p.id}
                  onClick={() => onSelectPlace(p)}
                  className="flex items-center gap-3 bg-white rounded-2xl p-2.5 border border-ink-100 cursor-pointer press hover:border-brand-300 transition-colors"
                >
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
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-5 space-y-2">
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


