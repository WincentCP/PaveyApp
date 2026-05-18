import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, SlidersHorizontal, Wand2, CloudSun, Bookmark,
  X, Star, MapPin, Clock, Pencil,
  ChevronRight, DollarSign, Plus, Navigation, RefreshCw,
  ArrowRight, Compass, Zap, Link2, AlertTriangle,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import { useApp } from '../context/AppContext';
import { HERO_IMAGE, USER } from '../data/user';
import { formatCost, isDuplicateDestination, tripsOverlap } from '../lib/format';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../components/Toast';
import { PLACES, type Category, type Vibe } from '../data/places';
import type { Place } from '../data/places';
import type { TripPace } from '../context/AppContext';
import { formatCurrencyAmount } from '../data/wallet';
import { COUNTRY_CITY_HINTS } from '../data/countryHints';
import { countDistinctRegions } from '../data/regions';
import {
  filterDestinationsByRegion, exceedsMaxDuration, isOverDense,
} from '../lib/planValidation';
import { IntentBanners } from '../components/IntentBanners';
import MiniCalendar from '../components/MiniCalendar';
import { COPY } from '../lib/copy';
import { tripDurationDays, isPastDate } from '../lib/dateUtils';
import TripTooLongModal from '../components/TripTooLongModal';
import { suggestCurrency, DEFAULT_TRIP } from '../data/wallet';

const MAX_DESTINATIONS = 6;

const VIBES: { id: Vibe; label: string; icon: string; tint: string }[] = [
  { id: 'nature', label: 'Nature', icon: '🌿', tint: '#10B981' },
  { id: 'cafe', label: 'Café Hopping', icon: '☕', tint: '#F97316' },
  { id: 'activities', label: 'Activities', icon: '🎯', tint: '#3B5BFF' },
  { id: 'cultural', label: 'Cultural', icon: '🏛️', tint: '#A855F7' },
  { id: 'balanced', label: 'Balanced', icon: '⚖️', tint: '#6B7280' },
];

const CATEGORIES: Category[] = ['Cafe', 'Nature', 'Cultural', 'Historic', 'Foodie', 'Hidden Gem', 'Cozy'];

const SOCIAL_MOCK: Record<string, { platform: string; name: string; category: string; desc: string; image: string; cost: number }> = {
  tiktok: {
    platform: 'TikTok',
    name: 'Warung Sunset Cliff Bali',
    category: 'Hidden Gem',
    desc: 'Cliffside warung with jaw-dropping ocean sunset views, found viral on TikTok.',
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
    cost: 65000,
  },
  instagram: {
    platform: 'Instagram',
    name: 'Pura Tirta Gangga Pool',
    category: 'Scenic',
    desc: 'Ancient royal water palace with lotus ponds perfect for an Instagram shot.',
    image: 'https://images.unsplash.com/photo-1604999333679-b86d54738315?auto=format&fit=crop&w=800&q=80',
    cost: 30000,
  },
};

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
    authUser, onboardingComplete,
    destinations, activeDestIdx, setActiveDestIdx, addDestination, setDestinations, removeDestination,
    isNavigating, activeTrip, totalSpent, tripBudget, tripDaysRemaining, dailyAllowance,
    currency, setCurrency, journeyStart, setJourneyStart, perDayItineraries,
    pace, setPace,
    trips, createTrip,
  } = useApp();
  const { show } = useToast();

  const [search, setSearch] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterCats, setFilterCats] = useState<Category[]>([]);
  const [filterMinRating, setFilterMinRating] = useState(0);
  const [socialUrl, setSocialUrl] = useState('');
  const [socialParsing, setSocialParsing] = useState(false);
  const [socialResult, setSocialResult] = useState<typeof SOCIAL_MOCK[string] | null>(null);
  const [socialError, setSocialError] = useState(false);
  const socialInputRef = useRef<HTMLInputElement>(null);
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const [addDestSheet, setAddDestSheet] = useState(false);
  const [newDestName, setNewDestName] = useState('');
  const [newDestDays, setNewDestDays] = useState(2);
  const [newDestArriveDate, setNewDestArriveDate] = useState('');
  const [newDestDepartDate, setNewDestDepartDate] = useState('');
  const [newDestError, setNewDestError] = useState<string | null>(null);
  // Pre-generation intent sheet
  const [intentSheet, setIntentSheet] = useState<'ai' | 'manual' | null>(null);
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
  const [intentErrors, setIntentErrors] = useState<{ dest?: string; date?: string }>({});
  const [showFlightTimes, setShowFlightTimes] = useState(false);
  const [showSingleDayWarning, setShowSingleDayWarning] = useState(false);
  const [showOverlapWarning, setShowOverlapWarning] = useState<string | null>(null);
  const [overlapAcknowledged, setOverlapAcknowledged] = useState(false);
  const [scopeTipOpen, setScopeTipOpen] = useState(false);
  // Review-step modal: shown after validation passes, before /generate nav.
  // Strict 30-day cap modal.
  const [tooLongOpen, setTooLongOpen] = useState(false);
  const [intentPace, setIntentPace] = useState<TripPace>('balanced');
  const endDateInputRef = useRef<HTMLInputElement>(null);

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
  useEffect(() => {
    if (activeDestIdx === prevDestIdxRef.current) return;
    prevDestIdxRef.current = activeDestIdx;
    const dest = destinations[activeDestIdx];
    if (!dest) return;
    if (dest.currency !== activeTrip.currency) {
      setCurrencyBannerDest(dest.name.split(',')[0]);
      setCurrencyBannerCurrency(dest.currency);
      setShowCurrencyBanner(true);
    }
  }, [activeDestIdx, destinations, activeTrip.currency]);

  const sliderPct = useMemo(() => {
    const min = 50_000, max = 1_000_000;
    return Math.max(0, Math.min(100, ((budget - min) / (max - min)) * 100));
  }, [budget]);

  const searchResults = useMemo(() => {
    if (!search || !search.trim()) return [];
    const q = search.toLowerCase();
    return PLACES.filter((p) => {
      const matchText = p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q));
      const matchCat = filterCats.length === 0 || filterCats.includes(p.category);
      const matchRating = p.rating >= filterMinRating;
      return matchText && matchCat && matchRating;
    });
  }, [search, filterCats, filterMinRating]);

  const activeFilters = filterCats.length + (filterMinRating > 0 ? 1 : 0);

  // ── Trip state logic ──────────────────────────────────────────
  const todayStops = perDayItineraries.length > 0 ? (perDayItineraries[0] ?? []) : itinerary;
  const PREVIEW_COUNT = 2;
  const previewStops = todayStops.slice(0, PREVIEW_COUNT);
  const hasTodayPlan = todayStops.length > 0;
  const activeDest = destinations[activeDestIdx];
  const nextDest = destinations[activeDestIdx + 1];
  const hasMultiDest = destinations.length > 1;

  const displayName = authUser?.name?.split(' ')[0] ?? USER.firstName;

  // UI1 — Day header computation
  const dayHeaderInfo = useMemo(() => {
    let dayNum = 1;
    let dateStr = '';
    if (journeyStart.date === 'today') {
      const today = new Date();
      dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    } else {
      const start = new Date(journeyStart.date);
      const today = new Date();
      const diff = Math.floor((today.getTime() - start.getTime()) / 86400000);
      dayNum = Math.max(1, diff + 1);
      dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }
    const cityName = activeDest?.name?.split(',')[0] ?? 'Your Trip';
    return { dayNum, dateStr, cityName };
  }, [journeyStart, activeDest]);

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

  // Auto-calculate days from dates in add dest sheet
  const calcedDays = useMemo(() => {
    if (newDestArriveDate && newDestDepartDate) {
      const a = new Date(newDestArriveDate);
      const b = new Date(newDestDepartDate);
      const diff = Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000));
      return diff;
    }
    return null;
  }, [newDestArriveDate, newDestDepartDate]);

  // Auto-fill end date from start date when end is unset
  useEffect(() => {
    if (intentDate && !intentEndDate) setIntentEndDate(intentDate);
  }, [intentDate, intentEndDate]);

  // Auto-open intent sheet when arriving with ?newPlan=1 (from Wallet)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('newPlan') === '1') {
      setIntentVibe(vibe);
      setIntentBudget(budget);
      setIntentDest(activeDest?.name.split(',')[0] ?? '');
      setIntentDate('');
      setIntentEndDate('');
      setIntentStartTime('09:00');
      setIntentEndTimeSet(false);
      setIntentErrors({});
      setShowFlightTimes(false);
      setShowSingleDayWarning(false);
      setShowOverlapWarning(null);
      setOverlapAcknowledged(false);
      setIntentPace(pace);
      setIntentSheet('ai');
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

  const parseSocialLink = () => {
    if (!socialUrl.trim()) return;
    const lower = socialUrl.toLowerCase();
    const isValid = lower.includes('tiktok.com') || lower.includes('instagram.com') || lower.includes('ig.me') || lower.includes('instagr.am');
    if (!isValid) {
      setSocialError(true);
      return;
    }
    setSocialError(false);
    setSocialParsing(true);
    setSocialResult(null);
    setTimeout(() => {
      setSocialParsing(false);
      if (lower.includes('tiktok')) setSocialResult(SOCIAL_MOCK.tiktok);
      else setSocialResult(SOCIAL_MOCK.instagram);
    }, 1800);
  };

  const handleAddDest = () => {
    const trimmed = newDestName.trim();
    if (!trimmed) {
      setNewDestError('Please enter a destination name');
      return;
    }
    if (isDuplicateDestination(trimmed, destinations)) {
      setNewDestError(`${trimmed} is already in your trip`);
      return;
    }
    if (destinations.length >= MAX_DESTINATIONS) {
      setNewDestError(COPY.maxDestinations);
      return;
    }
    setNewDestError(null);
    const days = calcedDays ?? newDestDays;
    addDestination({
      name: trimmed,
      days,
      arriveDate: newDestArriveDate || undefined,
      departDate: newDestDepartDate || undefined,
    });
    setNewDestName('');
    setNewDestDays(2);
    setNewDestArriveDate('');
    setNewDestDepartDate('');
    setAddDestSheet(false);
    show(`${trimmed} added to your trip`, 'success');
  };

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

    // Auto-mint a wallet trip on first plan confirmation. After that, the user creates trips manually.
    const hasUserTrip = trips.some((t) => t.id !== DEFAULT_TRIP.id);
    if (!hasUserTrip && intentSheet === 'ai') {
      const cities = (destinations.length > 0 ? destinations.map((d) => d.name) : [intentDest]).filter(Boolean);
      const firstCity = cities[0]?.split(',')[0] ?? intentDest;
      const tripName = cities.length > 1 ? `${firstCity} + ${cities.length - 1} more` : `${firstCity} Trip`;
      const dailyBudget = intentBudget || budget;
      createTrip({
        name: tripName,
        destination: cities.join(' → '),
        currency: suggestCurrency(cities[0] ?? intentDest),
        budget: dailyBudget * Math.max(1, days),
        daysTotal: days,
        daysRemaining: days,
        linkedToPlan: true,
      });
      // Surface the connection — see Change 8a.
      setTimeout(() => show(COPY.wallet.tripCreatedToast(tripName), 'success'), 600);
    }

    const mode = intentSheet;
    setIntentSheet(null);
    setShowOverlapWarning(null);
    const params = new URLSearchParams();
    if (mode === 'manual') params.set('mode', 'manual');
    params.set('startTime', intentStartTime);
    if (intentEndDate) params.set('endTime', intentEndTime);
    params.set('days', String(days));
    params.set('pace', intentPace);
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

    // AI mode: warn if no end date before proceeding
    if (intentSheet === 'ai' && !intentEndDate) {
      setShowSingleDayWarning(true);
      return;
    }

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
    <div className="absolute inset-0 overflow-y-auto pb-32 no-scrollbar bg-white">
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
              {activeDest ? (
                <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                  <MapPin className="w-3 h-3 text-white" />
                  <span className="text-white text-xs font-semibold">{activeDest.name.split(',')[0]}</span>
                </div>
              ) : (
                <button className="mt-2 inline-flex items-center gap-1 text-white/90 text-xs font-semibold press drop-shadow">
                  <MapPin className="w-3 h-3" /> {USER.current}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearch(search === null ? '' : null as unknown as string)}
                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center press"
              >
                <Search className="w-5 h-5 text-white" />
              </button>
              <button className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-white press">
                <img src={USER.avatar} alt="me" className="w-full h-full object-cover" />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-brand-500 rounded-full ring-2 ring-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Vibe Card */}
      <div className="px-5 -mt-12 relative z-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 28 }}
          className="bg-white/75 backdrop-blur-xl rounded-2xl shadow-lg p-4 flex items-center gap-4 border border-white/80"
        >
          <div className="text-center shrink-0">
            <CloudSun className="w-8 h-8 text-brand-500 mx-auto" />
            <div className="text-2xl font-extrabold text-ink-900 mt-1 font-display">28°</div>
            <div className="text-[11px] text-ink-500 leading-tight">Partly Cloudy</div>
          </div>
          <div className="w-px h-10 bg-ink-200/60 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold tracking-widest text-brand-500">TODAY'S VIBE</div>
            <div className="text-ink-900 font-bold leading-snug font-display">
              {VIBES.find((v) => v.id === vibe)?.icon} {VIBES.find((v) => v.id === vibe)?.label} day ✨
            </div>
            <div className="text-xs text-ink-500 mt-0.5">Budget · {formatCost(budget, activeTrip.currency)}/day</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] text-ink-400">Humidity</div>
            <div className="text-sm font-bold text-ink-700">74%</div>
          </div>
        </motion.div>

      </div>

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
              <button
                onClick={() => setAddDestSheet(true)}
                className="flex items-center gap-1 text-xs text-brand-600 font-semibold press"
              >
                <Plus className="w-3 h-3" /> Add stop
              </button>
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
            {destinations.length < MAX_DESTINATIONS ? (
              <button
                onClick={() => setAddDestSheet(true)}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-dashed border-brand-300 text-brand-500 text-xs font-semibold press"
              >
                <Plus className="w-3 h-3" />
              </button>
            ) : (
              <span className="shrink-0 text-[10px] text-ink-400 italic self-center px-1">
                Six is plenty
              </span>
            )}
          </div>
        </div>
      )}

      {/* Search — expands from header icon, collapsed by default */}
      <AnimatePresence>
        {search !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-5 mt-3 overflow-hidden"
          >
            <div className="bg-ink-50 rounded-2xl px-4 py-3 flex items-center gap-3">
              <Search className="w-5 h-5 text-ink-400 shrink-0" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search places, vibes, activities…"
                className="flex-1 bg-transparent outline-none text-sm text-ink-800 placeholder:text-ink-400"
                autoFocus
              />
              <button
                className={`relative press w-9 h-9 rounded-xl flex items-center justify-center shadow-soft transition-colors ${activeFilters > 0 ? 'bg-brand-500' : 'bg-white'}`}
                onClick={() => setFilterOpen(true)}
              >
                <SlidersHorizontal className={`w-4 h-4 ${activeFilters > 0 ? 'text-white' : 'text-ink-700'}`} />
                {activeFilters > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{activeFilters}</span>
                )}
              </button>
              <button onClick={() => setSearch('')} className="press text-ink-400"><X className="w-4 h-4" /></button>
            </div>
            <AnimatePresence>
              {search.trim() && searchResults.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="mt-2 bg-white rounded-2xl border border-ink-100 shadow-card px-4 py-5 text-center"
                >
                  <div className="text-2xl mb-1">🔍</div>
                  <div className="text-sm font-semibold text-ink-700">No places found</div>
                  <div className="text-xs text-ink-400 mt-0.5">Try a different name, category, or tag</div>
                </motion.div>
              )}
              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="mt-2 bg-white rounded-2xl border border-ink-100 shadow-card overflow-hidden"
                >
                  {searchResults.slice(0, 5).map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => { setSearch(''); setDetailPlace(p); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 press hover:bg-ink-50 text-left ${i > 0 ? 'border-t border-ink-50' : ''}`}
                    >
                      <img src={p.image} alt={p.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-ink-900 text-sm truncate">{p.name}</div>
                        <div className="text-xs text-ink-500">{p.category} · ⭐ {p.rating}</div>
                      </div>
                      <div className="text-xs font-semibold text-brand-600 shrink-0">{formatCost(p.cost, activeTrip.currency)}</div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DYNAMIC PLAN SECTION ── */}
      <div className="px-5 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-widest text-ink-500">MY PLAN{todayStops.length > 0 ? ` · ${todayStops.length} STOPS` : ''}</span>
            <button
              onClick={() => setVibeSheet(true)}
              className="flex items-center gap-1 bg-brand-50 text-brand-600 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-brand-100 press"
            >
              {VIBES.find((v) => v.id === vibe)?.icon} {VIBES.find((v) => v.id === vibe)?.label} ✏️
            </button>
          </div>
        </div>

        {/* ── CASE A: Has today's plan ── */}
        {hasTodayPlan && (
          <div>
            {/* UI1 — Day header */}
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-bold text-brand-600">DAY {dayHeaderInfo.dayNum}</span>
              <span className="text-xs text-ink-500">—</span>
              <span className="text-xs text-ink-600">{dayHeaderInfo.dateStr}</span>
              <span className="text-xs text-ink-400">·</span>
              <span className="text-xs font-semibold text-ink-700">{dayHeaderInfo.cityName}</span>
            </div>

            {/* Active nav indicator */}
            {isNavigating && (
              <motion.button
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => nav('/navigate')}
                className="w-full mb-3 flex items-center gap-3 bg-brand-500 rounded-2xl px-4 py-3 shadow-glow press"
              >
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Navigation className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-white font-bold text-sm">Navigation active</div>
                  <div className="text-white/80 text-xs">Tap to return to your route</div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/70" />
              </motion.button>
            )}

            {/* Preview — first 2 stops only */}
            <div className="relative">
              <div className="absolute left-2.5 top-0 bottom-0 w-px bg-ink-200" />
              <div className="space-y-3">
                {previewStops.map((p, i) => {
                  const startMin = 10 * 60 + 30 + i * 150;
                  const h = Math.floor(startMin / 60) % 24;
                  const m = startMin % 60;
                  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      className="relative pl-7"
                    >
                      <span className="absolute left-0.5 top-4 w-4 h-4 rounded-full bg-brand-500 ring-4 ring-brand-100 flex items-center justify-center z-10">
                        <span className="text-[8px] text-white font-bold">{i + 1}</span>
                      </span>
                      <div className="text-xs font-semibold text-ink-600 mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {timeStr}
                        {i > 0 && <span className="text-ink-400 font-normal ml-1">· {p.distanceKm} km from prev</span>}
                      </div>
                      <button
                        onClick={() => setDetailPlace(p)}
                        className="w-full bg-white rounded-2xl border border-ink-100 p-2.5 flex items-center gap-3 press text-left hover:border-brand-200 transition-colors"
                      >
                        <img src={p.image} alt={p.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-ink-900 truncate">{p.name}</div>
                          <div className="text-xs text-ink-500 flex items-center gap-1.5 mt-0.5">
                            <span>{p.category}</span>
                            <span className="text-ink-300">·</span>
                            <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{p.rating}</span>
                          </div>
                          <div className="text-xs text-brand-600 font-semibold mt-0.5">
                            {formatCost(p.priceRange.min, activeTrip.currency)}{p.priceRange.max !== p.priceRange.min && ` – ${formatCost(p.priceRange.max, activeTrip.currency)}`}
                          </div>
                        </div>
                        <Bookmark
                          onClick={(e) => { e.stopPropagation(); isSaved(p.id) ? removeSavedPlace(p.id) : savePlace(p); }}
                          className={`w-4 h-4 shrink-0 transition-colors ${isSaved(p.id) ? 'fill-brand-500 text-brand-500' : 'text-ink-300'}`}
                        />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Footer: compact action links + View full plan */}
            <div className="mt-3">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => nav('/generate?edit=1')}
                  className="flex items-center gap-1 text-xs text-ink-400 font-semibold press hover:text-ink-700"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <span className="text-ink-200">·</span>
                <button
                  onClick={() => nav('/map')}
                  className="flex items-center gap-1 text-xs text-ink-400 font-semibold press hover:text-ink-700"
                >
                  <MapPin className="w-3 h-3" /> Map
                </button>
              </div>
              <button
                onClick={() => nav('/trips')}
                className="w-full h-10 rounded-2xl bg-brand-50 border border-brand-100 text-brand-600 font-semibold text-sm press flex items-center justify-center gap-1.5"
              >
                Open My Plan
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* UI7 — Plan tomorrow shortcut */}
            {destinations.length > 1 && activeDestIdx < destinations.length - 1 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center justify-between bg-brand-50 rounded-xl p-3"
              >
                <div className="text-sm">
                  <span className="text-ink-500">Tomorrow: </span>
                  <span className="font-semibold text-ink-900">{destinations[activeDestIdx + 1].name.split(',')[0]}</span>
                  <span className="text-ink-400 ml-1">— No plan yet</span>
                </div>
                <button
                  onClick={() => { setActiveDestIdx(activeDestIdx + 1); nav('/generate'); }}
                  className="flex items-center gap-1 text-xs font-bold text-brand-600 press"
                >
                  Plan Now <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}

          </div>
        )}

        {/* ── CASE B: No plan today — single bold CTA ── */}
        {!hasTodayPlan && (
          <motion.button
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setIntentVibe(vibe); setIntentBudget(budget); setIntentDest(activeDest?.name.split(',')[0] ?? ''); setIntentDate(''); setIntentEndDate(''); setIntentStartTime('09:00'); setIntentEndTimeSet(false); setIntentErrors({}); setShowFlightTimes(false); setShowSingleDayWarning(false); setShowOverlapWarning(null); setOverlapAcknowledged(false); setIntentPace(pace); setIntentSheet('ai'); }}
            className="w-full bg-brand-500 text-white rounded-2xl p-5 text-left press shadow-glow flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Wand2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white text-base font-display">Plan your trip ✨</div>
              <div className="text-xs text-white/80 mt-0.5">
                {activeDest ? `Tap to start a ${activeDest.name.split(',')[0]} itinerary` : 'Tap to start your first itinerary'}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/80 shrink-0" />
          </motion.button>
        )}

        {/* ── CASE C: Future destination preview ── */}
        {nextDest && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold tracking-widest text-ink-500">UP NEXT</span>
            </div>
            <div className="bg-brand-50 rounded-2xl p-4 border border-brand-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center shrink-0">
                <span className="text-2xl">✈️</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-ink-900">{nextDest.name.split(',')[0]}</div>
                <div className="text-xs text-ink-500 mt-0.5">
                  {nextDest.days} day{nextDest.days !== 1 ? 's' : ''} planned · {nextDest.currency}
                </div>
              </div>
              <button
                onClick={() => setActiveDestIdx(activeDestIdx + 1)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-brand-500 text-white text-xs font-semibold press shadow-glow shrink-0"
              >
                Plan <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── CASE D: Add destination CTA ── */}
        {!hasMultiDest && onboardingComplete && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-4"
          >
            <button
              onClick={() => setAddDestSheet(true)}
              className="w-full h-11 rounded-2xl border-2 border-dashed border-brand-200 text-brand-600 text-sm font-semibold press flex items-center justify-center gap-2 hover:border-brand-400 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add another destination
            </button>
          </motion.div>
        )}
      </div>

      {/* UI4 — Budget Pulse card */}
      {activeTrip.transactions.length > 0 && (
        <div className="px-5 mt-5">
          <motion.button
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            onClick={() => nav('/wallet')}
            className="w-full bg-white rounded-2xl p-4 shadow-card text-left press border border-ink-100"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">💰</span>
                <span className="font-bold text-ink-900 font-display text-sm">Budget Pulse</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${budgetPulseInfo.isOnTrack ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                {budgetPulseInfo.isOnTrack ? 'On track' : 'Over budget'}
              </span>
            </div>
            <div className="text-xs text-ink-600">
              Spent {formatCurrencyAmount(totalSpent, currency)} of {formatCurrencyAmount(tripBudget, currency)}
              {tripDaysRemaining > 0 && ` · ${tripDaysRemaining} day${tripDaysRemaining !== 1 ? 's' : ''} left`}
            </div>
            <div className="text-xs text-ink-500 mt-0.5">
              {formatCurrencyAmount(dailyAllowance, currency)}/day remaining
            </div>
            <div className="mt-2 h-1.5 bg-ink-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${budgetPulseInfo.isOnTrack ? 'bg-emerald-400' : 'bg-red-400'}`}
                style={{ width: `${Math.min(100, (totalSpent / tripBudget) * 100)}%` }}
              />
            </div>
          </motion.button>
        </div>
      )}

      {/* Issue 27: regenerate prompt when vibe/budget changed */}
      <AnimatePresence>
        {vibeChangedPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="mx-5 mt-3 flex items-center justify-between bg-brand-50 border border-brand-200 rounded-2xl px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-brand-500 shrink-0" />
              <span className="text-sm text-brand-800 font-medium">Preferences updated</span>
            </div>
            <button
              onClick={() => { setVibeChangedPrompt(false); nav('/generate'); }}
              className="flex items-center gap-1 text-xs text-brand-600 font-bold press"
            >
              Regenerate <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA — Generate options (only when a plan exists; the no-plan state has its own primary CTA above) */}
      {hasTodayPlan && (
        <div className="px-5 mt-5 space-y-3">
          {/* Primary: AI plan — recommended */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { setIntentVibe(vibe); setIntentBudget(budget); setIntentDest(activeDest?.name.split(',')[0] ?? ''); setIntentDate(''); setIntentEndDate(''); setIntentStartTime('09:00'); setIntentEndTimeSet(false); setIntentErrors({}); setShowFlightTimes(false); setShowSingleDayWarning(false); setShowOverlapWarning(null); setOverlapAcknowledged(false); setIntentPace(pace); setIntentSheet('ai'); }}
            className="relative w-full rounded-2xl p-4 text-left flex items-center gap-3 press bg-brand-500 shadow-glow"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <MascotIcon src="/icon-ai-generate.svg" fallback={<Wand2 className="w-5 h-5 text-white" />} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white text-sm font-display leading-tight">Add another with AI ✨</div>
              <div className="text-[11px] text-white/75 mt-0.5 leading-tight">Let Buddy plan it for you</div>
            </div>
            <span className="absolute top-2 right-2 text-[9px] font-bold text-brand-600 bg-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">Recommended</span>
            <ChevronRight className="w-4 h-4 text-white/80 shrink-0" />
          </motion.button>

          {/* Secondary: manual escape hatch */}
          <button
            onClick={() => { setIntentVibe(vibe); setIntentBudget(budget); setIntentDest(activeDest?.name.split(',')[0] ?? ''); setIntentDate(''); setIntentEndDate(''); setIntentStartTime('09:00'); setIntentEndTimeSet(false); setIntentErrors({}); setShowFlightTimes(false); setShowSingleDayWarning(false); setShowOverlapWarning(null); setOverlapAcknowledged(false); setIntentPace(pace); setIntentSheet('manual'); }}
            className="w-full text-center text-sm text-brand-600 font-semibold press flex items-center justify-center gap-1"
          >
            or build it stop by stop <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Short outing — trim existing plan to short window */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setQuickPlanSheet(true)}
            className="w-full rounded-2xl p-4 text-left flex items-center gap-3 press bg-ink-50 border border-ink-100 hover:border-brand-200 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 border border-ink-100">
              <Zap className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-ink-900 text-sm font-display leading-tight">Short outing</div>
              <div className="text-[11px] text-ink-500 mt-0.5 leading-tight">Trim today's plan to a 2h or 4h window</div>
            </div>
            <ChevronRight className="w-4 h-4 text-ink-400" />
          </motion.button>
        </div>
      )}

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
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
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

      {/* Social Media Parser */}
      <div className="px-5 mt-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-bold tracking-widest text-ink-500">IMPORT FROM SOCIAL</span>
        </div>
        <div className="bg-ink-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 bg-white rounded-xl px-2.5 py-1.5 text-xs font-semibold text-ink-700 border border-ink-100">
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.59a8.19 8.19 0 0 0 4.79 1.54V6.68a4.85 4.85 0 0 1-1.02.01z"/></svg>
              TikTok
            </div>
            <div className="flex items-center gap-1.5 bg-white rounded-xl px-2.5 py-1.5 text-xs font-semibold text-ink-700 border border-ink-100">
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              Instagram
            </div>
            <span className="text-xs text-ink-400">links supported</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-white rounded-xl px-3 py-2.5 flex items-center gap-2 border border-ink-100">
              <Link2 className="w-4 h-4 text-ink-400 shrink-0" />
              <input
                ref={socialInputRef}
                value={socialUrl}
                onChange={(e) => { setSocialUrl(e.target.value); setSocialResult(null); setSocialError(false); }}
                placeholder="Paste a TikTok or Instagram link…"
                className="flex-1 bg-transparent outline-none text-sm text-ink-800 placeholder:text-ink-400"
              />
              {socialUrl && <button onClick={() => { setSocialUrl(''); setSocialResult(null); }}><X className="w-3.5 h-3.5 text-ink-400" /></button>}
            </div>
            <button
              onClick={parseSocialLink}
              disabled={!socialUrl.trim() || socialParsing}
              className="shrink-0 h-10 px-4 rounded-xl bg-brand-500 disabled:bg-ink-300 text-white text-sm font-semibold press"
            >
              {socialParsing ? '…' : 'Parse'}
            </button>
          </div>
          {socialError && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Please paste a valid TikTok or Instagram link
            </motion.p>
          )}
          <AnimatePresence>
            {socialParsing && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 overflow-hidden">
                <div className="flex items-center gap-2 text-xs text-brand-600 font-semibold mb-2">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </motion.div>
                  Extracting place information…
                </div>
                <div className="h-2 rounded shimmer w-3/4" />
              </motion.div>
            )}
            {socialResult && !socialParsing && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 bg-white rounded-xl border border-ink-100 overflow-hidden">
                <div className="flex items-start gap-3 p-3">
                  <img src={socialResult.image} alt={socialResult.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded-full">From {socialResult.platform}</span>
                    <div className="font-semibold text-ink-900 text-sm truncate mt-1">{socialResult.name}</div>
                    <div className="text-xs text-ink-600 mt-0.5 line-clamp-2">{socialResult.desc}</div>
                    <div className="text-xs text-brand-600 font-semibold mt-1">{formatCost(socialResult.cost, activeTrip.currency)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                  <button
                    onClick={() => {
                      const place: Place = { id: `social-${Date.now()}`, city: '', name: socialResult!.name, category: 'Hidden Gem', tags: ['Social Import'], vibes: ['nature','cafe','activities','cultural'], image: socialResult!.image, cost: socialResult!.cost, priceRange: { min: socialResult!.cost, max: socialResult!.cost }, durationMin: 60, distanceKm: 1.0, lat: -8.5055, lng: 115.2620, rating: 4.5, description: socialResult!.desc, openingHours: 'All day', indoor: false, openHour: 0, closeHour: 24 };
                      addStop(place);
                      show(`${socialResult!.name} added to plan`, 'success');
                      setSocialResult(null);
                      setSocialUrl('');
                      nav('/map');
                    }}
                    className="h-9 rounded-xl bg-brand-500 text-white text-xs font-semibold press flex items-center justify-center gap-1 shadow-glow"
                  >
                    <MapPin className="w-3.5 h-3.5" /> Add to Plan
                  </button>
                  <button
                    onClick={() => {
                      const place: Place = { id: `social-${Date.now()}`, city: '', name: socialResult!.name, category: 'Hidden Gem', tags: ['Social Import'], vibes: ['nature','cafe','activities','cultural'], image: socialResult!.image, cost: socialResult!.cost, priceRange: { min: socialResult!.cost, max: socialResult!.cost }, durationMin: 60, distanceKm: 1.0, lat: -8.5055, lng: 115.2620, rating: 4.5, description: socialResult!.desc, openingHours: 'All day', indoor: false, openHour: 0, closeHour: 24 };
                      savePlace(place);
                      show(`${socialResult!.name} saved for later`, 'success');
                      setSocialResult(null);
                      setSocialUrl('');
                    }}
                    className="h-9 rounded-xl bg-ink-50 text-ink-800 text-xs font-semibold press flex items-center justify-center gap-1"
                  >
                    <Bookmark className="w-3.5 h-3.5" /> Save for Later
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Pre-Generation Intent Sheet ── */}
      <AnimatePresence>
        {intentSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIntentSheet(null)} className="absolute inset-0 z-40 bg-ink-900/40" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-10 flex flex-col"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3 shrink-0" />
              <div className="px-5 pt-3 pb-4 flex items-center justify-between shrink-0">
                <div>
                  <div className="font-bold text-ink-900 font-display text-base">
                    {intentSheet === 'ai' ? '✨ Plan with AI' : '🗺️ Build your plan'}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {intentSheet === 'ai' ? 'Tell us where & when — we handle the rest' : 'Pick a destination to get started'}
                  </div>
                </div>
                <button onClick={() => setIntentSheet(null)} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
              </div>

              <div className="px-5 pb-4 space-y-4">

                {/* Scope explainer — honest expectations up front (AI mode only) */}
                {intentSheet === 'ai' && (
                  <div>
                    <button
                      onClick={() => setScopeTipOpen((v) => !v)}
                      className="text-[11px] text-ink-500 leading-relaxed text-left press"
                    >
                      Plans 1–6 cities, up to 30 days. Pick a pace below.
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
                      value={intentDest}
                      onChange={(e) => { setIntentDest(e.target.value); if (e.target.value.trim()) setIntentErrors((p) => ({ ...p, dest: undefined })); }}
                      placeholder={destPlaceholder}
                      className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none"
                      autoFocus
                    />
                    {intentDest && <button onClick={() => setIntentDest('')}><X className="w-3.5 h-3.5 text-ink-400" /></button>}
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
                        className="mt-1.5 text-[11px] text-ink-500 leading-snug press text-left"
                      >
                        {COPY.destInput.cityHint(hint)}
                      </button>
                    );
                  })()}
                  {/* Popular cities — quiet single line of text-buttons */}
                  {!intentDest && (
                    <div className="mt-2 text-[11px] text-ink-400 leading-snug">
                      Popular:{' '}
                      {['Bali', 'Bangkok', 'Tokyo', 'Paris', 'Seoul', 'Lisbon'].map((city, i, arr) => (
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
                  <button
                    ref={endDateInputRef as never}
                    onClick={() => setIntentDateOpen((v) => !v)}
                    className={`w-full rounded-xl px-3 py-3 text-sm border flex items-center justify-between press ${intentErrors.date ? 'border-red-400 bg-red-50 text-red-700' : 'bg-ink-50 text-ink-700 border-ink-200'}`}
                  >
                    <span className="font-semibold">
                      {intentDate ? (() => {
                        const s = new Date(intentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                        const e = intentEndDate ? new Date(intentEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;
                        return e ? `${s} → ${e}` : s;
                      })() : 'Pick your dates'}
                    </span>
                    <span className="text-[11px] text-ink-400">{intentDateOpen ? 'Done' : 'Edit'}</span>
                  </button>
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
                            setShowSingleDayWarning(false);
                          } else {
                            const start = new Date(intentDate);
                            if (d > start) {
                              setIntentEndDate(iso);
                              setShowSingleDayWarning(false);
                              setIntentDateOpen(false);
                            } else {
                              setIntentDate(iso);
                              setIntentEndDate('');
                            }
                          }
                        }}
                      />
                      <div className="mt-1 text-[10px] text-ink-400 text-center">
                        {!intentDate ? 'Tap a day to set your start date.' : !intentEndDate ? 'Tap a later day to set your end (or leave for a single day).' : 'Tap a different day to start over.'}
                      </div>
                    </div>
                  )}

                  {/* Trip duration badge */}
                  {intentDate && intentEndDate && (() => {
                    const d = tripDurationDays(intentDate, intentEndDate);
                    return d > 1 ? (
                      <div className="mt-2">
                        <span className="inline-block bg-brand-50 text-brand-600 text-xs font-bold rounded-full px-3 py-1">✈️ {d}-day trip</span>
                      </div>
                    ) : null;
                  })()}

                  {/* Single-day warning for AI mode */}
                  {showSingleDayWarning && intentSheet === 'ai' && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      <div className="text-xs font-semibold text-amber-800 mb-1.5">No end date set — this will generate a 1-day plan.</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowSingleDayWarning(false); setTimeout(() => endDateInputRef.current?.focus(), 50); }}
                          className="flex-1 h-8 rounded-lg bg-amber-500 text-white text-xs font-bold press"
                        >
                          Set end date
                        </button>
                        <button
                          onClick={() => { setShowSingleDayWarning(false); proceedIntent(); }}
                          className="flex-1 h-8 rounded-lg bg-white border border-amber-300 text-amber-700 text-xs font-semibold press"
                        >
                          Continue anyway
                        </button>
                      </div>
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

                {/* Trip pace */}
                {intentSheet === 'ai' && (
                  <div>
                    <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-2">PACE</div>
                    <div className="flex gap-2">
                      {([
                        { id: 'relaxed', icon: '🌿', label: 'Relaxed', hint: '2 stops/day' },
                        { id: 'balanced', icon: '⚖️', label: 'Balanced', hint: '3 stops/day' },
                        { id: 'fast', icon: '⚡', label: 'Fast-paced', hint: '4 stops/day' },
                      ] as { id: TripPace; icon: string; label: string; hint: string }[]).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setIntentPace(p.id)}
                          className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-xs font-semibold press transition-colors ${intentPace === p.id ? 'bg-brand-50 border-2 border-brand-400 text-brand-700' : 'bg-ink-50 border border-ink-200 text-ink-600'}`}
                        >
                          <span className="text-base">{p.icon}</span>
                          <span>{p.label}</span>
                          <span className="text-[9px] text-ink-400 font-normal">{p.hint}</span>
                        </button>
                      ))}
                    </div>
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

                {/* Overlapping trip warning */}
                {showOverlapWarning && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <div className="text-xs font-semibold text-amber-800 mb-1.5">
                      These dates overlap with "{showOverlapWarning}". Plan anyway?
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowOverlapWarning(null); setTimeout(() => endDateInputRef.current?.focus(), 50); }}
                        className="flex-1 h-8 rounded-lg bg-amber-500 text-white text-xs font-bold press"
                      >
                        Pick different dates
                      </button>
                      <button
                        onClick={() => { setShowOverlapWarning(null); setOverlapAcknowledged(true); proceedIntent(); }}
                        className="flex-1 h-8 rounded-lg bg-white border border-amber-300 text-amber-700 text-xs font-semibold press"
                      >
                        Plan anyway
                      </button>
                    </div>
                  </div>
                )}

                {/* Current vibe/budget summary — not editable here, link to settings */}
                <div className="flex items-center gap-2 bg-ink-50 rounded-xl px-3 py-2.5">
                  <span className="text-base">{VIBES.find((v) => v.id === vibe)?.icon}</span>
                  <span className="text-xs text-ink-600 flex-1">
                    <span className="font-semibold">{VIBES.find((v) => v.id === vibe)?.label}</span> vibe · {formatCost(budget, activeTrip.currency)}/day
                  </span>
                  <button
                    onClick={() => { setIntentSheet(null); setVibeSheet(true); }}
                    className="text-xs text-brand-600 font-semibold press"
                  >
                    Change
                  </button>
                </div>

              </div>

              <div className="px-5 shrink-0">
                <button
                  onClick={handleIntentConfirm}
                  className="w-full h-14 rounded-2xl bg-brand-500 text-white font-bold text-base press shadow-glow flex items-center justify-center gap-2"
                >
                  {intentSheet === 'ai' ? <><Wand2 className="w-5 h-5" /> {COPY.ctas.intentSheetContinue}</> : <><Pencil className="w-5 h-5" /> Start planning</>}
                </button>
              </div>
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
        onFocusDestinations={() => setAddDestSheet(true)}
      />

      {/* ── Add Destination Sheet ── */}
      <AnimatePresence>
        {addDestSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAddDestSheet(false)} className="absolute inset-0 z-40 bg-ink-900/40" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-10 max-h-[90%] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3" />
              <div className="px-5 pt-3 pb-4 flex items-center justify-between">
                <div className="font-bold text-ink-900 font-display">Add Destination</div>
                <button onClick={() => setAddDestSheet(false)} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
              </div>
              <div className="px-5 space-y-4">
                {/* City name */}
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-1.5">DESTINATION</div>
                  <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border-2 transition-colors ${newDestError ? 'bg-red-50 border-red-400' : 'bg-ink-50 border-transparent focus-within:border-brand-400'}`}>
                    <MapPin className={`w-4 h-4 shrink-0 ${newDestError ? 'text-red-400' : 'text-ink-400'}`} />
                    <input
                      value={newDestName}
                      onChange={(e) => { setNewDestName(e.target.value); if (newDestError) setNewDestError(null); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddDest()}
                      placeholder="City or country (e.g. Rome, Italy)"
                      className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none"
                      autoFocus
                    />
                  </div>
                  {newDestError && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {newDestError}
                    </div>
                  )}
                </div>

                {/* Date range */}
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-1.5">DATES</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] text-ink-400 mb-1">📅 Arrive</div>
                      <input
                        type="date"
                        value={newDestArriveDate}
                        onChange={(e) => setNewDestArriveDate(e.target.value)}
                        className="w-full bg-ink-50 rounded-xl px-3 py-2.5 text-sm text-ink-900 border border-ink-200 outline-none focus:border-brand-400"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-ink-400 mb-1">📅 Depart</div>
                      <input
                        type="date"
                        value={newDestDepartDate}
                        onChange={(e) => setNewDestDepartDate(e.target.value)}
                        className="w-full bg-ink-50 rounded-xl px-3 py-2.5 text-sm text-ink-900 border border-ink-200 outline-none focus:border-brand-400"
                      />
                    </div>
                  </div>
                  {calcedDays !== null ? (
                    <div className="mt-2 text-xs text-brand-600 font-semibold">{calcedDays} day{calcedDays !== 1 ? 's' : ''} calculated from dates</div>
                  ) : (
                    <div className="mt-2">
                      <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-1.5">DAYS PLANNED</div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setNewDestDays((d) => Math.max(1, d - 1))} className="w-10 h-10 rounded-full bg-ink-50 border border-ink-200 flex items-center justify-center press font-bold text-ink-700 text-lg">−</button>
                        <div className="flex-1 text-center text-2xl font-extrabold text-ink-900 font-display">{newDestDays}</div>
                        <button onClick={() => setNewDestDays((d) => d + 1)} className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center press font-bold text-white text-lg">+</button>
                      </div>
                      <div className="text-center text-xs text-ink-500 mt-1">day{newDestDays !== 1 ? 's' : ''}</div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleAddDest}
                  disabled={!newDestName.trim()}
                  className="w-full h-12 rounded-2xl bg-brand-500 disabled:bg-ink-200 text-white font-bold press shadow-glow flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add to Trip
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Quick Plan Sheet ── */}
      <AnimatePresence>
        {quickPlanSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQuickPlanSheet(false)} className="absolute inset-0 z-40 bg-ink-900/40" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-10"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3" />
              <div className="px-5 pt-3 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <div className="font-bold text-ink-900 font-display">Quick Plan</div>
                </div>
                <button onClick={() => setQuickPlanSheet(false)} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
              </div>
              <div className="px-5 space-y-4">
                <div className="text-sm text-ink-600">How long do you have?</div>
                <div className="flex gap-2">
                  {QUICK_PLAN_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setQuickPlanHours(opt.hours)}
                      className={`flex-1 py-3 rounded-xl font-semibold text-sm press transition-colors ${quickPlanHours === opt.hours ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-ink-500 bg-ink-50 rounded-xl p-3">
                  <span className="font-semibold text-ink-700">{Math.round((quickPlanHours * 60) / 90)} stop{Math.round((quickPlanHours * 60) / 90) !== 1 ? 's' : ''}</span> from your current vibe + budget itinerary
                </div>
                <button
                  onClick={handleQuickPlan}
                  className="w-full h-12 rounded-2xl bg-amber-500 text-white font-bold press shadow-glow flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" /> Generate & Go
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
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-10"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3" />
              <div className="px-5 pt-3 pb-4 flex items-center justify-between">
                <div className="font-bold text-ink-900 font-display">Vibe & Budget</div>
                <button onClick={() => setVibeSheet(false)} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
              </div>
              <div className="px-5 space-y-5">
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
                          <span className="text-2xl leading-none">{v.icon}</span>
                          <span className={`text-[9px] font-semibold leading-tight text-center ${active ? 'text-brand-600' : 'text-ink-700'}`}>{v.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-2">BUDGET <span className="font-normal normal-case tracking-normal text-ink-400">(per day)</span></div>
                  <input
                    type="range" min={50_000} max={1_000_000} step={10_000}
                    value={budget} onChange={(e) => { setBudget(Number(e.target.value)); if (itinerary.length > 0) setVibeChangedPrompt(true); }}
                    className="vibe-slider mb-1"
                    style={{ ['--val' as string]: `${sliderPct}%` } as React.CSSProperties}
                  />
                  <div className="flex justify-between text-xs text-ink-500">
                    <span>{formatCost(50_000, activeTrip.currency)}</span>
                    <span className="text-brand-600 font-semibold">{formatCost(budget, activeTrip.currency)}</span>
                    <span>{formatCost(1_000_000, activeTrip.currency)}+</span>
                  </div>
                </div>
                <button
                  onClick={() => { setVibeSheet(false); nav('/generate'); }}
                  className="w-full h-12 rounded-2xl bg-brand-500 text-white font-bold press shadow-glow flex items-center justify-center gap-2"
                >
                  <Wand2 className="w-4 h-4" /> Regenerate Plan
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Place Detail Sheet ── */}
      <AnimatePresence>
        {detailPlace && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetailPlace(null)} className="absolute inset-0 z-40 bg-ink-900/30" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card overflow-y-auto max-h-[78%]"
            >
              <div className="relative h-40 shrink-0">
                <img src={detailPlace.image} alt={detailPlace.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <button onClick={() => setDetailPlace(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center press">
                  <X className="w-4 h-4 text-white" />
                </button>
                <div className="absolute bottom-3 left-4 right-4">
                  <div className="font-bold text-white text-lg font-display leading-tight">{detailPlace.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white/80 text-xs">{detailPlace.category}</span>
                    <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs text-white">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {detailPlace.rating}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <InfoChip icon={<Clock className="w-3.5 h-3.5 text-brand-500" />} label="Hours" value={detailPlace.openingHours} />
                  <InfoChip
                    icon={<DollarSign className="w-3.5 h-3.5 text-emerald-500" />}
                    label="Price"
                    value={detailPlace.priceRange.min === detailPlace.priceRange.max
                      ? formatCost(detailPlace.priceRange.min, activeTrip.currency)
                      : `${formatCost(detailPlace.priceRange.min, activeTrip.currency)}+`}
                  />
                  <InfoChip icon={<MapPin className="w-3.5 h-3.5 text-orange-500" />} label="Distance" value={`${detailPlace.distanceKm} km`} />
                </div>
                <p className="text-sm text-ink-600 mb-3 leading-relaxed">{detailPlace.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {detailPlace.tags.map((tag) => (
                    <span key={tag} className="px-2.5 py-1 rounded-full bg-ink-50 text-ink-600 text-xs font-medium">{tag}</span>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { isSaved(detailPlace.id) ? removeSavedPlace(detailPlace.id) : savePlace(detailPlace); show(isSaved(detailPlace.id) ? 'Removed from saved' : 'Saved ✓', 'success'); }}
                    className={`h-11 rounded-2xl font-semibold press inline-flex items-center justify-center gap-2 ${isSaved(detailPlace.id) ? 'bg-brand-50 text-brand-600 border border-brand-200' : 'bg-ink-50 text-ink-800'}`}
                  >
                    <Bookmark className={`w-4 h-4 ${isSaved(detailPlace.id) ? 'fill-brand-500 text-brand-500' : ''}`} />
                    {isSaved(detailPlace.id) ? 'Saved' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setDetailPlace(null); nav('/map'); }}
                    className="h-11 rounded-2xl bg-brand-500 text-white font-semibold shadow-glow press inline-flex items-center justify-center gap-2"
                  >
                    <ChevronRight className="w-4 h-4" /> View on Map
                  </button>
                </div>
              </div>
            </motion.div>
          </>
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
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-10 max-h-[80%] flex flex-col"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3 shrink-0" />
              <div className="px-5 pt-3 pb-4 flex items-center justify-between shrink-0">
                <div className="font-bold text-ink-900 font-display flex items-center gap-2"><Compass className="w-4 h-4 text-orange-500" /> Explore Nearby</div>
                <button onClick={() => setExploreSheet(false)} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
              </div>
              <div className="overflow-y-auto no-scrollbar px-5 pb-4 space-y-2">
                {PLACES.slice(0, 10).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 bg-white border border-ink-100 rounded-2xl p-2.5">
                    <img src={p.image} alt={p.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
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
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-10"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3" />
              <div className="px-5 pt-3 pb-4 flex items-center justify-between">
                <div className="font-bold text-ink-900 font-display">Manage Destinations</div>
                <button onClick={() => setManageDestsSheet(false)} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
              </div>
              <div className="px-5 space-y-2 pb-4">
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
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-8"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3" />
              <div className="px-5 pt-3 pb-4 flex items-center justify-between">
                <div className="font-bold text-ink-900 font-display">Filter Places</div>
                <button onClick={() => setFilterOpen(false)} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
              </div>
              <div className="px-5 space-y-5">
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
    </div>
  );
}



/* Renders your custom mascot SVG, falls back to the given element if file isn't added yet */
function MascotIcon({ src, fallback }: { src: string; fallback: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return <img src={src} alt="" className="w-5 h-5 object-contain" onError={() => setFailed(true)} />;
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-ink-50 rounded-xl p-2.5">
      <div className="flex items-center gap-1 mb-1">{icon}<span className="text-[10px] text-ink-500 font-medium">{label}</span></div>
      <div className="text-xs font-bold text-ink-900 leading-snug">{value}</div>
    </div>
  );
}

