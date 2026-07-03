import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, SlidersHorizontal, CloudSun, Bookmark,
  X, Star, MapPin, Pencil,
  ChevronRight, Plus, Navigation, RefreshCw,
  ArrowRight, Compass, Zap, AlertTriangle,
  Trees, Coffee, Landmark, Scale, ArrowLeft, Clock,
  Settings2, User,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGetWeather } from '../lib/api';
import StatusBar from '../components/StatusBar';
import PlaceCard from '../components/PlaceCard';
import { useApp } from '../context/AppContext';
import { HERO_IMAGE, USER } from '../data/user';
import { formatCost, isDuplicateDestination, tripsOverlap } from '../lib/format';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../components/Toast';
import { PLACES, type Category, type Vibe } from '../data/places';
import type { Place } from '../data/places';
import type { TripPace, Destination } from '../context/AppContext';
import { formatCurrencyAmount } from '../data/wallet';
import { COUNTRY_CITY_HINTS } from '../data/countryHints';
import { countDistinctRegions } from '../data/regions';
import {
  filterDestinationsByRegion, exceedsMaxDuration, isOverDense,
} from '../lib/planValidation';
import { IntentBanners } from '../components/IntentBanners';
import MiniCalendar from '../components/MiniCalendar';
import { allocateDays, type PlannerDestination } from '../lib/itinerary';
import { COPY } from '../lib/copy';
import { tripDurationDays, isPastDate } from '../lib/dateUtils';
import TripTooLongModal from '../components/TripTooLongModal';
import { suggestCurrency, DEFAULT_TRIP, CURRENCY_RATES_TO_IDR, CURRENCY_SYMBOLS } from '../data/wallet';

const MAX_DESTINATIONS = 6;

const VIBES: { id: Vibe; label: string; tint: string }[] = [
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

const CATEGORIES: Category[] = ['Cafe', 'Nature', 'Cultural', 'Historic', 'Foodie', 'Hidden Gem', 'Cozy'];

const SUGGESTED_DESTINATIONS = [
  'Bali, Indonesia',
  'Jakarta, Indonesia',
  'Bandung, Indonesia',
  'Medan, Indonesia',
  'Yogyakarta, Indonesia',
  'Ubud, Bali',
  'Seminyak, Bali',
  'Canggu, Bali',
  'Uluwatu, Bali',
  'Bangkok, Thailand',
  'Tokyo, Japan',
  'Paris, France',
  'London, United Kingdom',
  'New York, USA',
  'Singapore',
  'Kuala Lumpur, Malaysia',
  'Seoul, South Korea',
  'Sydney, Australia',
  'Lisbon, Portugal',
  'Rome, Italy',
  'Barcelona, Spain',
  'Amsterdam, Netherlands',
  'Berlin, Germany',
  'Hanoi, Vietnam',
];

// Quick Plan durations
const QUICK_PLAN_OPTIONS = [
  { label: '2h', hours: 2 },
  { label: '4h', hours: 4 },
  { label: 'Half day', hours: 6 },
];

export default function HomePage() {
  const nav = useNavigate();
  const {
    vibe, setVibe, budget, setBudget, itinerary, setItinerary,
    savedPlaces, savePlace, removeSavedPlace, isSaved, addStop,
    authUser, onboardingComplete, isAuthenticated,
    destinations, activeDestIdx, setActiveDestIdx, addDestination, setDestinations, removeDestination,
    isNavigating, setIsNavigating, activeTrip, totalSpent, tripBudget, tripDaysRemaining, dailyAllowance,
    currency, setCurrency, journeyStart, setJourneyStart, perDayItineraries,
    pace, setPace,
    trips, createTrip, setActiveTripId, setTripName,
    intentDraft, setIntentDraft, destAutoAdvanced, clearDestAutoAdvanced,
    setNavIndex, setBuddyOpen,
    activeDay, setActiveDay,
  } = useApp();

  // ── Trip state logic ──────────────────────────────────────────
  const todayStops = perDayItineraries.length > 0 ? (perDayItineraries[activeDay] ?? []) : itinerary;
  const hasTodayPlan = todayStops.length > 0;
  const activeDest = destinations[activeDestIdx];
  const nextDest = destinations[activeDestIdx + 1];
  const hasMultiDest = destinations.length > 1;
  const upcomingTrips = trips.filter((t) => t.id !== 'default-trip' && t.id !== activeTrip.id);
  const { show } = useToast();
  const [weatherInfo, setWeatherInfo] = useState<{ temp: number; desc: string } | null>(null);

  const [search, setSearch] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterCats, setFilterCats] = useState<Category[]>([]);
  const [filterMinRating, setFilterMinRating] = useState(0);

  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  // Pre-generation intent sheet
  const [intentSheet, setIntentSheet] = useState<'ai' | 'manual' | 'choice' | null>(null);
  const [intentDest, setIntentDest] = useState('');
  // Rotating placeholder doubles as a teaching prompt: "country or city?"
  const [destPlaceholderIdx, setDestPlaceholderIdx] = useState(0);
  const destPlaceholder = COPY.destInput.placeholders[destPlaceholderIdx];
  // Inline calendar visibility — collapsed by default to keep sheet short
  const [intentDateOpen, setIntentDateOpen] = useState(false);
  const [intentDate, setIntentDate] = useState('');
  const [intentEndDate, setIntentEndDate] = useState('');
  const [intentStartTime, setIntentStartTime] = useState('09:00');
  const [intentEndTime, setIntentEndTime] = useState('17:00');
  const [intentEndTimeSet, setIntentEndTimeSet] = useState(false);
  const [intentVibe, setIntentVibe] = useState<Vibe | null>(null);
  const [intentBudget, setIntentBudget] = useState<number | null>(null);
  const plannerCurrency = useMemo(() => {
    if (intentDest && intentDest.trim()) {
      return suggestCurrency(intentDest);
    }
    return activeTrip.currency;
  }, [intentDest, activeTrip.currency]);
  const [intentErrors, setIntentErrors] = useState<{ dest?: string; date?: string }>({});
  const [showFlightTimes, setShowFlightTimes] = useState(false);
  // (Removed in Round 11 #12 — single-day warning is now an inline hint, not a state-driven dialog.)
  const [showOverlapWarning, setShowOverlapWarning] = useState<string | null>(null);
  const [overlapAcknowledged, setOverlapAcknowledged] = useState(false);
  const [scopeTipOpen, setScopeTipOpen] = useState(false);

  // Review-step modal: shown after validation passes, before /generate nav.
  // Strict 30-day cap modal.
  const [tooLongOpen, setTooLongOpen] = useState(false);
  const [intentPace, setIntentPace] = useState<TripPace>('balanced');
  const endDateInputRef = useRef<HTMLInputElement>(null);
  const intentDestRef = useRef<HTMLInputElement>(null);

  // Issue 27: vibe/budget change prompt
  const [vibeChangedPrompt, setVibeChangedPrompt] = useState(false);
  // Issue 11: vibe/budget sheet
  const [vibeSheet, setVibeSheet] = useState(false);
  // Issue 28: explore nearby sheet
  const [exploreSheet, setExploreSheet] = useState(false);
  // Issue 30: manage destinations sheet
  const [manageDestsSheet, setManageDestsSheet] = useState(false);
  // Route strip view toggle
  // Currency banner
  const [showCurrencyBanner, setShowCurrencyBanner] = useState(false);
  const [currencyBannerDest, setCurrencyBannerDest] = useState('');
  const [currencyBannerCurrency, setCurrencyBannerCurrency] = useState('');
  const prevDestIdxRef = useRef(activeDestIdx);
  // Quick Plan sheet
  const [quickPlanSheet, setQuickPlanSheet] = useState(false);
  const [quickPlanHours, setQuickPlanHours] = useState(2);

  // 1.4 - Currency switch banner
  // Only fires when activeDestIdx was advanced automatically by the date-aware
  // effect in AppContext (today landed in a new destination window). Manual
  // tab taps are gated out so browsing doesn't trigger the banner.
  useEffect(() => {
    if (activeDestIdx === prevDestIdxRef.current) return;
    prevDestIdxRef.current = activeDestIdx;
    if (!destAutoAdvanced) return;
    const dest = destinations[activeDestIdx];
    if (!dest) return;
    if (dest.currency !== activeTrip.currency) {
      setCurrencyBannerDest(dest.name.split(',')[0]);
      setCurrencyBannerCurrency(dest.currency);
      setShowCurrencyBanner(true);
    }
    clearDestAutoAdvanced();
  }, [activeDestIdx, destinations, activeTrip.currency, destAutoAdvanced]);

  // Load real weather for active destination
  useEffect(() => {
    if (!activeDest) return;
    const cityName = activeDest.name.split(',')[0].trim().toLowerCase();
    const match = PLACES.find((p) => p.city.toLowerCase() === cityName);
    const lat = match?.lat ?? -8.5070; // fallback to Ubud/Bali
    const lon = match?.lng ?? 115.2624;

    apiGetWeather(lat, lon)
      .then((data) => {
        if (data) {
          setWeatherInfo({
            temp: Math.round(data.temp_celsius),
            desc: data.condition || 'Cloudy',
          });
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch weather:', err);
      });
  }, [activeDest]);

  const sliderPct = useMemo(() => {
    const min = 50_000, max = 1_000_000;
    return Math.max(0, Math.min(100, ((budget - min) / (max - min)) * 100));
  }, [budget]);

  const searchResults = useMemo(() => {
    if (!search || !search.trim()) return [];
    const q = search.toLowerCase();
    return PLACES.filter((p) => {
      const matchText =
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q));
      const matchCat = filterCats.length === 0 || filterCats.includes(p.category);
      const matchRating = p.rating >= filterMinRating;
      return matchText && matchCat && matchRating;
    });
  }, [search, filterCats, filterMinRating]);

  const activeFilters = filterCats.length + (filterMinRating > 0 ? 1 : 0);

  // ── Trip state logic is moved to the top of the component to avoid TDZ issues ──

  const displayName = isAuthenticated ? (authUser?.name?.split(' ')[0] ?? 'Traveler') : 'Guest';

  // UI1 — Day header computation
  const dayHeaderInfo = useMemo(() => {
    const dayNum = activeDay + 1;
    let dateStr = '';
    const start = journeyStart.date === 'today' ? new Date() : new Date(journeyStart.date);
    const currentDayDate = new Date(start.getTime() + activeDay * 86400000);
    dateStr = currentDayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const cityName = activeDest?.name?.split(',')[0] ?? 'Your Trip';
    return { dayNum, dateStr, cityName };
  }, [journeyStart, activeDest, activeDay]);

  // UI4 — Budget Pulse
  const budgetPulseInfo = useMemo(() => {
    const todayTransactions = activeTrip.transactions.filter((t) => {
      const d = new Date(t.date);
      const today = new Date();
      return d.toDateString() === today.toDateString() && t.amount < 0;
    });
    const todaySpent = todayTransactions.reduce((s, t) => s + Math.abs(t.amount), 0);
    const daysRemaining = tripDaysRemaining;
    const totalBudgetPerDay = tripBudget / Math.max(1, activeTrip.daysTotal);
    const isOnTrack = todaySpent <= totalBudgetPerDay;
    return { todaySpent, totalBudgetPerDay, daysRemaining, isOnTrack };
  }, [activeTrip, tripBudget, tripDaysRemaining]);



  // Auto-open intent sheet when arriving with ?newPlan=1 (from Wallet) or
  // ?openIntent=1 (from "Edit trip" on GeneratePage — restores prior draft).
  // Open plan choice sheet with defaults
  const openPlanChoiceSheet = () => {
    setIntentVibe(vibe);
    setIntentBudget(budget);
    setIntentDest(activeDest?.name.split(',')[0] ?? '');
    setIntentDate('');
    setIntentEndDate('');
    setIntentStartTime('09:00');
    setIntentEndTimeSet(false);
    setIntentErrors({});
    setShowFlightTimes(false);
    setShowOverlapWarning(null);
    setOverlapAcknowledged(false);
    setIntentPace(pace);
    setIntentSheet('choice');
  };

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('openIntent') === '1' && intentDraft) {
      setIntentDest(intentDraft.dest);
      setIntentDate(intentDraft.startDate);
      setIntentEndDate(intentDraft.endDate);
      setIntentStartTime(intentDraft.startTime);
      setIntentEndTime(intentDraft.endTime);
      setIntentEndTimeSet(true);
      setIntentVibe(intentDraft.vibe);
      setIntentBudget(intentDraft.budget);
      setIntentPace(intentDraft.pace);
      setIntentErrors({});
      setIntentSheet('ai');
      const next = new URLSearchParams(searchParams);
      next.delete('openIntent');
      setSearchParams(next, { replace: true });
      return;
    }
    if (searchParams.get('newPlan') === '1') {
      openPlanChoiceSheet();
      // Strip the param so the sheet doesn't re-open on back navigation
      const next = new URLSearchParams(searchParams);
      next.delete('newPlan');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams]); // eslint-disable-line

  // Auto-fill end time = start time + 8 hours unless user manually set it
  useEffect(() => {
    if (intentEndTimeSet) return;
    const [h, m] = intentStartTime.split(':').map(Number);
    const eh = (h + 8) % 24;
    setIntentEndTime(`${String(eh).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }, [intentStartTime, intentEndTimeSet]);

  // Rotate the WHERE placeholder while the AI intent sheet is open and the
  // input is empty — the placeholder is the tutorial for "country or city?".
  useEffect(() => {
    if (intentSheet !== 'ai' || intentDest) return;
    const id = setInterval(() => {
      setDestPlaceholderIdx((i) => (i + 1) % COPY.destInput.placeholders.length);
    }, 2500);
    return () => clearInterval(id);
  }, [intentSheet, intentDest]);





  // Compute the day count once; the review modal & nav both need it.
  const intentDays = intentEndDate ? tripDurationDays(intentDate, intentEndDate) : 1;

  // proceedIntent — final step: persist inputs, mint a wallet trip if needed, navigate to /generate.
  // Called once intent-sheet validation passes — navigates to the merged review on /generate.
  const proceedIntent = () => {
    if (intentVibe) setVibe(intentVibe);
    if (intentBudget) setBudget(intentBudget);
    setPace(intentPace);
    const days = intentDays;
    setJourneyStart({ date: intentDate, time: intentStartTime, days, endTime: intentEndDate ? intentEndTime : undefined });

    const newDests: Destination[] = [
      {
        id: `dest-${Date.now()}`,
        name: intentDest,
        days,
        currency: suggestCurrency(intentDest),
        itinerary: [],
        arriveDate: intentDate,
        departDate: intentEndDate || undefined,
      }
    ];
    setDestinations(newDests);
    setActiveDestIdx(0);

    // Always create a new wallet trip when a new plan is confirmed so "plan another trip" doesn't get stuck.
    const cities = [intentDest].filter(Boolean);
    const firstCity = cities[0]?.split(',')[0] ?? intentDest;
    const tripName = cities.length > 1 ? `${firstCity} + ${cities.length - 1} more` : `${firstCity} Trip`;
    const dailyBudget = intentBudget || budget;
    const suggestedCur = suggestCurrency(cities[0] ?? intentDest);
    createTrip({
      name: tripName,
      destination: cities.join(' → '),
      currency: suggestedCur,
      budget: dailyBudget * Math.max(1, days),
      daysTotal: days,
      daysRemaining: days,
      linkedToPlan: true,
      destinations: newDests,
      journeyStart: { date: intentDate, time: intentStartTime, days, endTime: intentEndDate ? intentEndTime : undefined },
      vibe: intentVibe || vibe,
      pace: intentPace,
      perDayItineraries: [],
      itinerary: [],
    });

    const mode = intentSheet;
    // Persist intent fields so the "Edit trip" link on GeneratePage can
    // restore the form instead of forcing the user to re-enter everything.
    setIntentDraft({
      dest: intentDest,
      startDate: intentDate,
      endDate: intentEndDate,
      startTime: intentStartTime,
      endTime: intentEndTime,
      vibe: intentVibe,
      budget: intentBudget,
      pace: intentPace,
    });
    setIntentSheet(null);
    setShowOverlapWarning(null);
    const params = new URLSearchParams();
    if (mode === 'manual') params.set('mode', 'manual');
    params.set('startTime', intentStartTime);
    if (intentEndDate) params.set('endTime', intentEndTime);
    params.set('days', String(days));
    params.set('pace', intentPace);
    // Pass city as URL param — source of truth that's immune to React state timing issues.
    // buildFullItinerary reads destinations[0]?.name from context, which may still hold
    // the previous trip's city if the setState hasn't settled before the effect runs.
    params.set('city', intentDest);
    nav(`/generate?${params}`);
  };

  // handleIntentConfirm — entry from the bottom CTA. Runs field/inline validation,
  // checks the hard 30-day cap, then opens the review modal (never navs directly).
  const handleIntentConfirm = () => {
    const errs: { dest?: string; date?: string } = {};
    if (!intentDest.trim()) errs.dest = 'Please enter your destination to continue';
    if (!intentDate) errs.date = 'Please pick a start date to continue';
    if (intentEndDate && intentDate && new Date(intentEndDate) < new Date(intentDate)) {
      errs.date = 'End date must be after start date';
    }
    if (Object.keys(errs).length > 0) { setIntentErrors(errs); return; }
    setIntentErrors({});

    // Round 11 — the previous mid-flow "single-day" dialog has been replaced
    // with an inline hint below the date field (rendered while end is unset).
    // Users may proceed straight through without confirming a popup.

    // STRICT 30-day cap — hard block with a friendly explanation.
    if (intentEndDate && exceedsMaxDuration(intentDays)) {
      setTooLongOpen(true);
      return;
    }

    // Overlapping trip check (soft warning)
    if (intentDate && intentEndDate && !overlapAcknowledged
        && journeyStart.date && journeyStart.date !== 'today'
        && itinerary.length > 0) {
      if (tripsOverlap(intentDate, intentDays, journeyStart.date, journeyStart.days)) {
        setShowOverlapWarning(activeTrip.name || 'your current plan');
        return;
      }
    }

    // Cities > days is impossible pacing — block here with a field-level error
    // instead of opening a modal. User fixes the inputs and tries again.
    const journeyCitiesNow = destinations.length > 0
      ? destinations.map((d) => d.name)
      : [intentDest].filter(Boolean);
    if (isOverDense(journeyCitiesNow.length, intentDays)) {
      setIntentErrors({ date: `You have ${journeyCitiesNow.length} cities in ${intentDays} day${intentDays !== 1 ? 's' : ''}. Add more days or remove a city.` });
      return;
    }

    // All validation passed — go straight to the generated review screen.
    proceedIntent();
  };

  const handleQuickPlan = () => {
    const stops = Math.round((quickPlanHours * 60) / 90);
    const trimmed = itinerary.slice(0, Math.max(1, stops));
    setItinerary(trimmed.length > 0 ? trimmed : itinerary.slice(0, 1));
    setQuickPlanSheet(false);
    nav('/map');
  };

  /* ── Review-modal derived inputs ──────────────────────────────────
     Driven by the intent-sheet state. Three modes:
       - 'confirm'  : everything clean, brand button.
       - 'friction' : a soft major banner is firing — amber button + note.
       - 'guidance' : input is non-viable (cities > days) — show fix chips.
     ──────────────────────────────────────────────────────────────── */
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      {/* Scrollable page body */}
      <div className="absolute inset-0 overflow-y-auto pb-32 no-scrollbar">
        {/* Hero */}
      <div className="relative h-[260px] overflow-hidden">
        <motion.img
          src={HERO_IMAGE} alt="Destination"
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ scale: 1.08 }} animate={{ scale: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-white/90" />
        <div className="relative z-10">
          <StatusBar tone="light" />
          <div className="px-5 mt-4 flex items-start justify-between">
            <div>
              <p className="text-white/90 text-sm font-medium drop-shadow">Good morning,</p>
              <h1 className="text-white text-4xl font-extrabold tracking-tight drop-shadow flex items-center gap-2 font-display">
                {displayName}
                <motion.span animate={{ rotate: [0, 18, -8, 14, 0] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2 }}>👋</motion.span>
              </h1>
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                {activeDest ? (
                  <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                    <MapPin className="w-3 h-3 text-white" />
                    <span className="text-white text-xs font-semibold">{activeDest.name.split(',')[0]}</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1 text-white/90 text-xs font-semibold drop-shadow">
                    <MapPin className="w-3 h-3" /> {USER.current}
                  </div>
                )}
                
                {!isAuthenticated && (
                  <button
                    onClick={() => nav('/onboarding')}
                    className="inline-flex items-center gap-1 bg-brand-500 text-white rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider press shadow-glow border border-brand-400/50"
                  >
                    <User className="w-3 h-3" />
                    <span>Tap to Sign In</span>
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearch(search === null ? '' : null as unknown as string)}
                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center press"
              >
                <Search className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => nav('/profile')}
                className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-white press bg-white/20 backdrop-blur-sm flex items-center justify-center"
              >
                {isAuthenticated ? (
                  <img src={USER.avatar} alt="me" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Consolidated Active Trip Control Card */}
      <div className="px-5 -mt-12 relative z-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 28 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-xl p-5 border border-white/80"
        >
          {hasTodayPlan ? (
            /* Case A: Active Trip Plan */
            <div>
              {/* Header section with Trip info and Weather */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold tracking-widest text-brand-600 uppercase">ACTIVE TRIP</span>
                  <h2 className="text-xl font-bold text-ink-900 font-display mt-0.5 leading-snug truncate flex items-center gap-1.5">
                    <span className="truncate">{activeTrip.name || `${dayHeaderInfo.cityName} Trip`}</span>
                  </h2>
                  <p className="text-xs text-ink-500 mt-1 flex items-center gap-1.5 font-medium">
                    <span className="flex items-center gap-1">
                      <span>Day</span>
                      <select
                        value={activeDay}
                        onChange={(e) => setActiveDay(Number(e.target.value))}
                        className="bg-brand-50 text-brand-700 font-bold px-1.5 py-0.5 rounded-lg border border-brand-100 outline-none text-xs cursor-pointer press"
                      >
                        {Array.from({ length: activeTrip.daysTotal || destinations.length || 1 }).map((_, i) => (
                          <option key={i} value={i}>
                            {i + 1}
                          </option>
                        ))}
                      </select>
                      <span>of {activeTrip.daysTotal || destinations.length}</span>
                    </span>
                    <span className="text-ink-300">•</span>
                    <span className="truncate">{dayHeaderInfo.cityName}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-ink-50 rounded-2xl p-2 shrink-0 border border-ink-100/50">
                  <CloudSun className="w-6 h-6 text-brand-500" />
                  <div className="text-right">
                    <div className="text-sm font-black text-ink-900 leading-none">{weatherInfo ? `${weatherInfo.temp}°` : '28°'}</div>
                    <div className="text-[9px] text-ink-500 font-bold leading-none mt-0.5 capitalize">{weatherInfo ? weatherInfo.desc : 'Cloudy'}</div>
                  </div>
                </div>
              </div>

              {/* Stats & Vibe Grid */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={() => setVibeSheet(true)}
                  className="flex items-center gap-2 p-2.5 bg-ink-50/60 rounded-2xl hover:bg-ink-100/60 border border-ink-100/30 text-left transition-all press group"
                >
                  <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center text-sm shrink-0 border border-brand-100/40">
                    {getVibeIcon(vibe, "w-4 h-4 text-brand-500")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] text-ink-400 font-bold uppercase tracking-wider">VIBE</div>
                    <div className="text-xs font-bold text-ink-800 truncate flex items-center gap-0.5">
                      {VIBES.find((v) => v.id === vibe)?.label}
                      <Settings2 className="w-3 h-3 text-brand-500/80 group-hover:text-brand-600 transition-colors ml-0.5" />
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-2 p-2.5 bg-ink-50/60 rounded-2xl border border-ink-100/30 text-left">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-sm shrink-0 border border-purple-100/40">
                    📍
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] text-ink-400 font-bold uppercase tracking-wider">STOPS</div>
                    <div className="text-xs font-bold text-ink-800 truncate">
                      {todayStops.length} stops planned
                    </div>
                  </div>
                </div>
              </div>

              {/* Budget Progress Bar */}
              {activeTrip.transactions.length > 0 && (
                <div className="mt-4 pt-3.5 border-t border-ink-100/50">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-ink-600 font-semibold flex items-center gap-1">
                      <span>Spent</span>
                      <span className="font-extrabold text-ink-900">{formatCurrencyAmount(totalSpent, currency)}</span>
                      <span className="text-ink-400">/</span>
                      <span className="text-ink-500">{formatCurrencyAmount(tripBudget, currency)}</span>
                    </span>
                    <span className={`font-bold px-2 py-0.5 rounded-full text-[9px] ${budgetPulseInfo.isOnTrack ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      {budgetPulseInfo.isOnTrack ? 'On track' : 'Over budget'}
                    </span>
                  </div>
                  <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${budgetPulseInfo.isOnTrack ? 'bg-emerald-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(100, (totalSpent / tripBudget) * 100)}%` }}
                    />
                  </div>
                  {tripDaysRemaining > 0 && (
                    <div className="text-[10px] text-ink-400 font-semibold mt-1.5">
                      {formatCurrencyAmount(dailyAllowance, currency)}/day allowance left · {tripDaysRemaining} day{tripDaysRemaining !== 1 ? 's' : ''} remaining
                    </div>
                  )}
                </div>
              )}

              {/* Active Navigation Alert */}
              {isNavigating && (
                <div className="mt-4 bg-brand-50 rounded-2xl p-3 border border-brand-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-150 flex items-center justify-center shrink-0">
                    <Navigation className="w-4 h-4 text-brand-600 animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-brand-900 font-bold text-xs leading-none">Navigation active</div>
                    <div className="text-[10px] text-brand-600 mt-1">Tap resume to go to live route map</div>
                  </div>
                  <button onClick={() => nav('/navigate')} className="h-8 px-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold press transition-colors">
                    Resume
                  </button>
                </div>
              )}

              {/* Bottom Action buttons inside card */}
              <div className="flex gap-2.5 mt-4 pt-3.5 border-t border-ink-100/50">
                <button
                  onClick={() => nav('/trips')}
                  className="flex-1 h-11 rounded-2xl bg-ink-50 hover:bg-ink-100 text-ink-800 border border-ink-200/50 font-bold text-xs press flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Open Itinerary</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                </button>
                <button
                  onClick={() => nav(isNavigating ? '/navigate' : '/map')}
                  className="flex-1 h-11 rounded-2xl bg-brand-500 text-white font-bold text-xs press flex items-center justify-center gap-1.5 shadow-glow hover:bg-brand-600 transition-colors"
                >
                  <span>{isNavigating ? 'Resume Route' : 'Go to Map'}</span>
                  <Navigation className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* Case B: No Active Trip Plan */
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-3.5 border border-brand-100/50 shadow-sm">
                <Compass className="w-7 h-7 text-brand-500" />
              </div>
              <h3 className="font-bold text-ink-900 text-base font-display">Start Your Adventure</h3>
              <p className="text-xs text-ink-500 mt-1.5 max-w-[260px] mx-auto leading-relaxed">
                Build your itinerary with TinTin AI or plan your custom stops manually to get started.
              </p>
              <button
                onClick={openPlanChoiceSheet}
                className="mt-5 w-full h-11 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs press flex items-center justify-center gap-1.5 shadow-glow transition-colors"
              >
                <span>Plan My Journey</span>
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Quick Tutorial Guide for New Accounts ── */}
      {!hasTodayPlan && (
        <div className="px-5 mt-4">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, type: 'spring', stiffness: 280, damping: 28 }}
            className="bg-brand-50/40 border border-brand-100/60 rounded-3xl p-5"
          >
            <span className="text-[9px] font-extrabold tracking-widest text-brand-600 uppercase">Getting Started</span>
            <h3 className="text-sm font-bold text-brand-950 font-display mt-0.5 mb-3">Welcome to Pavey! Get started with these steps:</h3>
            <div className="space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-500 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">1</div>
                <div>
                  <h4 className="text-xs font-bold text-brand-950">Plan Your First Trip</h4>
                  <p className="text-[11px] text-brand-700/90 leading-snug mt-0.5">Tap the <strong>Plan My Journey</strong> button above. Enter your destination and preferences, and our AI core will generate a personalized itinerary.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-500 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">2</div>
                <div>
                  <h4 className="text-xs font-bold text-brand-950">Chat with TinTin AI</h4>
                  <p className="text-[11px] text-brand-700/90 leading-snug mt-0.5">Tap the floating mascot in the bottom right corner anytime to ask travel questions, find hotels, or check the weather.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-500 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">3</div>
                <div>
                  <h4 className="text-xs font-bold text-brand-950">Manage Expenses &amp; Budget</h4>
                  <p className="text-[11px] text-brand-700/90 leading-snug mt-0.5">Track your travel expenses and daily allowances by tapping the <strong>Wallet</strong> tab in the navigation bar.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Currency switch banner */}
      <AnimatePresence>
        {showCurrencyBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="mx-5 mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5"
          >
            <span className="text-sm">💱</span>
            <span className="text-xs text-amber-800 font-medium flex-1">You're now in {currencyBannerDest} · Switch wallet to {currencyBannerCurrency}?</span>
            <button
              onClick={() => { setCurrency(currencyBannerCurrency as Parameters<typeof setCurrency>[0]); setShowCurrencyBanner(false); show(`Wallet switched to ${currencyBannerCurrency}`, 'success'); }}
              className="text-xs font-bold text-amber-700 press px-2 py-1 bg-amber-100 rounded-lg"
            >Switch</button>
            <button onClick={() => setShowCurrencyBanner(false)} className="text-xs text-amber-500 font-medium press">Keep</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Multi-Destination Trip Strip ── */}
      {hasMultiDest && (
        <div className="px-5 mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold tracking-widest text-ink-500">YOUR ROUTE</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setManageDestsSheet(true)} className="text-xs text-ink-500 font-semibold press">Manage</button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {destinations.map((d, i) => (
              <div key={d.id} className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setActiveDestIdx(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold press transition-colors whitespace-nowrap ${
                    i === activeDestIdx
                      ? 'bg-brand-500 text-white shadow-glow'
                      : 'bg-ink-50 text-ink-700 border border-ink-100'
                  }`}
                >
                  {i === activeDestIdx && <span className="w-1.5 h-1.5 rounded-full bg-white/80" />}
                  {d.name.split(',')[0]}
                  <span className={`text-[10px] ${i === activeDestIdx ? 'text-white/70' : 'text-ink-400'}`}>{d.days}d</span>
                </button>
                {i < destinations.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-ink-300 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upcoming Trips / Plan Another Section ── */}
      {hasTodayPlan && (
        upcomingTrips.length > 0 ? (
          <div className="px-5 mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold tracking-widest text-ink-500 uppercase">UPCOMING TRIPS</span>
              <button onClick={() => nav('/trips')} className="text-xs text-brand-600 font-semibold press">See all</button>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {/* Dotted Plan Another Card at the beginning of scroll */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={openPlanChoiceSheet}
                className="shrink-0 w-32 rounded-2xl border border-dashed border-brand-300 bg-brand-50/10 hover:bg-brand-50/20 flex flex-col items-center justify-center gap-1.5 text-brand-600 press transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="text-[10px] font-bold">Plan another</span>
              </motion.button>
              {upcomingTrips.map((trip) => (
                <motion.button
                  key={trip.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { setActiveTripId(trip.id); show(`Switched active trip to ${trip.name}`, 'success'); }}
                  className="shrink-0 w-40 rounded-2xl p-3 text-left press transition-all bg-ink-50 border border-ink-100 hover:border-brand-200"
                >
                  <div className="text-[9px] font-bold tracking-wider text-ink-400 mb-1">
                    TRIP
                  </div>
                  <div className="font-bold text-xs truncate font-display text-ink-900">{trip.name}</div>
                  <div className="text-[10px] truncate text-ink-500 mt-0.5">{trip.destination}</div>
                  <div className="flex items-center gap-1.5 mt-2 text-[9px] font-semibold text-ink-400">
                    <span>{trip.daysTotal}d</span>
                    <span>·</span>
                    <span>{trip.currency}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          /* Dotted full-width banner if no other upcoming trips */
          <div className="px-5 mt-4">
            <button
              onClick={openPlanChoiceSheet}
              className="w-full h-11 rounded-2xl border-2 border-dashed border-ink-250 text-ink-500 text-xs font-bold press flex items-center justify-center gap-2 hover:border-brand-300 transition-colors"
            >
              <Plus className="w-4 h-4" /> Plan another trip
            </button>
          </div>
        )
      )}

      {/* Search — full screen dedicated search view */}
      <AnimatePresence>
        {search !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-50 bg-white flex flex-col pointer-events-auto"
          >
            {/* Search Header */}
            <div className="px-5 pt-12 pb-4 border-b border-ink-100 flex items-center gap-3 shrink-0">
              <button
                onClick={() => setSearch(null as unknown as string)}
                className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-ink-700 press hover:bg-ink-50"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="flex-1 bg-ink-50 rounded-2xl px-4 py-2.5 flex items-center gap-2 border border-transparent focus-within:border-brand-300 transition-colors">
                <Search className="w-4 h-4 text-ink-400 shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search places, vibes, activities…"
                  className="flex-1 bg-transparent outline-none text-sm text-ink-900 placeholder:text-ink-400"
                  autoFocus
                />
                {search && (
                  <button onClick={() => setSearch('')} className="p-1 hover:bg-ink-150 rounded-full press text-ink-400 flex items-center justify-center">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              
              <button
                className={`relative press w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${activeFilters > 0 ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-700'}`}
                onClick={() => setFilterOpen(true)}
              >
                <SlidersHorizontal className="w-4 h-4" />
                {activeFilters > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {activeFilters}
                  </span>
                )}
              </button>
            </div>

            {/* Search Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 no-scrollbar">
              {!search.trim() ? (
                <>
                  {/* Recent Searches */}
                  <div>
                    <div className="text-[10px] font-bold tracking-widest text-ink-400 mb-2.5 uppercase">Recent Searches</div>
                    <div className="flex flex-wrap gap-2">
                      {['Ubud rice terraces', 'Seminyak beach clubs', 'Cultural temples'].map((q) => (
                        <button
                          key={q}
                          onClick={() => setSearch(q)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ink-50 hover:bg-ink-100 text-ink-700 text-xs font-semibold press transition-colors"
                        >
                          <Clock className="w-3 h-3 text-ink-400" />
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Suggested Destinations */}
                  <div>
                    <div className="text-[10px] font-bold tracking-widest text-ink-400 mb-2.5 uppercase">Suggested Destinations</div>
                    <div className="grid grid-cols-2 gap-2">
                      {['Seminyak', 'Ubud', 'Canggu', 'Uluwatu'].map((dest) => (
                        <button
                          key={dest}
                          onClick={() => setSearch(dest)}
                          className="flex items-center gap-2.5 p-3 rounded-2xl border border-ink-100 hover:border-brand-200 hover:bg-brand-50/20 text-left press transition-all"
                        >
                          <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center text-sm shrink-0">
                            📍
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-ink-900 truncate">{dest}</div>
                            <div className="text-[10px] text-ink-400 truncate">Popular area</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search Recommendations */}
                  <div>
                    <div className="text-[10px] font-bold tracking-widest text-ink-400 mb-2.5 uppercase">Search Recommendations</div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: '🏖️ Beaches', query: 'beach' },
                        { label: '☕ Cafes & Dining', query: 'cafe' },
                        { label: '🏛️ Cultural Sites', query: 'temple' },
                        { label: '🌳 Nature & Parks', query: 'park' },
                      ].map((rec) => (
                        <button
                          key={rec.label}
                          onClick={() => setSearch(rec.query)}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-ink-50 hover:bg-ink-100 text-left press transition-colors"
                        >
                          <span className="text-xs font-bold text-ink-800">{rec.label}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-ink-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                /* Search Results */
                <div className="space-y-3">
                  {searchResults.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="text-3xl mb-2">🔍</div>
                      <div className="text-sm font-bold text-ink-900">No places found</div>
                      <div className="text-xs text-ink-500 mt-1">Try searching for a different word, category, or tag</div>
                    </div>
                  ) : (
                    <>
                      <div className="text-[10px] font-bold tracking-widest text-ink-400 mb-2.5 uppercase">Results ({searchResults.length})</div>
                      <div className="space-y-2.5">
                        {searchResults.slice(0, 8).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => { setSearch(null as unknown as string); setDetailPlace(p); }}
                            className="w-full flex items-center gap-3.5 p-3 rounded-2xl bg-white border border-ink-100 hover:border-brand-200 press text-left transition-all"
                          >
                            <img src={p.image} alt={p.name} referrerPolicy="no-referrer" className="w-14 h-14 rounded-xl object-cover shrink-0 border border-ink-50 shadow-sm" />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-ink-900 text-sm truncate">{p.name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-ink-500">{p.category}</span>
                                <span className="flex items-center gap-0.5 text-[10px] text-amber-500 font-bold">
                                  ⭐ {p.rating}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs font-bold text-brand-600">{formatCost(p.cost, activeTrip.currency)}</div>
                              <div className="text-[9px] text-ink-400 mt-0.5">{p.durationMin}m visit</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SECONDARY PLAN HELPERS ── */}
      {hasTodayPlan && destinations.length > 1 && activeDestIdx < destinations.length - 1 && (
        <div className="px-5 mt-4">
          <div className="flex items-center justify-between bg-brand-50 border border-brand-100/40 rounded-2xl p-3.5">
            <div className="text-xs">
              <span className="text-ink-500 font-medium">Tomorrow: </span>
              <span className="font-bold text-ink-900">{destinations[activeDestIdx + 1].name.split(',')[0]}</span>
              <span className="text-ink-400 ml-1 font-semibold">— No plan yet</span>
            </div>
            <button
              onClick={() => { setActiveDestIdx(activeDestIdx + 1); nav('/generate'); }}
              className="flex items-center gap-1 text-xs font-extrabold text-brand-600 press"
            >
              Plan Now <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Vibe settings updated alert */}
      <AnimatePresence>
        {vibeChangedPrompt && (
          <div className="px-5 mt-4">
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-2xl px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-brand-500 shrink-0" />
                <span className="text-xs text-brand-800 font-semibold">Preferences updated</span>
              </div>
              <button
                onClick={() => { setVibeChangedPrompt(false); nav('/generate'); }}
                className="flex items-center gap-1 text-xs text-brand-600 font-bold press"
              >
                Regenerate <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Saved Places */}
      <AnimatePresence>
        {savedPlaces.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-5 mt-6 overflow-hidden"
          >
            <button onClick={() => nav('/profile')} className="w-full flex items-center justify-between mb-1 press">
              <span className="font-bold text-ink-900 font-display flex items-center gap-1.5">
                <Bookmark className="w-4 h-4 text-brand-500 fill-brand-500" /> Saved Places
              </span>
              <span className="text-xs text-brand-600 font-semibold flex items-center gap-0.5">
                {savedPlaces.length} <ChevronRight className="w-3 h-3" />
              </span>
            </button>
            <p className="text-[10px] text-ink-400 mb-3">Bookmarked from the map</p>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {savedPlaces.map((p) => (
                <motion.button
                  key={p.id}
                  initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  onClick={() => setDetailPlace(p)}
                  className="shrink-0 w-36 rounded-2xl border border-ink-100 overflow-hidden press hover:border-brand-200 transition-colors text-left"
                >
                  <div className="relative h-20">
                    <img src={p.image} alt={p.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSavedPlace(p.id); show('Removed from saved', 'info'); }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center press"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                  <div className="p-2">
                    <div className="text-xs font-semibold text-ink-900 truncate">{p.name}</div>
                    <div className="text-[10px] text-ink-500 flex items-center gap-1 mt-0.5">
                      <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                      {p.rating} · {p.category}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      </div>


      {/* ── Pre-Generation Intent Sheet ── */}
      <AnimatePresence>
        {intentSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIntentSheet(null)} className="absolute inset-0 z-40 bg-ink-900/40" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-8 flex flex-col max-h-[90%] overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3 shrink-0" />
              <div className="px-5 pt-3 pb-4 flex items-center justify-between shrink-0">
                <div>
                  <div className="font-bold text-ink-900 font-display text-base">
                    {intentSheet === 'ai' ? 'Plan with TinTin' : intentSheet === 'choice' ? 'Create New Plan' : 'Build your plan'}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {intentSheet === 'ai' ? 'Tell us where & when — we handle the rest' : intentSheet === 'choice' ? 'Choose how you would like to build this plan' : 'Pick a destination to get started'}
                  </div>
                </div>
                <button onClick={() => setIntentSheet(null)} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
              </div>

              <div className="px-5 pb-4 space-y-4 flex-1 overflow-y-auto no-scrollbar">
                {intentSheet === 'choice' && (
                  <div className="space-y-4 py-2">
                    <button
                      onClick={() => setIntentSheet('ai')}
                      className="w-full text-left p-4 rounded-2xl bg-brand-50 border border-brand-200 hover:border-brand-500 transition-all flex items-start gap-4 press"
                    >
                      <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center shrink-0">
                        <img src="/mascot.svg" alt="TinTin" className="w-6 h-6 object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink-900 text-sm">Plan with TinTin</span>
                          <span className="text-[9px] font-bold text-brand-600 bg-white border border-brand-200 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Recommended</span>
                        </div>
                        <p className="text-xs text-ink-600 mt-1 leading-normal">
                          Tell us your destination and dates — TinTin will automatically generate a complete, optimized daily itinerary for you.
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-ink-400 mt-3 shrink-0" />
                    </button>

                    <button
                      onClick={() => setIntentSheet('manual')}
                      className="w-full text-left p-4 rounded-2xl bg-ink-50 hover:bg-ink-100 transition-all flex items-start gap-4 press border border-ink-100"
                    >
                      <div className="w-10 h-10 rounded-xl bg-ink-100 text-ink-700 flex items-center justify-center shrink-0">
                        <Pencil className="w-5 h-5 text-ink-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-ink-900 text-sm">Build Manually</span>
                        <p className="text-xs text-ink-600 mt-1 leading-normal">
                          Add stops stop-by-stop yourself. Organize your daily schedule and customize it exactly how you want.
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-ink-400 mt-3 shrink-0" />
                    </button>
                  </div>
                )}

                {intentSheet !== 'choice' && (
                  <>

                {/* Scope explainer — honest expectations up front (AI mode only) */}
                {intentSheet === 'ai' && (
                  <div>
                    <button
                      onClick={() => setScopeTipOpen((v) => !v)}
                      className="text-[11px] text-ink-500 leading-relaxed text-left press"
                    >
                      Plans 1–6 cities, up to 30 days.
                    </button>
                    {scopeTipOpen && (
                      <div className="mt-1 text-[11px] text-ink-400 px-1 leading-relaxed">
                        For longer or multi-region trips, we'll suggest clustering for better results.
                      </div>
                    )}
                  </div>
                )}

                {/* WHERE */}
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-2">WHERE</div>
                  <div className={`flex items-center gap-2 rounded-xl px-3 py-3 border-2 transition-colors ${intentErrors.dest ? 'bg-red-50 border-red-400' : 'bg-ink-50 border-transparent focus-within:border-brand-400'}`}>
                    <MapPin className={`w-4 h-4 shrink-0 ${intentErrors.dest ? 'text-red-400' : 'text-ink-400'}`} />
                    <input
                      ref={intentDestRef}
                      value={intentDest}
                      onChange={(e) => { setIntentDest(e.target.value); if (e.target.value.trim()) setIntentErrors((p) => ({ ...p, dest: undefined })); }}
                      placeholder={destPlaceholder}
                      className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none"
                      autoFocus
                    />
                    {intentDest && <button onClick={() => setIntentDest('')}><X className="w-3.5 h-3.5 text-ink-400" /></button>}
                  </div>
                  {/* Static limited places warning */}
                  <div className="mt-2 bg-amber-50/50 border border-amber-200/60 rounded-xl p-3 flex gap-2 items-start">
                    <span className="text-xs mt-0.5 shrink-0">⚠️</span>
                    <p className="text-xs text-amber-800 leading-normal font-medium">
                      Note: Pavey saat ini lebih fokus pada kota-kota di Indonesia. Masukkan kota seperti Bali, Jakarta, Bandung, Jogjakarta, Lombok, dll. untuk mendapatkan rekomendasi tempat dan foto terbaik.
                    </p>
                  </div>
                  {intentErrors.dest && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {intentErrors.dest}
                    </div>
                  )}
                  {/* Country → city hint — inline grey helper, not an error-style banner */}
                  {intentDest && !intentErrors.dest && (() => {
                    const hint = COUNTRY_CITY_HINTS[intentDest.trim().toLowerCase()];
                    if (!hint) return null;
                    return (
                      <button
                        onClick={() => { setIntentDest(hint); setIntentErrors((p) => ({ ...p, dest: undefined })); }}
                        className="mt-1.5 text-[11px] text-ink-500 leading-snug press text-left block"
                      >
                        {COPY.destInput.cityHint(hint)}
                      </button>
                    );
                  })()}
                  {/* Destination autocomplete suggestions */}
                  {intentDest.trim() && !intentErrors.dest && (() => {
                    const q = intentDest.trim().toLowerCase();
                    const filtered = SUGGESTED_DESTINATIONS.filter(
                      (d) => d.toLowerCase().includes(q) && d.toLowerCase() !== q
                    ).slice(0, 3);
                    if (filtered.length === 0) return null;
                    return (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {filtered.map((dest) => (
                          <button
                            key={dest}
                            onClick={() => {
                              setIntentDest(dest.split(',')[0]);
                              setIntentErrors((p) => ({ ...p, dest: undefined }));
                            }}
                            className="px-2.5 py-1 rounded-full text-xs font-semibold press bg-brand-50 text-brand-700 border border-brand-100 transition-colors flex items-center gap-1"
                          >
                            <span>📍</span> {dest}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                  {/* Popular cities — quiet single line of text-buttons */}
                  {!intentDest && (
                    <div className="mt-2 text-[11px] text-ink-400 leading-snug">
                      Popular:{' '}
                      {['Bali', 'Jakarta', 'Bandung', 'Medan', 'Yogyakarta', 'Singapore', 'Kuala Lumpur'].map((city, i, arr) => (
                        <span key={city}>
                          <button
                            onClick={() => { setIntentDest(city); setIntentErrors((p) => ({ ...p, dest: undefined })); }}
                            className="text-ink-600 hover:text-brand-600 font-semibold press"
                          >
                            {city}
                          </button>
                          {i < arr.length - 1 && <span className="text-ink-300"> · </span>}
                        </span>
                      ))}
                    </div>
                  )}
                  {destinations.length > 1 && (
                    <>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {destinations.map((d) => (
                          <button
                            key={d.id}
                            onClick={() => { setIntentDest(d.name.split(',')[0]); setIntentErrors((p) => ({ ...p, dest: undefined })); }}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold press border transition-colors ${intentDest === d.name.split(',')[0] ? 'bg-brand-500 text-white border-brand-500' : 'bg-ink-50 text-ink-700 border-ink-100'}`}
                          >
                            {d.name.split(',')[0]}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 text-[11px] text-ink-400 leading-snug">
                        {COPY.hints.travelDays}
                      </div>
                    </>
                  )}
                </div>



                {/* WHEN — one canonical calendar, collapsed by default */}
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-2">WHEN</div>
                  <div
                    onClick={() => setIntentDateOpen((v) => !v)}
                    className={`w-full flex items-center gap-2 mb-2 press rounded-xl p-1 border transition-colors ${intentErrors.date ? 'border-red-400 bg-red-50' : 'border-transparent bg-ink-50/50'}`}
                  >
                    <div className={`flex-1 py-2 px-3 rounded-xl text-center text-xs font-semibold border transition-colors ${intentDateOpen && !intentEndDate ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-transparent bg-white text-ink-600 shadow-sm'}`}>
                      <div className="text-[9px] text-ink-400 mb-0.5 font-bold tracking-wider">DEPART</div>
                      {intentDate ? new Date(intentDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'Select'}
                    </div>
                    <span className="text-ink-300 font-bold">→</span>
                    <div className={`flex-1 py-2 px-3 rounded-xl text-center text-xs font-semibold border transition-colors ${intentDateOpen && intentDate && !intentEndDate ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-transparent bg-white text-ink-600 shadow-sm'}`}>
                      <div className="text-[9px] text-ink-400 mb-0.5 font-bold tracking-wider">RETURN</div>
                      {intentEndDate ? new Date(intentEndDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'Select'}
                    </div>
                    {intentDate && intentEndDate && (() => {
                      const d = tripDurationDays(intentDate, intentEndDate);
                      return d >= 1 ? (
                        <div className="bg-brand-50 border border-brand-100 rounded-xl px-3 py-2 text-center shrink-0">
                          <div className="text-[9px] text-brand-500 mb-0.5 font-bold tracking-wider">DAYS</div>
                          <div className="text-sm font-bold text-brand-700">{d}</div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                  {intentErrors.date && (
                    <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> {intentErrors.date}
                    </div>
                  )}
                  {intentDate && !intentErrors.date && isPastDate(intentDate) && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> Start date is in the past
                    </div>
                  )}
                  {intentDateOpen && (
                    <div className="mt-2">
                      <MiniCalendar
                        startDate={intentDate ? new Date(intentDate) : null}
                        endDate={intentEndDate ? new Date(intentEndDate) : null}
                        onSelect={(d) => {
                          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                          if (!intentDate || (intentDate && intentEndDate)) {
                            setIntentDate(iso);
                            setIntentEndDate('');
                            setIntentErrors((p) => ({ ...p, date: undefined }));
                          } else {
                            const start = new Date(intentDate);
                            if (d >= start) {
                              setIntentEndDate(iso);
                              setIntentDateOpen(false);
                            } else {
                              setIntentDate(iso);
                              setIntentEndDate('');
                            }
                          }
                        }}
                      />
                      <div className="mt-1 text-[10px] text-ink-400 text-center">
                        {!intentDate ? 'Tap a day to set your start date.' : !intentEndDate ? 'Tap to set your end date (same day = 1-day trip).' : 'Tap a different day to start over.'}
                      </div>
                    </div>
                  )}



                  {/* Inline single-day hint — no dialog, no confirmation. */}
                  {intentSheet === 'ai' && intentDate && !intentEndDate && (
                    <div className="mt-2 text-[11px] text-ink-500 leading-snug">
                      {COPY.hints.singleDay}
                    </div>
                  )}
                </div>

                {/* Arrival & departure times — collapsible, only shown when end date is set */}
                {intentSheet === 'ai' && intentEndDate && (
                  <div>
                    {!showFlightTimes ? (
                      <button
                        onClick={() => setShowFlightTimes(true)}
                        className="text-xs text-brand-600 font-semibold press flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add arrival &amp; departure times
                      </button>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-[10px] font-bold tracking-widest text-ink-500">ARRIVAL &amp; DEPARTURE</div>
                          <button onClick={() => setShowFlightTimes(false)} className="text-[10px] text-ink-400 press">Hide</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[10px] font-semibold text-ink-400 mb-1.5">Arrival time (Day 1)</div>
                            <input
                              type="time"
                              value={intentStartTime}
                              onChange={(e) => setIntentStartTime(e.target.value)}
                              className="w-full bg-ink-50 rounded-xl px-3 py-2.5 text-sm text-ink-700 border border-ink-200 outline-none focus:border-brand-400"
                            />
                          </div>
                          <div>
                            <div className="text-[10px] font-semibold text-ink-400 mb-1.5">Departure time (last day)</div>
                            <input
                              type="time"
                              value={intentEndTime}
                              onChange={(e) => { setIntentEndTime(e.target.value); setIntentEndTimeSet(true); }}
                              className="w-full bg-ink-50 rounded-xl px-3 py-2.5 text-sm text-ink-700 border border-ink-200 outline-none focus:border-brand-400"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-ink-400 mt-1.5">We'll adapt the plan around your schedule.</p>
                      </div>
                    )}
                  </div>
                )}



                {/* Priority-gated banner stack — rules live in src/lib/planValidation.ts.
                    Returns at most one major + one secondary banner.
                    Field-attached errors (past date, country hint) and interactive
                    warnings (overlap, single-day) live elsewhere and don't count. */}
                <IntentBanners
                  durationDays={intentDate && intentEndDate ? tripDurationDays(intentDate, intentEndDate) : 0}
                  destinationNames={destinations.map((x) => x.name)}
                  onKeepOnlyRegion={(region) => {
                    const next = filterDestinationsByRegion(destinations, region);
                    if (next.length > 0) setDestinations(next);
                  }}
                />



                {/* Vibe selection grid directly inline */}
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-2">VIBE</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {VIBES.map((v) => {
                      const active = v.id === (intentVibe || vibe);
                      return (
                        <motion.button
                          key={v.id}
                          type="button"
                          whileTap={{ scale: 0.94 }}
                          onClick={() => setIntentVibe(v.id)}
                          animate={{ scale: active ? 1.04 : 1 }}
                          className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 border-2 transition-colors ${active ? 'border-brand-500 bg-brand-50' : 'border-ink-100 bg-white'}`}
                        >
                           <span className="text-brand-500 mb-1">{getVibeIcon(v.id, "w-5 h-5")}</span>
                          <span className={`text-[9px] font-semibold leading-tight text-center ${active ? 'text-brand-600' : 'text-ink-700'}`}>{v.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Budget selection slider directly inline */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-bold tracking-widest text-ink-500">BUDGET <span className="font-normal normal-case tracking-normal text-ink-400">(per day)</span></div>
                    <div className="flex items-center bg-ink-50 rounded-lg px-2 py-1 border border-ink-200 focus-within:border-brand-400 transition-colors w-32">
                      <span className="text-xs font-semibold text-ink-500 mr-1">
                        {CURRENCY_SYMBOLS[plannerCurrency] ?? plannerCurrency}
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={Math.round((intentBudget ?? budget) / (CURRENCY_RATES_TO_IDR[plannerCurrency] ?? 1))}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const idrVal = val * (CURRENCY_RATES_TO_IDR[plannerCurrency] ?? 1);
                          setIntentBudget(idrVal);
                        }}
                        className="w-full bg-transparent text-xs font-bold text-ink-900 outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                  <input
                    type="range" min={50_000} max={1_000_000} step={10_000}
                    value={Math.min(1_000_000, intentBudget ?? budget)} onChange={(e) => setIntentBudget(Number(e.target.value))}
                    className="vibe-slider mb-1"
                    style={{ ['--val' as string]: `${Math.max(0, Math.min(100, (((Math.min(1_000_000, intentBudget ?? budget)) - 50_000) / (1_000_000 - 50_000)) * 100))}%` } as React.CSSProperties}
                  />
                  <div className="flex justify-between text-xs text-ink-500">
                    <span>{formatCost(50_000, plannerCurrency)}</span>
                    <span className="text-brand-600 font-semibold">
                      {(intentBudget ?? budget) >= 1_000_000 ? 'Custom' : formatCost(intentBudget ?? budget, plannerCurrency)}
                    </span>
                    <span>Custom</span>
                  </div>
                </div>

                  </>
                )}
              </div>

              {intentSheet !== 'choice' && (
                <div className="px-5 shrink-0">
                  <button
                    onClick={handleIntentConfirm}
                    className="w-full h-14 rounded-2xl bg-brand-500 text-white font-bold text-base press shadow-glow flex items-center justify-center gap-2"
                  >
                    {intentSheet === 'ai' ? <><img src="/mascot.svg" alt="TinTin" className="w-6 h-6 object-contain" /> {COPY.ctas.intentSheetContinue}</> : <><Pencil className="w-5 h-5" /> Start planning</>}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Trip-too-long modal (strict 30-day cap) ── */}
      <TripTooLongModal
        open={tooLongOpen}
        days={intentDays}
        regionsCount={countDistinctRegions(destinations.map((d) => d.name))}
        onClose={() => setTooLongOpen(false)}
        onFocusDates={() => endDateInputRef.current?.focus()}
        onFocusDestinations={() => intentDestRef.current?.focus()}
      />



      {/* ── Quick Plan Sheet ── */}
      <AnimatePresence>
        {quickPlanSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQuickPlanSheet(false)} className="absolute inset-0 z-40 bg-ink-900/40" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-8 flex flex-col max-h-[90%] overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3 shrink-0" />
              <div className="px-5 pt-3 pb-3 flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4.5 h-4.5 text-amber-500" />
                    <div className="font-bold text-ink-900 font-display text-base">Short Outing</div>
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">Trim your active day plan to fit a shorter window</div>
                </div>
                <button onClick={() => setQuickPlanSheet(false)} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
              </div>
              <div className="px-5 space-y-4">
                <div className="flex gap-2">
                  {QUICK_PLAN_OPTIONS.map((opt) => {
                    const stops = Math.round((opt.hours * 60) / 90);
                    return (
                      <button
                        key={opt.label}
                        onClick={() => setQuickPlanHours(opt.hours)}
                        className={`flex-1 py-3 px-2 rounded-xl flex flex-col items-center justify-center press transition-all border ${
                          quickPlanHours === opt.hours
                            ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                            : 'bg-ink-50/50 hover:bg-ink-50 text-ink-700 border-ink-100'
                        }`}
                      >
                        <div className="font-bold text-sm leading-tight">{opt.label}</div>
                        <div className={`text-[9px] mt-0.5 ${quickPlanHours === opt.hours ? 'text-white/80' : 'text-ink-400'}`}>
                          Keep {stops} stop{stops !== 1 ? 's' : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {/* Show Preview of Stops */}
                {(() => {
                  const stopsCount = Math.round((quickPlanHours * 60) / 90);
                  const quickPlanStops = itinerary.slice(0, Math.max(1, stopsCount));
                  return (
                    <div className="space-y-2.5">
                      <div className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">
                        Preview of Stops to Keep ({quickPlanStops.length})
                      </div>
                      {quickPlanStops.length === 0 ? (
                        <div className="text-xs text-ink-500 bg-ink-50/50 border border-dashed border-ink-200 rounded-2xl p-6 text-center">
                          No active itinerary found. Go plan a trip with TinTin first!
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-36 overflow-y-auto no-scrollbar bg-ink-50/50 border border-ink-100 rounded-2xl p-3">
                          {quickPlanStops.map((stop, idx) => (
                            <div key={stop.id || idx} className="flex items-center gap-2.5 text-xs text-ink-850 font-semibold truncate bg-white border border-ink-100/50 rounded-xl p-2 shadow-sm">
                              <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-[10px] shrink-0">{idx + 1}</span>
                              <span className="truncate flex-1">{stop.name}</span>
                              <span className="text-[10px] text-ink-400 font-medium">{stop.category}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <button
                  disabled={itinerary.length === 0}
                  onClick={handleQuickPlan}
                  className="w-full h-12 rounded-2xl bg-amber-500 disabled:bg-ink-300 text-white font-bold press shadow-glow flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" /> Trim Plan & View Map
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Vibe & Budget Sheet (Issue 11) ── */}
      <AnimatePresence>
        {vibeSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setVibeSheet(false)} className="absolute inset-0 z-40 bg-ink-900/40" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-8 flex flex-col max-h-[90%] overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3 shrink-0" />
              <div className="px-5 pt-3 pb-4 flex items-center justify-between shrink-0">
                <div className="font-bold text-ink-900 font-display">Vibe & Budget</div>
                <button onClick={() => setVibeSheet(false)} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
              </div>
              <div className="px-5 space-y-5 flex-1 overflow-y-auto no-scrollbar pb-4">
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-2">VIBE</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {VIBES.map((v) => {
                      const active = v.id === vibe;
                      return (
                        <motion.button
                          key={v.id}
                          whileTap={{ scale: 0.94 }}
                          onClick={() => { setVibe(v.id); if (itinerary.length > 0) setVibeChangedPrompt(true); }}
                          animate={{ scale: active ? 1.04 : 1 }}
                          className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 border-2 transition-colors ${active ? 'border-brand-500 bg-brand-50' : 'border-ink-100 bg-white'}`}
                        >
                           <span className="text-brand-500 mb-1">{getVibeIcon(v.id, "w-5 h-5")}</span>
                          <span className={`text-[9px] font-semibold leading-tight text-center ${active ? 'text-brand-600' : 'text-ink-700'}`}>{v.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-bold tracking-widest text-ink-500">BUDGET <span className="font-normal normal-case tracking-normal text-ink-400">(per day)</span></div>
                    <div className="flex items-center bg-ink-50 rounded-lg px-2 py-1 border border-ink-200 focus-within:border-brand-400 transition-colors w-32">
                      <span className="text-xs font-semibold text-ink-500 mr-1">
                        {CURRENCY_SYMBOLS[activeTrip.currency] ?? activeTrip.currency}
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={Math.round(budget / (CURRENCY_RATES_TO_IDR[activeTrip.currency] ?? 1))}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const idrVal = val * (CURRENCY_RATES_TO_IDR[activeTrip.currency] ?? 1);
                          setBudget(idrVal);
                          if (itinerary.length > 0) setVibeChangedPrompt(true);
                        }}
                        className="w-full bg-transparent text-xs font-bold text-ink-900 outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                  <input
                    type="range" min={50_000} max={1_000_000} step={10_000}
                    value={Math.min(1_000_000, budget)} onChange={(e) => { setBudget(Number(e.target.value)); if (itinerary.length > 0) setVibeChangedPrompt(true); }}
                    className="vibe-slider mb-1"
                    style={{ ['--val' as string]: `${Math.max(0, Math.min(100, (((Math.min(1_000_000, budget)) - 50_000) / (1_000_000 - 50_000)) * 100))}%` } as React.CSSProperties}
                  />
                  <div className="flex justify-between text-xs text-ink-500">
                    <span>{formatCost(50_000, activeTrip.currency)}</span>
                    <span className="text-brand-600 font-semibold">{formatCost(budget, activeTrip.currency)}</span>
                    <span>Custom</span>
                  </div>
                </div>
                <button
                  onClick={() => { setVibeSheet(false); nav('/generate'); }}
                  className="w-full h-12 rounded-2xl bg-brand-500 text-white font-bold press shadow-glow flex items-center justify-center gap-2"
                >
                  <img src="/mascot.svg" alt="TinTin" className="w-5 h-5 object-contain" /> Regenerate Plan
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Place Detail Sheet ── */}
      <AnimatePresence>
        {detailPlace && (
          <PlaceCard
            place={detailPlace}
            index={todayStops.findIndex((s) => s.id === detailPlace.id)}
            prevPlace={(() => {
              const idx = todayStops.findIndex((s) => s.id === detailPlace.id);
              return idx > 0 ? todayStops[idx - 1] : undefined;
            })()}
            onClose={() => setDetailPlace(null)}
            onNavigate={() => {
              const idx = todayStops.findIndex((s) => s.id === detailPlace.id);
              setNavIndex(idx >= 0 ? idx : 0);
              setIsNavigating(true);
              setDetailPlace(null);
              show('Navigation started ✓', 'success');
              nav('/navigate');
            }}
            isSaved={isSaved(detailPlace.id)}
            onSave={() => {
              const saved = isSaved(detailPlace.id);
              if (saved) {
                removeSavedPlace(detailPlace.id);
                show('Removed from saved', 'success');
              } else {
                savePlace(detailPlace);
                show('Saved ✓', 'success');
              }
            }}
            currency={currency}
            onBuddy={() => {
              setDetailPlace(null);
              setBuddyOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Issue 28: Explore Nearby Sheet */}
      <AnimatePresence>
        {exploreSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setExploreSheet(false)} className="absolute inset-0 z-40 bg-ink-900/40" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-8 flex flex-col max-h-[90%] overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3 shrink-0" />
              <div className="px-5 pt-3 pb-4 flex items-center justify-between shrink-0">
                <div className="font-bold text-ink-900 font-display flex items-center gap-2"><Compass className="w-4 h-4 text-orange-500" /> Explore Nearby</div>
                <button onClick={() => setExploreSheet(false)} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
              </div>
              <div className="overflow-y-auto no-scrollbar px-5 pb-4 space-y-2 flex-1">
                {PLACES.slice(0, 10).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 bg-white border border-ink-100 rounded-2xl p-2.5">
                    <img src={p.image} alt={p.name} referrerPolicy="no-referrer" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink-900 truncate text-sm">{p.name}</div>
                      <div className="text-xs text-ink-500 flex items-center gap-1 mt-0.5">
                        <span>{p.category}</span>
                        <span>·</span>
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{p.rating}</span>
                        <span>·</span>
                        <span>{formatCost(p.priceRange.min, activeTrip.currency)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => { addStop(p); show(`${p.name} added to plan`, 'success'); }}
                      className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center press shrink-0"
                      aria-label="Add to plan"
                    >
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Issue 30: Manage Destinations Sheet */}
      <AnimatePresence>
        {manageDestsSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setManageDestsSheet(false)} className="absolute inset-0 z-40 bg-ink-900/40" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-8 flex flex-col max-h-[90%] overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3 shrink-0" />
              <div className="px-5 pt-3 pb-4 flex items-center justify-between shrink-0">
                <div className="font-bold text-ink-900 font-display">Manage Destinations</div>
                <button onClick={() => setManageDestsSheet(false)} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
              </div>
              <div className="px-5 space-y-2 pb-4 flex-1 overflow-y-auto no-scrollbar">
                {destinations.length === 0 && (
                  <div className="py-8 text-center text-ink-500 text-sm">No destinations added yet.</div>
                )}
                {destinations.map((d, i) => (
                  <div key={d.id} className="flex items-center gap-3 bg-white border border-ink-100 rounded-2xl px-3 py-2.5">
                    <div className="w-6 h-6 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink-900 text-sm truncate">
                        {d.name}
                      </div>
                      <div className="text-xs text-ink-500">{d.days} day{d.days !== 1 ? 's' : ''} · {d.currency}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        disabled={i === 0}
                        onClick={() => { const next = destinations.slice(); const [item] = next.splice(i, 1); next.splice(i - 1, 0, item); setDestinations(next); }}
                        className="w-7 h-7 flex items-center justify-center text-ink-400 disabled:opacity-20 press"
                      >
                        <ChevronRight className="w-4 h-4 -rotate-90" />
                      </button>
                      <button
                        disabled={i === destinations.length - 1}
                        onClick={() => { const next = destinations.slice(); const [item] = next.splice(i, 1); next.splice(i + 1, 0, item); setDestinations(next); }}
                        className="w-7 h-7 flex items-center justify-center text-ink-400 disabled:opacity-20 press"
                      >
                        <ChevronRight className="w-4 h-4 rotate-90" />
                      </button>
                      <button
                        onClick={() => { removeDestination(d.id); show(`${d.name.split(',')[0]} removed`, 'info'); }}
                        className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 press"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Filter Sheet */}
      <AnimatePresence>
        {filterOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFilterOpen(false)} className="absolute inset-0 z-40 bg-ink-900/40" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-8 flex flex-col max-h-[90%] overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3 shrink-0" />
              <div className="px-5 pt-3 pb-4 flex items-center justify-between shrink-0">
                <div className="font-bold text-ink-900 font-display">Filter Places</div>
                <button onClick={() => setFilterOpen(false)} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
              </div>
              <div className="px-5 space-y-5 flex-1 overflow-y-auto no-scrollbar pb-4">
                <div>
                  <div className="text-xs font-bold tracking-widest text-ink-500 mb-2">CATEGORY</div>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => {
                      const active = filterCats.includes(cat);
                      return (
                        <button
                          key={cat}
                          onClick={() => setFilterCats((prev) => active ? prev.filter((c) => c !== cat) : [...prev, cat])}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold press transition-colors ${active ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-700'}`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold tracking-widest text-ink-500 mb-2">MINIMUM RATING</div>
                  <div className="flex gap-2">
                    {[0, 4.0, 4.3, 4.5, 4.7].map((r) => (
                      <button
                        key={r}
                        onClick={() => setFilterMinRating(r)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold press transition-colors ${filterMinRating === r ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-700'}`}
                      >
                        {r === 0 ? 'All' : `⭐ ${r}+`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setFilterCats([]); setFilterMinRating(0); }} className="h-11 rounded-2xl bg-ink-50 text-ink-700 font-semibold press">Clear All</button>
                  <button onClick={() => { setFilterOpen(false); if (search?.trim()) show(`Filters applied (${activeFilters})`, 'success'); }} className="h-11 rounded-2xl bg-brand-500 text-white font-bold shadow-glow press">
                    Apply{activeFilters > 0 ? ` (${activeFilters})` : ''}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Date Overlap Popup Card Modal ── */}
      <AnimatePresence>
        {showOverlapWarning && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOverlapWarning(null)}
              className="absolute inset-0 z-50 bg-ink-900/40 backdrop-blur-sm"
            />
            {/* Center aligned Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="absolute inset-x-6 top-1/2 -translate-y-1/2 z-50 bg-white rounded-3xl p-6 shadow-xl border border-ink-100 flex flex-col text-center"
            >
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-ink-900 text-lg mb-2 font-display">Date Overlap Warning</h3>
              <p className="text-sm text-ink-600 leading-relaxed mb-6">
                Your planned dates overlap with the existing trip <strong className="text-ink-900 font-semibold">"{showOverlapWarning}"</strong>. Would you like to proceed anyway?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setShowOverlapWarning(null);
                    setOverlapAcknowledged(true);
                    setTimeout(() => proceedIntent(), 50);
                  }}
                  className="w-full h-12 rounded-2xl bg-brand-500 text-white font-bold press shadow-glow flex items-center justify-center"
                >
                  Plan anyway
                </button>
                <button
                  onClick={() => {
                    setShowOverlapWarning(null);
                    setTimeout(() => endDateInputRef.current?.focus(), 50);
                  }}
                  className="w-full h-12 rounded-2xl bg-ink-50 hover:bg-ink-100 text-ink-700 font-semibold press flex items-center justify-center"
                >
                  Change Dates
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>


    </div>
  );
}



/* Renders your custom mascot SVG, falls back to the given element if file isn't added yet */
export function MascotIcon({ src, fallback }: { src: string; fallback: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return <img src={src} alt="" className="w-5 h-5 object-contain" onError={() => setFailed(true)} />;
}


