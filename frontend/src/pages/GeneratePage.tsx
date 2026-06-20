import { AnimatePresence, motion, Reorder, useMotionValue, useTransform, animate, useDragControls } from 'framer-motion';
import {
  ArrowLeft, ArrowDown, Check, Plus, RefreshCw, X,
  Clock, Star, Pencil, Search, Wallet, Bookmark,
  Plane, Train, Sun, Compass, Trash2, Lightbulb, Car, AlertTriangle,
  GripVertical, Hand,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import { useApp, PACE_STOPS, getPlaceImage } from '../context/AppContext';
import type { Place } from '../data/places';
import { PLACES } from '../data/places';
import { getRegion, countDistinctRegions } from '../data/regions';
import { MAX_TRIP_DAYS, exceedsMaxDuration } from '../lib/planValidation';
import { COPY } from '../lib/copy';
import { dayIsTight } from '../lib/density';
import { formatCost } from '../lib/format';
import { suggestCurrency, type Currency, CURRENCY_RATES_TO_IDR } from '../data/wallet';
import { useToast } from '../components/Toast';
import TimePicker from '../components/TimePicker';
import { apiRegister, apiLogin } from '../lib/api';
import { tripDurationDays, todayISO } from '../lib/dateUtils';


function formatDateRange(startISO: string, days: number): string {
  const start = new Date(startISO);
  const end = new Date(start.getTime() + (days - 1) * 86400000);
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function getEndDateISO(startISO: string, days: number): string {
  const start = new Date(startISO);
  const end = new Date(start.getTime() + (days - 1) * 86400000);
  return end.toISOString().split('T')[0];
}

const STEPS_DEFAULT = [
  'Scouting hidden gems…',
  'Matching spots to your vibe…',
  'Checking opening hours…',
  'Balancing your pace…',
  'Crafting your perfect journey…',
];

const STEPS_MULTI_CITY = [
  'Scouting hidden gems…',
  'Matching spots to your vibe…',
  'Spacing travel days…',
  'Clustering destinations by region…',
  'Crafting your perfect journey…',
];

// VIBE_LABELS removed in Round 11 — header now uses unified COPY.sections.reviewHeader.

export default function GeneratePage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const isManualMode = searchParams.get('mode') === 'manual';
  const startTimeParam = searchParams.get('startTime'); // e.g. "09:00"
  const endTimeParam = searchParams.get('endTime'); // e.g. "14:00"
  const daysParam = Math.max(1, parseInt(searchParams.get('days') ?? '1') || 1);
  // city from URL is the authoritative source — immune to React state timing.
  // buildFullItinerary reads destinations[0]?.name from context but that setState
  // may not have settled yet if user just cancelled a different city's trip.
  const cityParam = searchParams.get('city') ?? '';

  const { vibe, buildItinerary, buildFullItinerary, loadingPlan, setItinerary, itinerary, perDayItineraries, setPerDayItineraries, perDayMeta, removeStop, replaceStop, addStop, reorderStop, alternatives, activeTrip, journeyStart, setJourneyStart, pace, setPace, destinations, setDestinations, authUser, isAuthenticated, signIn, createTrip, setActiveTripId, setTripName, trips, budget, setAccessToken } = useApp();
  const paceParam = searchParams.get('pace');
  const { show } = useToast();

  // Fix #3: derive currency directly from current destination — don't trust activeTrip.currency
  // which might be the DEFAULT_TRIP stale value.
  const effectiveCurrency: Currency = destinations[0]
  ? suggestCurrency(destinations[0].name)
  : activeTrip.currency;

  const isEditMode = searchParams.get('edit') === '1';
  const isPostOnboarding = searchParams.get('after') === 'onboarding';
  const [phase, setPhase] = useState<'loading' | 'reveal'>((isManualMode || isEditMode) ? 'reveal' : 'loading');
  const [stepIdx, setStepIdx] = useState(0);
  // Issue 8: AI generation error state
  const [generationError, setGenerationError] = useState(false);
  const [replaceFor, setReplaceFor] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  // UI5 — what-if comparison: { currentPlace, alt }
  const [whatIf, setWhatIf] = useState<{ current: Place; alt: Place } | null>(null);
  const [signupSheetOpen, setSignupSheetOpen] = useState(false);
  // Density-aware "Add" prompt — opens a small decision sheet when the picked
  // recommendation would make the active day tight (5+ stops, 30+ km, 10+ h).
  const [tightAdd, setTightAdd] = useState<{ place: Place; reason: string } | null>(null);
  const [confirmingPulse, setConfirmingPulse] = useState(false);
  const [stopTimes, setStopTimes] = useState<Record<string, string>>({});
  const [editingTimeFor, setEditingTimeFor] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [dragHintDismissed, setDragHintDismissed] = useState(() => {
    try { return localStorage.getItem('pavey_hint_drag_dismissed') === '1'; } catch { return false; }
  });
  const dismissDragHint = () => {
    setDragHintDismissed(true);
    try { localStorage.setItem('pavey_hint_drag_dismissed', '1'); } catch { /* ignore */ }
  };

  // Undo support for stop removal
  const [undoItem, setUndoItem] = useState<{ place: Place; index: number } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Density banner (soft warning when a day looks overloaded)
  const [densityDismissed, setDensityDismissed] = useState(() => {
    try { return localStorage.getItem('pavey_density_hint_dismissed') === '1'; } catch { return false; }
  });

  // Read-only vs edit affordances. Defaults to read-only on a fresh generation
  // so the user sees the plan first. Switches on when ?edit=1 or via the
  // header toggle. Manual mode is always editable.
  const [editAffordances, setEditAffordances] = useState(true);
  const [editTripDetailsOpen, setEditTripDetailsOpen] = useState(false);
  const [editTripName, setEditTripName] = useState('');
  const [editTripStartDate, setEditTripStartDate] = useState('');
  const [editTripEndDate, setEditTripEndDate] = useState('');
  // Track which stops/days the user has edited so re-roll can warn before
  // wiping work in progress.
  const [userEdited, setUserEdited] = useState(false);
  const [rerollConfirmOpen, setRerollConfirmOpen] = useState(false);
  const [walletPromptOpen, setWalletPromptOpen] = useState(false);
  const walletPromptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [successOverlay, setSuccessOverlay] = useState(false);

  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [confirmStartTripOpen, setConfirmStartTripOpen] = useState(false);
  const [confirmSaveEditsOpen, setConfirmSaveEditsOpen] = useState(false);
  const [hasConfirmedTrip, setHasConfirmedTrip] = useState(false);
  const hasConfirmedTripRef = useRef(false);

  useEffect(() => {
    hasConfirmedTripRef.current = hasConfirmedTrip;
  }, [hasConfirmedTrip]);

  useEffect(() => {
    if (isEditMode || hasConfirmedTrip) return;

    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      if (!hasConfirmedTripRef.current) {
        setExitModalOpen(true);
        window.history.pushState(null, '', window.location.href);
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasConfirmedTripRef.current) {
        e.preventDefault();
        e.returnValue = 'Your trip has not been created yet.';
        return 'Your trip has not been created yet.';
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasConfirmedTrip, isEditMode]);

  const handleConfirmExit = () => {
    setExitModalOpen(false);
    hasConfirmedTripRef.current = true;
    setHasConfirmedTrip(true);
    // Clear stale state — if the user cancels a half-generated trip, we don't want
    // the previous city's destinations/itinerary to bleed into the next generation.
    setDestinations([]);
    setItinerary([]);
    setPerDayItineraries([]);
    nav('/', { replace: true });
  };

  const handleWalletConfirm = () => {
    if (walletPromptTimer.current) clearTimeout(walletPromptTimer.current);
    setWalletPromptOpen(false);
    
    if (activeTrip.id === 'default-trip') {
      const tripName = destinations.length === 1
        ? `${destinations[0].name} Trip`
        : destinations.length > 0
          ? `${destinations[0].name} + ${destinations.length - 1} more`
          : 'New Trip';
      const tripDest = destinations.map((d) => d.name).join(' → ') || 'Custom Destination';
      const tripCurrency = effectiveCurrency;
      const tripDays = journeyStart.days || daysParam || 1;
      const rate = CURRENCY_RATES_TO_IDR[tripCurrency] || 1;
      const localBudget = Math.round((budget * Math.max(1, tripDays)) / rate);
      
      const newTripId = createTrip({
        name: tripName,
        destination: tripDest,
        currency: tripCurrency,
        budget: localBudget,
        daysTotal: tripDays,
        daysRemaining: tripDays,
      });
      // Auto-set as active if no real trip is active yet
      const hasActiveTrip = trips.some((t) => t.id !== 'default-trip');
      if (!hasActiveTrip) {
        setActiveTripId(newTripId);
      }
    }
    // Navigate to wallet to create/link it
    nav('/wallet', { replace: true });
  };

  const handleWalletLater = () => {
    if (walletPromptTimer.current) clearTimeout(walletPromptTimer.current);
    setWalletPromptOpen(false);
    // Stay on map page — no redirect
  };

  const dismissDensity = () => {
    setDensityDismissed(true);
    try { localStorage.setItem('pavey_density_hint_dismissed', '1'); } catch { /* ignore */ }
  };

  // Swipe Review Deck state
  const [showReviewDeck, setShowReviewDeck] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<Place[]>([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [swipeHistory, setSwipeHistory] = useState<{
    place: Place;
    action: 'keep' | 'discard';
    dayIndex: number;
    index: number;
    replacedWith?: Place;
  }[]>([]);



  // Drag state for Tinder-style review deck (useMotionValue to prevent parent re-renders)
  const deckDragX = useMotionValue(0);

  // Left/Right cue circle animations
  // Swipe LEFT = Keep, Swipe RIGHT = Discard (as user described)
  const leftCueOpacity = useTransform(deckDragX, [-100, -20, 30], [1, 0.15, 0]);
  const leftCueScale = useTransform(deckDragX, [-100, 0, 100], [1.2, 0.95, 0.8]);
  const rightCueOpacity = useTransform(deckDragX, [-30, 20, 100], [0, 0.15, 1]);
  const rightCueScale = useTransform(deckDragX, [-100, 0, 100], [0.8, 0.95, 1.2]);

  const getPlaceDayNumber = (placeId: string) => {
    if (!isMultiDay) return 1;
    const dayIdx = perDayItineraries.findIndex((day) => day.some((p) => p.id === placeId));
    return dayIdx !== -1 ? dayIdx + 1 : 1;
  };

  const discardStopFromItinerary = (place: Place) => {
    const targetCity = destinations[0]?.name || activeTrip?.destination || '';
    
    const isSameCity = (placeCity: string, targetCityName: string) => {
      const pCity = placeCity.toLowerCase();
      const tCity = targetCityName.toLowerCase();
      if (tCity.includes(pCity) || pCity.includes(tCity)) return true;
      if (tCity.includes('bali') && ['ubud', 'seminyak', 'canggu', 'nusa-dua', 'nusa dua'].includes(pCity)) return true;
      return false;
    };

    // Find alternative
    const currentItinIds = new Set(itinerary.map((p) => p.id));
    
    // Step 1: same category & city, not in itinerary, highest rating
    let alt = PLACES.filter((p) => 
      isSameCity(p.city, targetCity) &&
      p.category === place.category &&
      !currentItinIds.has(p.id)
    ).sort((a, b) => b.rating - a.rating)[0];

    // Step 2: same city, any category, not in itinerary, highest rating
    if (!alt) {
      alt = PLACES.filter((p) => 
        isSameCity(p.city, targetCity) &&
        !currentItinIds.has(p.id)
      ).sort((a, b) => b.rating - a.rating)[0];
    }

    if (!alt) {
      // Generate fallback alternative stop
      const cityClean = targetCity.split(',')[0].trim();
      const cat = place.category || 'Scenic';
      
      let mockName = `Local Discovery in ${cityClean}`;
      let mockDesc = `A wonderful spot to explore in ${cityClean}, offering authentic local charm and highly recommended by fellow travelers.`;
      let typeKey = 'attraction';

      if (cat === 'Cafe' || cat === 'Cozy' || cat === 'Foodie') {
        const cafeNames = ['Secret Garden Cafe', 'Boutique Coffee House', 'Corner Roastery', 'Local Flavors Bistro', 'The Cozy Nook'];
        const index = Math.abs(place.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % cafeNames.length;
        mockName = `${cafeNames[index]} ${cityClean}`;
        mockDesc = `A delightful culinary experience in the heart of ${cityClean}. Known for its great atmosphere and delicious menu.`;
        typeKey = 'restaurant';
      } else if (cat === 'Nature' || cat === 'Scenic') {
        const natureNames = ['Greenery Ridge', 'Scenic Lookout Point', 'Botanical Haven', 'Peaceful Valley Walk', 'Panoramic Vista Spot'];
        const index = Math.abs(place.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % natureNames.length;
        mockName = `${cityClean} ${natureNames[index]}`;
        mockDesc = `A beautiful natural landmark in ${cityClean}. Perfect for scenic photography, fresh air, and relaxing views.`;
      } else {
        const culturalNames = ['Heritage Museum House', 'Historic Landmark Temple', 'Artisanal Village Craft Market', 'Old Town Memorial Square', 'Cultural Discovery Pavilion'];
        const index = Math.abs(place.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % culturalNames.length;
        mockName = `${cityClean} ${culturalNames[index]}`;
        mockDesc = `Rich historical and cultural site in ${cityClean}. Explore the unique heritage, local architecture, and storied past of the area.`;
      }

      const offsetLat = (Math.sin(place.id.charCodeAt(0)) * 0.015);
      const offsetLng = (Math.cos(place.id.charCodeAt(place.id.length - 1 || 0)) * 0.015);

      const mockImage = getPlaceImage(cityClean, typeKey, mockName);

      alt = {
        id: `mock-alt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        city: cityClean,
        name: mockName,
        category: cat,
        tags: [...(place.tags || []), 'Alternative'],
        vibes: place.vibes || ['balanced'],
        image: mockImage,
        cost: place.cost || 0,
        priceRange: place.priceRange || { min: 0, max: 0 },
        durationMin: place.durationMin || 90,
        distanceKm: Math.max(0.5, parseFloat((Math.random() * 2 + 0.5).toFixed(2))),
        lat: place.lat ? place.lat + offsetLat : -8.5069 + offsetLat,
        lng: place.lng ? place.lng + offsetLng : 115.2625 + offsetLng,
        rating: parseFloat((4.0 + Math.random() * 0.9).toFixed(1)),
        description: mockDesc,
        openingHours: place.openingHours || '09:00 - 18:00',
        indoor: place.indoor ?? false,
        openHour: place.openHour ?? 9,
        closeHour: place.closeHour ?? 18,
      };
    }

    if (isMultiDay) {
      let targetDayIdx = -1;
      let targetPlaceIdx = -1;
      for (let d = 0; d < perDayItineraries.length; d++) {
        const pIdx = perDayItineraries[d].findIndex((p) => p.id === place.id);
        if (pIdx !== -1) {
          targetDayIdx = d;
          targetPlaceIdx = pIdx;
          break;
        }
      }
      if (targetDayIdx !== -1) {
        const newDays = perDayItineraries.map((day, d) => {
          if (d !== targetDayIdx) return day;
          if (alt) {
            return day.map((p) => p.id === place.id ? alt : p);
          } else {
            return day.filter((p) => p.id !== place.id);
          }
        });
        setPerDayItineraries(newDays);
        setItinerary(newDays.flat());
        if (alt) {
          show(`Replaced ${place.name} with ${alt.name}`, 'success');
        } else {
          show('No alternatives available, stop removed', 'info');
        }
        return { dayIndex: targetDayIdx, index: targetPlaceIdx, replacedWith: alt };
      }
    } else {
      const targetPlaceIdx = itinerary.findIndex((p) => p.id === place.id);
      if (targetPlaceIdx !== -1) {
        if (alt) {
          const next = itinerary.map((p) => p.id === place.id ? alt : p);
          setItinerary(next);
          show(`Replaced ${place.name} with ${alt.name}`, 'success');
        } else {
          removeStop(place.id);
          show('No alternatives available, stop removed', 'info');
        }
        return { dayIndex: 0, index: targetPlaceIdx, replacedWith: alt };
      }
    }
    return null;
  };

  const restoreStopToItinerary = (place: Place, dayIndex: number, index: number, replacedWith?: Place) => {
    if (isMultiDay) {
      const newDays = perDayItineraries.map((day, d) => {
        if (d !== dayIndex) return day;
        const next = day.slice();
        if (replacedWith) {
          return next.map((p) => p.id === replacedWith.id ? place : p);
        } else {
          next.splice(Math.min(index, next.length), 0, place);
          return next;
        }
      });
      setPerDayItineraries(newDays);
      setItinerary(newDays.flat());
    } else {
      if (replacedWith) {
        const next = itinerary.map((p) => p.id === replacedWith.id ? place : p);
        setItinerary(next);
      } else {
        const next = itinerary.slice();
        next.splice(Math.min(index, next.length), 0, place);
        setItinerary(next);
      }
    }
  };

  const completeReview = () => {
    setShowReviewDeck(false);
    show('Review complete! All choices saved.', 'success');
  };

  const handleSwipe = (action: 'keep' | 'discard', place: Place) => {
    let historyEntry: any = { place, action, dayIndex: 0, index: 0 };
    
    if (action === 'discard') {
      const removedInfo = discardStopFromItinerary(place);
      if (removedInfo) {
        historyEntry = { ...historyEntry, ...removedInfo };
      }
    }
    
    setSwipeHistory((prev) => [...prev, historyEntry]);
    
    setDeckIndex((prev) => {
      const next = prev + 1;
      if (next >= reviewQueue.length) {
        setTimeout(() => {
          completeReview();
        }, 300);
      }
      return next;
    });
  };

  const handleButtonSwipe = (action: 'keep' | 'discard') => {
    if (deckIndex >= reviewQueue.length) return;
    const place = reviewQueue[deckIndex];
    handleSwipe(action, place);
  };

  const handleSwipeUndo = () => {
    if (swipeHistory.length === 0) return;
    const lastAction = swipeHistory[swipeHistory.length - 1];
    setSwipeHistory((prev) => prev.slice(0, -1));
    
    if (lastAction.action === 'discard') {
      restoreStopToItinerary(lastAction.place, lastAction.dayIndex, lastAction.index, lastAction.replacedWith);
      show(`Restored ${lastAction.place.name}`, 'success');
    }
    
    setDeckIndex((prev) => Math.max(0, prev - 1));
  };

  const removeWithUndo = (place: Place, idx: number, isManual: boolean) => {
    setUserEdited(true);
    if (isManual) {
      setManualStops((prev) => prev.filter((s) => s.id !== place.id));
    } else if (isMultiDay) {
      const newDays = perDayItineraries.map((day, d) =>
        d === activeDay ? day.filter((p) => p.id !== place.id) : day
      );
      setPerDayItineraries(newDays);
      setItinerary(newDays.flat());
    } else {
      removeStop(place.id);
    }
    setUndoItem({ place, index: idx });
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoItem(null), 6000);
  };

  const reorderDayStop = (from: number, to: number) => {
    setUserEdited(true);
    if (isMultiDay) {
      const newDays = perDayItineraries.map((day, d) => {
        if (d !== activeDay) return day;
        const next = day.slice();
        const [item] = next.splice(from, 1);
        next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
        return next;
      });
      setPerDayItineraries(newDays);
    } else {
      reorderStop(from, to);
    }
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
    } else if (isMultiDay) {
      const newDays = perDayItineraries.map((day, d) => {
        if (d !== activeDay) return day;
        const next = day.slice();
        next.splice(Math.min(restored.index, next.length), 0, restored.place);
        return next;
      });
      setPerDayItineraries(newDays);
      setItinerary(newDays.flat());
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
    // URL safety net — HomePage is the primary defense against >30-day trips.
    if (exceedsMaxDuration(daysParam)) {
      show(COPY.tripTooLong.urlToast(MAX_TRIP_DAYS), 'info');
      nav('/', { replace: true });
      return;
    }
    // Apply pace from URL param if it differs from current state
    if (paceParam === 'relaxed' || paceParam === 'balanced' || paceParam === 'fast') {
      if (pace !== paceParam) setPace(paceParam);
    }
    if (!isManualMode && !isEditMode) {
      // Always use AI (buildFullItinerary) regardless of trip duration.
      // cityParam from URL is used as override so we don't accidentally use
      // a stale destinations[0] from the previously generated (cancelled) trip.
      const days = Math.max(1, daysParam > 1 ? daysParam : journeyStart.days);
      buildFullItinerary(days, startTimeParam ?? journeyStart.time, endTimeParam ?? journeyStart.endTime ?? '14:00', false, cityParam || undefined)
        .catch(() => setGenerationError(true));
    }
  }, []); // eslint-disable-line

  const loadingSteps = useMemo(() => {
    const destNames = destinations.map((d) => d.name);
    if (destinations.length > 1 || countDistinctRegions(destNames) >= 2) {
      return STEPS_MULTI_CITY;
    }
    return STEPS_DEFAULT;
  }, [destinations]);

  useEffect(() => {
    if (phase !== 'loading') return;
    const t1 = setInterval(() => setStepIdx((s) => (s + 1) % loadingSteps.length), 700);
    return () => clearInterval(t1);
  }, [phase, loadingSteps.length]);

  useEffect(() => {
    if (phase === 'loading' && !loadingPlan && !isManualMode && !isEditMode) {
      if (itinerary.length > 0) {
        setPhase('reveal');
      } else if (!generationError) {
        // Only show error if generation actually finished (not still pending)
        setGenerationError(true);
      }
    }
  }, [loadingPlan, phase, itinerary.length, isManualMode, isEditMode, generationError]);

  // Load review deck queue when reveal phase starts
  useEffect(() => {
    if (phase === 'reveal' && !isManualMode && !isEditMode && itinerary.length > 0 && reviewQueue.length === 0) {
      setReviewQueue(itinerary);
      setDeckIndex(0);
      setSwipeHistory([]);
      setShowReviewDeck(true);
    }
  }, [phase, itinerary]); // eslint-disable-line

  const isMultiDay = perDayItineraries.length > 1;
  const displayItinerary = isMultiDay ? (perDayItineraries[activeDay] ?? []) : itinerary;
  const activeItinerary = isManualMode ? manualStops : displayItinerary;

  const totals = useMemo(() => ({
    cost: activeItinerary.reduce((s, p) => s + p.cost, 0),
    time: activeItinerary.reduce((s, p) => s + p.durationMin, 0),
    dist: activeItinerary.reduce((s, p) => s + p.distanceKm, 0),
  }), [activeItinerary]);

  const getTime = (id: string, idx: number) => {
    if (stopTimes[id]) return stopTimes[id];
    let baseMin: number;
    if (isMultiDay) {
      if (activeDay === 0) {
        const arrTime = startTimeParam ?? journeyStart.time ?? '09:00';
        const arrHour = parseInt(arrTime.split(':')[0]);
        const arrMinute = parseInt(arrTime.split(':')[1]);
        baseMin = arrHour * 60 + arrMinute + 90; // 1.5h after arrival
      } else if (activeDay === perDayItineraries.length - 1) {
        baseMin = 8 * 60; // early start on departure day
      } else {
        baseMin = 9 * 60;
      }
    } else {
      baseMin = startTimeParam
        ? parseInt(startTimeParam.split(':')[0]) * 60 + parseInt(startTimeParam.split(':')[1])
        : 10 * 60 + 30;
    }
    const start = baseMin + idx * 90;
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
    if (!isAuthenticated || authUser?.name === 'Guest') {
      setSignupSheetOpen(true);
      return;
    }
    if (isEditMode) {
      setConfirmSaveEditsOpen(true);
    } else {
      setConfirmStartTripOpen(true);
    }
  };

  const proceedConfirm = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoItem(null);
    if (isManualMode) setItinerary(manualStops);
    setConfirmingPulse(true);
    setHasConfirmedTrip(true);

    // Fix #5: always derive trip name from current destinations, never from stale activeTrip.name
    const derivedTripName = destinations.length === 1
      ? `${destinations[0].name.split(',')[0]} Trip`
      : destinations.length > 0
        ? `${destinations[0].name.split(',')[0]} + ${destinations.length - 1} more`
        : 'New Trip';

    if (isPostOnboarding && !isEditMode) {
      const tripDest = destinations.map((d) => d.name).join(' → ') || 'Custom Destination';
      const tripCurrency = effectiveCurrency;
      const tripDays = journeyStart.days || daysParam || 1;
      const rate = CURRENCY_RATES_TO_IDR[tripCurrency] || 1;
      const localBudget = Math.round((budget * Math.max(1, tripDays)) / rate);

      createTrip({
        name: derivedTripName,
        destination: tripDest,
        currency: tripCurrency,
        budget: localBudget,
        daysTotal: tripDays,
        daysRemaining: tripDays,
        linkedToPlan: true,
      });
    } else if (!isEditMode) {
      // Fix #5: update the active trip name to match the planned destination
      setTripName(derivedTripName);
    }

    if (isPostOnboarding) {
      show('Your trip is ready', 'success');
      setTimeout(() => nav('/', { replace: true }), 700);
    } else {
      // Show success overlay, then navigate to map, then show wallet popup
      setSuccessOverlay(true);
      setTimeout(() => {
        setSuccessOverlay(false);
        // Set sessionStorage flag so MapPage shows the wallet popup
        try { sessionStorage.setItem('pavey_show_wallet_prompt', '1'); } catch { /* ignore */ }
        nav('/map', { replace: true });
      }, 1400);
    }
  };

  const manualSearchResults = useMemo(() => {
    if (!manualSearch.trim()) return PLACES.slice(0, 6);
    const q = manualSearch.toLowerCase();
    return PLACES.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [manualSearch]);

  const importAi = () => {
    setManualStops((prev) => {
      const existing = new Set(prev.map((p) => p.id));
      return [...prev, ...itinerary.filter((p) => !existing.has(p.id))];
    });
    show('TinTin suggestions imported', 'success');
  };

  const runReroll = () => {
    setReviewQueue([]);
    setDeckIndex(0);
    setSwipeHistory([]);
    // Fix #1 (real): Don't fight with the phase effect — just call buildFullItinerary.
    // The loadingPlan flag drives the loading UI (see render below).
    // We only reset phase to 'loading' if it was already there; otherwise keep 'reveal'
    // and show a loadingPlan overlay. This avoids the race where loadingPlan is still
    // false when the phase effect fires and immediately flips back to reveal.
    setGenerationError(false);
    const days = Math.max(1, isMultiDay ? perDayItineraries.length : (daysParam > 1 ? daysParam : journeyStart.days));
    buildFullItinerary(days, startTimeParam ?? journeyStart.time, endTimeParam ?? journeyStart.endTime ?? '14:00', true, cityParam || undefined)
      .then(() => {
        // After rebuild, reload the deck with fresh places
        setReviewQueue([]);
        setDeckIndex(0);
      })
      .catch(() => { setGenerationError(true); });
    setUserEdited(false);
    show('Re-rolling itinerary…', 'info');
  };

  return (
    <div className="absolute inset-0 bg-white overflow-hidden flex flex-col">
      <StatusBar />
      <div className="px-5 py-2 flex items-center justify-between shrink-0">
        <button
          onClick={() => {
            if (!hasConfirmedTrip && !isEditMode) {
              setExitModalOpen(true);
            } else {
              nav(-1);
            }
          }}
          className="w-10 h-10 -ml-2 flex items-center justify-center text-ink-700 press"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="font-bold text-ink-900 font-display">
          {isManualMode ? 'Build Your Journey' : COPY.sections.reviewHeader}
        </div>
        {/* Edit toggle — hidden during loading phase */}
        {!isManualMode ? (
          phase === 'reveal' ? (
            <button
              onClick={() => setEditAffordances((v) => !v)}
              className={`text-xs font-semibold press px-2.5 py-1 rounded-full transition-colors ${
                editAffordances ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-700 border border-ink-100'
              }`}
              aria-pressed={editAffordances}
            >
              {editAffordances ? 'Done' : 'Edit'}
            </button>
          ) : <div className="w-10" />
        ) : (
          <div className="text-xs text-brand-600 font-semibold capitalize bg-brand-50 px-2 py-1 rounded-full">Manual</div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!isManualMode ? (
          /* ── AI GENERATED FLOW ── */
          <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-hidden">
            <AnimatePresence mode="wait">
              {/* Fix #1 real: show loading when loadingPlan is true (covers both initial and re-roll) */}
              {phase === 'loading' || (loadingPlan && !isEditMode) ? (
                <LoadingState key="loading" stepIdx={stepIdx} steps={loadingSteps} />
              ) : (
                <motion.div
                  key="reveal"
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  {/* Summary card — compact */}
                  <div className="mx-5 mt-3 mb-2.5 p-4.5 rounded-2xl bg-brand-600 text-white shrink-0 shadow-soft">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-brand-200 uppercase mb-1">
                          <img src="/mascot.svg" alt="TinTin" className="w-4 h-4 object-contain brightness-0 invert shrink-0" />
                          {isMultiDay ? `Day ${activeDay + 1} of ${perDayItineraries.length}` : `${vibe.charAt(0).toUpperCase() + vibe.slice(1)} day`}
                        </div>
                        <h2 className="font-extrabold text-white text-base sm:text-lg font-display leading-tight truncate">
                          {/* Fix #5: always derive name from current destinations. Fallback excludes DEFAULT_TRIP names. */}
                          {destinations.length > 0
                            ? (destinations.length === 1
                                ? destinations[0].name.split(',')[0]
                                : `${destinations[0].name.split(',')[0]} + ${destinations.length - 1} more`)
                            : (activeTrip.name !== 'My Trip' && activeTrip.name !== 'Ubud Trip' && activeTrip.destination !== 'Bali, Indonesia'
                                ? activeTrip.name
                                : 'My Trip')}
                        </h2>
                        {journeyStart.date && journeyStart.date !== 'today' && (
                          <p className="text-xs text-brand-100/90 mt-0.5 font-medium truncate">
                            {formatDateRange(journeyStart.date, perDayItineraries.length || journeyStart.days)}
                          </p>
                        )}
                      </div>
                      {editAffordances && (
                        <button
                          onClick={() => {
                            setEditTripName(activeTrip.name !== 'My Trip' ? activeTrip.name : (destinations[0] ? destinations[0].name.split(',')[0] : 'My Trip'));
                            const startD = journeyStart.date === 'today' ? todayISO() : journeyStart.date;
                            setEditTripStartDate(startD);
                            setEditTripEndDate(getEndDateISO(startD, perDayItineraries.length || journeyStart.days));
                            setEditTripDetailsOpen(true);
                          }}
                          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center press shrink-0 transition-colors"
                          title="Edit trip details"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-white/15 pt-3 mt-1 text-sm font-medium text-brand-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider opacity-75 font-semibold">Stops</span>
                        <span className="font-bold text-white text-base">{displayItinerary.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider opacity-75 font-semibold">Distance</span>
                        <span className="font-bold text-white text-base">{totals.dist > 0.01 ? `${totals.dist.toFixed(2)}km` : '< 0.1km'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider opacity-75 font-semibold">Duration</span>
                        <span className="font-bold text-white text-base">{Math.round(totals.time / 60)}h {totals.time % 60}m</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider opacity-75 font-semibold">Est. Cost</span>
                        <span className="font-bold text-white text-base">{formatCost(totals.cost, effectiveCurrency)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Day tabs */}
                  {isMultiDay && (
                    <div className="px-5 pt-2 pb-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                      {perDayItineraries.map((_, i) => {
                        let dateStr = '';
                        let isToday = false;
                        if (journeyStart.date && journeyStart.date !== 'today') {
                          const dayDate = new Date(new Date(journeyStart.date).getTime() + i * 86400000);
                          dateStr = ` · ${dayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
                          const today = new Date();
                          isToday = dayDate.getFullYear() === today.getFullYear()
                            && dayDate.getMonth() === today.getMonth()
                            && dayDate.getDate() === today.getDate();
                        }
                        const label = `Day ${i + 1}${dateStr}`;
                        return (
                          <button
                            key={i}
                            onClick={() => setActiveDay(i)}
                            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold press transition-colors flex items-center gap-1 ${
                              activeDay === i ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-700 border border-ink-100'
                            }`}
                          >
                            {isToday && (
                              <span className={`w-1.5 h-1.5 rounded-full ${activeDay === i ? 'bg-white' : 'bg-emerald-500'}`} aria-label="Today" />
                            )}
                            {label}
                            {isToday && <span className={`text-[9px] font-bold uppercase tracking-wider ${activeDay === i ? 'text-white/80' : 'text-emerald-600'}`}>Today</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Stop list */}
                  <div className="flex-1 overflow-y-auto no-scrollbar mt-4 px-5 pb-20">
                    {/* Issue 8: Error state when generation yields empty itinerary */}
                    {generationError && displayItinerary.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4 py-12">
                        <div className="font-bold text-ink-900 text-lg font-display">Couldn't generate a plan</div>
                        <div className="text-sm text-ink-500">Check your vibe and budget settings and try again.</div>
                        <button
                          onClick={() => {
                            setGenerationError(false);
                            setPhase('loading');
                            const days = Math.max(1, daysParam > 1 ? daysParam : journeyStart.days);
                            buildFullItinerary(days, startTimeParam ?? journeyStart.time, endTimeParam ?? journeyStart.endTime ?? '14:00')
                              .catch(() => setGenerationError(true));
                          }}
                          className="h-12 px-6 rounded-2xl bg-brand-500 text-white font-bold press shadow-glow flex items-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" /> Try Again
                        </button>
                      </div>
                    ) : displayItinerary.length === 0 && isMultiDay ? (
                      /* Empty day placeholder — arrival/departure/travel/free */
                      (() => {
                        const slot = perDayMeta[activeDay];
                        const isTravel = slot?.kind === 'travel';
                        const crossRegion = isTravel && !!slot?.fromCity && !!slot?.toCity
                          && getRegion(slot.fromCity) !== getRegion(slot.toCity)
                          && !!getRegion(slot.fromCity) && !!getRegion(slot.toCity);
                        return (
                          <EmptyDayCard
                            dayIndex={activeDay}
                            totalDays={perDayItineraries.length}
                            arrivalTime={startTimeParam ?? journeyStart.time ?? '09:00'}
                            departureTime={endTimeParam ?? journeyStart.endTime ?? '14:00'}
                            kind={isTravel ? 'travel' : undefined}
                            fromCity={slot?.fromCity}
                            toCity={slot?.toCity}
                            crossRegion={crossRegion}
                          />
                        );
                      })()
                    ) : (<>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold tracking-widest text-ink-500">ITINERARY · {displayItinerary.length} STOPS</span>
                      {editAffordances && (
                        <button className="text-xs text-brand-600 font-semibold press" onClick={() => setShowAdd(true)}>+ Add stop</button>
                      )}
                    </div>



                    {/* Density warning — soft, dismissible */}
                    {!densityDismissed && (() => {
                      const stops = displayItinerary;
                      const tooMany = stops.length > 5;
                      const totalDist = stops.reduce((s, p) => s + p.distanceKm, 0);
                      const totalTime = stops.reduce((s, p) => s + p.durationMin, 0);
                      const farApart = totalDist > 30;
                      const tooLong = totalTime > 600;
                      if (!tooMany && !farApart && !tooLong) return null;
                      const reason = tooMany ? `${stops.length} stops` : farApart ? `${totalDist.toFixed(0)} km` : `${Math.round(totalTime / 60)}h activity`;
                      return (
                        <div className="mb-3 bg-amber-50/60 border border-amber-100 rounded-2xl p-3 flex items-center justify-between gap-3 text-amber-800">
                          <span className="text-xs font-medium truncate">
                            {isMultiDay ? `Day ${activeDay + 1}` : 'Schedule'} looks tight ({reason}).
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            {pace !== 'relaxed' && (
                              <button
                                onClick={() => {
                                  setPace('relaxed');
                                  const days = Math.max(1, daysParam > 1 ? daysParam : journeyStart.days);
                                  buildFullItinerary(days, startTimeParam ?? journeyStart.time, endTimeParam ?? journeyStart.endTime ?? '14:00')
                                    .catch(() => setGenerationError(true));
                                  show('Switched to Relaxed pace', 'success');
                                }}
                                className="text-xs font-bold bg-amber-500 text-white px-2.5 py-1 rounded-lg press"
                              >
                                Relax
                              </button>
                            )}
                            <button onClick={dismissDensity} className="text-amber-500 hover:text-amber-700 p-1 press">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    <Reorder.Group
                      axis="y"
                      values={displayItinerary}
                      onReorder={(newOrder) => {
                        setUserEdited(true);
                        if (isMultiDay) {
                          const newDays = perDayItineraries.map((day, d) => {
                            if (d !== activeDay) return day;
                            return newOrder;
                          });
                          setPerDayItineraries(newDays);
                        } else {
                          setItinerary(newOrder);
                        }
                      }}
                      className="space-y-1"
                    >
                      <AnimatePresence>
                        {(() => {
                          return displayItinerary.map((p, i) => {
                            const timeStr = getTime(p.id, i);
                            const conflict = hasConflict(p, timeStr);
                            return (
                              <ItineraryItem
                                key={p.id}
                                place={p}
                                index={i}
                                total={displayItinerary.length}
                                scheduledTime={timeStr}
                                hasConflict={conflict}
                                editable={editAffordances}
                                onTimeEdit={() => { setUserEdited(true); setEditingTimeFor(p.id); }}
                                onRemove={() => removeWithUndo(p, i, false)}
                                onReplace={() => setReplaceFor(p.id)}
                                onMoveUp={() => reorderDayStop(i, Math.max(0, i - 1))}
                                onMoveDown={() => reorderDayStop(i, Math.min(displayItinerary.length - 1, i + 1))}
                                onFixTime={(newTime) => {
                                  setUserEdited(true);
                                  setStopTimes((prev) => ({ ...prev, [p.id]: newTime }));
                                }}
                                showConnector={i < displayItinerary.length - 1}
                                nextDistanceKm={p.distanceKm}
                                connectorFromTime={getTime(p.id, i)}
                                connectorDurationMin={p.durationMin} 
                                effectiveCurrency={effectiveCurrency}
                              />
                            );
                          });
                        })()}
                      </AnimatePresence>
                    </Reorder.Group>



                    {editAffordances && (
                      <div className="mt-4 flex items-center justify-center gap-3">
                        <button
                          onClick={() => {
                            setReviewQueue(itinerary);
                            setDeckIndex(0);
                            setSwipeHistory([]);
                            setShowReviewDeck(true);
                          }}
                          className="flex items-center gap-2 text-xs font-semibold text-brand-600 px-4 py-2 rounded-full bg-brand-50 press"
                        >
                          <Hand className="w-3.5 h-3.5" /> Swipe review
                        </button>
                        <button
                          onClick={() => {
                            if (userEdited) {
                              setRerollConfirmOpen(true);
                            } else {
                              runReroll();
                            }
                          }}
                          className="flex items-center gap-2 text-xs font-semibold text-ink-600 px-4 py-2 rounded-full bg-ink-50 press"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Re-roll suggestions
                        </button>
                      </div>
                    )}

                    {/* Places exhaustion hint */}
                    {isMultiDay && perDayItineraries.flat().length < journeyStart.days * PACE_STOPS[pace] * 0.7 && (
                      <div className="mt-3 flex items-start gap-2 bg-ink-50/50 rounded-xl px-3 py-2.5">
                        <span className="text-xs text-ink-500">We've shown all available spots for this destination — some days may have fewer stops than your pace setting.</span>
                      </div>
                    )}

                    {/* Recommendations — hidden in read-only mode. */}
                    {editAffordances && !isMultiDay && alternatives(itinerary.map((p) => p.id)).length > 0 && (
                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">Discover Alternatives</span>
                        </div>
                        <div className="space-y-2">
                          {alternatives(itinerary.map((p) => p.id)).slice(0, 3).map((altP) => (
                            <AlternativeCard
                              key={altP.id}
                              altP={altP}
                              onAdd={() => {
                                const projected = [...displayItinerary, altP];
                                const check = dayIsTight(projected);
                                if (check.tight) {
                                  setTightAdd({ place: altP, reason: check.reason });
                                } else {
                                  addStop(altP, activeDay);
                                  show(COPY.recommendations.addedToast(altP.name), 'success');
                                }
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    </>)}
                  </div>

                  {/* Sticky CTA — compact */}
                  <div className="absolute inset-x-0 bottom-0 px-5 pt-3 pb-6 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      animate={confirmingPulse ? { boxShadow: ['0 0 0 0 rgba(59,91,255,0.4)', '0 0 0 16px rgba(59,91,255,0)'] } : {}}
                      transition={{ duration: 0.7 }}
                      onClick={onConfirm}
                      disabled={itinerary.length === 0 && displayItinerary.length === 0}
                      className="w-full h-11 rounded-2xl bg-brand-500 disabled:bg-ink-300 text-white font-bold text-sm flex items-center justify-center gap-2 pointer-events-auto shadow-glow"
                    >
                      <Check className="w-4 h-4" />
                      {isEditMode ? 'Save Changes' : COPY.ctas.reviewStart}
                    </motion.button>
                    {isPostOnboarding && (
                      <p className="text-center text-[11px] text-ink-400 mt-1.5 pointer-events-auto">
                        Edit or add stops above · You can change this anytime
                      </p>
                    )}
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
                  <div className="text-xs font-semibold opacity-80">Itinerary</div>
                  <div className="text-sm font-bold">{manualStops.length} stops · {formatCost(totals.cost, effectiveCurrency)}</div>
                </div>
                <button onClick={importAi} className="text-xs font-semibold press flex items-center gap-1 bg-white/20 rounded-full px-3 py-1.5">
                  <img src="/mascot.svg" alt="TinTin" className="w-4.5 h-4.5 object-contain" /> Mix TinTin
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-20">

              {/* ── ITINERARY (TOP PRIORITY) ── */}
              {manualStops.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-2 mt-1">
                    <span className="text-[11px] font-bold tracking-widest text-ink-500">ITINERARY · {manualStops.length} STOPS</span>
                  </div>
                  <Reorder.Group
                    axis="y"
                    values={manualStops}
                    onReorder={setManualStops}
                    className="space-y-0 mb-4"
                  >
                    <AnimatePresence>
                      {manualStops.map((p, i) => {
                        return (
                          <ItineraryItem
                            key={p.id}
                            place={p}
                            index={i}
                            total={manualStops.length}
                            scheduledTime={getTime(p.id, i)}
                            editable={true}
                            onTimeEdit={() => setEditingTimeFor(p.id)}
                            onRemove={() => removeWithUndo(p, i, true)}
                            onReplace={() => {}}
                            isManual={true}
                            onMoveUp={() => setManualStops((prev) => { const n = prev.slice(); const [x] = n.splice(i, 1); n.splice(Math.max(0, i - 1), 0, x); return n; })}
                            onMoveDown={() => setManualStops((prev) => { const n = prev.slice(); const [x] = n.splice(i, 1); n.splice(Math.min(prev.length - 1, i + 1), 0, x); return n; })}
                            onFixTime={(newTime) => {
                              setUserEdited(true);
                              setStopTimes((prev) => ({ ...prev, [p.id]: newTime }));
                            }}
                            showConnector={i < manualStops.length - 1}
                            nextDistanceKm={p.distanceKm}
                            connectorFromTime={getTime(p.id, i)}
                            connectorDurationMin={p.durationMin}
                            effectiveCurrency={effectiveCurrency}
                          />
                        );
                      })}
                    </AnimatePresence>
                  </Reorder.Group>
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
                        {formatCost(p.priceRange.min, effectiveCurrency)}{p.priceRange.max !== p.priceRange.min ? ` – ${formatCost(p.priceRange.max, effectiveCurrency)}` : ''}
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
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">Discover Alternatives</span>
                  </div>
                  <div className="space-y-2">
                    {alternatives(manualStops.map((p) => p.id)).slice(0, 3).map((p) => (
                      <AlternativeCard
                        key={p.id}
                        altP={p}
                        onAdd={() => { setManualStops((prev) => [...prev, p]); show(`${p.name} added`, 'success'); }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {manualStops.length === 0 && !manualSearch && (
                <div className="text-center py-8">
                  <div className="font-semibold text-ink-700 text-sm">No stops yet</div>
                  <div className="text-xs text-ink-500 mt-1">Search above or pick from recommendations</div>
                  <button onClick={importAi} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-50 text-brand-600 text-xs font-semibold press">
                    <img src="/mascot.svg" alt="TinTin" className="w-4.5 h-4.5 object-contain" /> Import TinTin suggestions
                  </button>
                </div>
              )}
            </div>

            <div className="absolute inset-x-0 bottom-0 px-5 pt-4 pb-8 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none">
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

      {/* Tinder-style Review Deck Overlay */}
      <AnimatePresence>
        {showReviewDeck && reviewQueue.length > 0 && deckIndex < reviewQueue.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-white flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between shrink-0 border-b border-ink-50">
              <div className="flex items-center gap-2">
                <img src="/mascot.svg" alt="TinTin" className="w-6 h-6 object-contain animate-pulse" />
                <div className="font-bold text-ink-900 font-display">Review Your Places</div>
              </div>
              <div className="text-xs font-semibold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full">
                {deckIndex + 1} of {reviewQueue.length}
              </div>
            </div>

            {/* Stack Area */}
            <div className="flex-1 relative flex items-center justify-center p-6 select-none bg-ink-50/20 overflow-hidden">
              {/* Left Side = Discard cue (swipe left = discard) */}
              <motion.div
                style={{ opacity: leftCueOpacity, scale: leftCueScale }}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1"
              >
                <div className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg border-2 border-white/80">
                  <X className="w-7 h-7 stroke-[3px]" />
                </div>
                <span className="text-[10px] font-bold text-red-600 tracking-wider uppercase bg-white/95 backdrop-blur px-2.5 py-0.5 rounded-full shadow-sm">Remove</span>
              </motion.div>

              {/* Right Side = Keep cue (swipe right = keep) */}
              <motion.div
                style={{ opacity: rightCueOpacity, scale: rightCueScale }}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1"
              >
                <div className="w-14 h-14 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-lg border-2 border-white/80">
                  <Check className="w-7 h-7 stroke-[3px]" />
                </div>
                <span className="text-[10px] font-bold text-brand-600 tracking-wider uppercase bg-white/95 backdrop-blur px-2.5 py-0.5 rounded-full shadow-sm">Keep</span>
              </motion.div>

              {reviewQueue.slice(deckIndex, deckIndex + 3).reverse().map((place, offsetIdx, sliceArr) => {
                const actualIdx = deckIndex + sliceArr.length - 1 - offsetIdx;
                const isTop = actualIdx === deckIndex;
                const depth = actualIdx - deckIndex;

                return (
                  <SwipeCard
                    key={place.id}
                    place={place}
                    isTop={isTop}
                    depth={depth}
                    dayIndex={getPlaceDayNumber(place.id)}
                    onSwipeLeft={() => {
                      handleSwipe('discard', place); // swipe left = discard
                    }}
                    onSwipeRight={() => {
                      handleSwipe('keep', place); // swipe right = keep
                    }}
                    dragX={deckDragX}
                    effectiveCurrency={effectiveCurrency}
                  />
                );
              })}
            </div>

            {/* Controls */}
            <div className="px-5 pt-4 pb-8 flex flex-col items-center gap-4 bg-white border-t border-ink-50 shrink-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[10px] text-red-500 font-bold">← Remove</span>
                <span className="text-[10px] text-ink-300">·</span>
                <span className="text-[10px] text-brand-600 font-bold">Keep →</span>
              </div>
              <div className="flex items-center justify-center gap-6">
                {/* Discard Button on LEFT (matches swipe-left = discard) */}
                <button
                  onClick={() => handleButtonSwipe('discard')}
                  className="w-14 h-14 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center shadow-sm hover:shadow-md border border-red-200 text-red-500 transition-all active:scale-95 press"
                  aria-label="Discard stop"
                >
                  <X className="w-6 h-6" />
                </button>

                {/* Undo Button (center) */}
                <button
                  onClick={handleSwipeUndo}
                  disabled={swipeHistory.length === 0}
                  className="w-12 h-12 rounded-full bg-ink-50 hover:bg-ink-100 disabled:opacity-40 flex items-center justify-center shadow-sm border border-ink-200 text-ink-600 transition-all active:scale-95 press"
                  aria-label="Undo last swipe"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                {/* Keep Button on RIGHT (matches swipe-right = keep) */}
                <button
                  onClick={() => handleButtonSwipe('keep')}
                  className="w-14 h-14 rounded-full bg-brand-50 hover:bg-brand-100 flex items-center justify-center shadow-sm hover:shadow-md border border-brand-200 text-brand-600 transition-all active:scale-95 press"
                  aria-label="Keep stop"
                >
                  <Check className="w-6 h-6" />
                </button>
              </div>

              {/* Skip button */}
              <button
                onClick={() => {
                  setShowReviewDeck(false);
                  show('Review skipped. Remaining stops kept.', 'info');
                }}
                className="text-xs font-semibold text-ink-400 hover:text-ink-600 underline press mt-1"
              >
                Skip review & view itinerary
              </button>
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
                <button onClick={() => setEditingTimeFor(null)} className="h-8 px-4 rounded-full bg-brand-500 text-white text-xs font-bold press">Done</button>
              </div>
              <div className="px-8 pb-2">
                <TimePicker
                  value={stopTimes[editingTimeFor] ?? getTime(editingTimeFor, activeItinerary.findIndex((p) => p.id === editingTimeFor))}
                  onChange={(t) => setStopTimes((prev) => ({ ...prev, [editingTimeFor]: t }))}
                />
              </div>
              <p className="text-center text-xs text-ink-400 mt-1 mb-1 px-4">
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
        effectiveCurrency={effectiveCurrency}
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
        onPick={(p) => { addStop(p, activeDay); setShowAdd(false); show(`${p.name} added`, 'success'); }}
        alternatives={alternatives}
        effectiveCurrency={effectiveCurrency}
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
                      <span>· {formatCost(place.cost, effectiveCurrency)}</span>
                    </div>
                    <div className="text-[10px] text-ink-400">{place.durationMin}min · {place.distanceKm > 0.01 ? `${place.distanceKm.toFixed(2)}km` : '< 0.1km'}</div>
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

      {/* Tight-day decision sheet — shown when an Add would over-pack the day */}
      <AnimatePresence>
        {tightAdd && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setTightAdd(null)}
              className="absolute inset-0 z-50 bg-ink-900/50"
            />
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card px-5 pt-4 pb-6"
            >
              <div className="w-10 h-1 rounded-full bg-ink-200 mx-auto mb-3" />
              <div className="font-bold text-ink-900 font-display text-base">{COPY.recommendations.tightHeadline}</div>
              <div className="text-xs text-ink-500 mt-1 leading-snug">
                {COPY.recommendations.tightBody(displayItinerary.length + 1)}
              </div>
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => {
                    setTightAdd(null);
                    setTimeout(() => {
                      if (displayItinerary[0]) setEditingTimeFor(displayItinerary[0].id);
                    }, 100);
                  }}
                  className="w-full text-left bg-brand-50/60 border border-brand-100 rounded-2xl px-3 py-3 press"
                >
                  <div className="text-sm font-bold text-ink-900">{COPY.recommendations.adjust}</div>
                  <div className="text-[11px] text-ink-500 mt-0.5">Edit start times to make room.</div>
                </button>
                <button
                  onClick={() => {
                    const p = tightAdd.place;
                    setTightAdd(null);
                    addStop(p, activeDay);
                    show(COPY.recommendations.packedToast, 'info');
                  }}
                  className="w-full text-left bg-amber-50 border border-amber-100 rounded-2xl px-3 py-3 press"
                >
                  <div className="text-sm font-bold text-ink-900">{COPY.recommendations.keep}</div>
                  <div className="text-[11px] text-ink-500 mt-0.5">Add it — your day will feel full.</div>
                </button>
                <button
                  onClick={() => setTightAdd(null)}
                  className="w-full text-left bg-ink-50 border border-ink-100 rounded-2xl px-3 py-3 press"
                >
                  <div className="text-sm font-bold text-ink-900">{COPY.recommendations.skip}</div>
                  <div className="text-[11px] text-ink-500 mt-0.5">Keep your day as-is.</div>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Re-roll confirmation — only shown when the user has edited the day. */}
      <AnimatePresence>
        {rerollConfirmOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setRerollConfirmOpen(false)}
              className="absolute inset-0 z-50 bg-ink-900/50"
            />
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card px-5 pt-4 pb-6"
            >
              <div className="w-10 h-1 rounded-full bg-ink-200 mx-auto mb-3" />
              <div className="font-bold text-ink-900 font-display text-base">Replace your edits?</div>
              <div className="text-xs text-ink-500 mt-1 leading-snug">{COPY.hints.rerollConfirm}</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setRerollConfirmOpen(false)}
                  className="h-11 rounded-xl bg-ink-50 border border-ink-100 text-ink-700 text-sm font-bold press"
                >
                  Keep my edits
                </button>
                <button
                  onClick={() => { setRerollConfirmOpen(false); runReroll(); }}
                  className="h-11 rounded-xl bg-brand-500 text-white text-sm font-bold press shadow-glow"
                >
                  Re-roll anyway
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Success overlay — shows briefly after trip confirmation */}
      <AnimatePresence>
        {successOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-brand-600 flex flex-col items-center justify-center gap-4"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center"
            >
              <Check className="w-10 h-10 text-white stroke-[2.5px]" />
            </motion.div>
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-center"
            >
              <div className="text-xl font-bold text-white font-display">Trip confirmed!</div>
              <div className="text-sm text-white/70 mt-1">Opening your map…</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit confirmation modal */}
      <AnimatePresence>
        {exitModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExitModalOpen(false)}
              className="absolute inset-0 z-50 bg-ink-900/40 backdrop-blur-sm pointer-events-auto"
            />
            <div className="absolute inset-0 z-50 flex items-center justify-center p-5 pointer-events-none">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="w-full max-w-sm bg-white rounded-3xl shadow-card p-6 pointer-events-auto flex flex-col items-center text-center"
              >
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4 shrink-0">
                  <AlertTriangle className="w-7 h-7 text-red-500" />
                </div>
                
                <h3 className="text-lg font-bold text-ink-900 font-display">Are you sure you want to leave?</h3>
                <p className="text-xs text-ink-500 mt-2 leading-relaxed">
                  Your trip has not been created yet.
                </p>
                
                <div className="grid grid-cols-2 gap-3 w-full mt-6">
                  <button
                    onClick={() => setExitModalOpen(false)}
                    className="h-11 rounded-2xl bg-ink-50 text-ink-700 text-xs font-semibold press hover:bg-ink-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmExit}
                    className="h-11 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold press transition-colors"
                  >
                    Leave
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Save Edits confirmation modal */}
      <AnimatePresence>
        {confirmSaveEditsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmSaveEditsOpen(false)}
              className="absolute inset-0 z-50 bg-ink-900/40 backdrop-blur-sm pointer-events-auto"
            />
            <div className="absolute inset-0 z-50 flex items-center justify-center p-5 pointer-events-none">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="w-full max-w-sm bg-white rounded-3xl shadow-card p-6 pointer-events-auto flex flex-col items-center text-center"
              >
                <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mb-4 shrink-0">
                  <Pencil className="w-7 h-7 text-brand-500" />
                </div>
                
                <h3 className="text-lg font-bold text-ink-900 font-display">Save changes to your trip?</h3>
                <p className="text-xs text-ink-500 mt-2 leading-relaxed">
                  Your current itinerary will be updated with the modifications you have made.
                </p>
                
                <div className="grid grid-cols-2 gap-3 w-full mt-6">
                  <button
                    onClick={() => setConfirmSaveEditsOpen(false)}
                    className="h-11 rounded-2xl bg-ink-50 text-ink-700 text-xs font-semibold press hover:bg-ink-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setConfirmSaveEditsOpen(false);
                      proceedConfirm();
                    }}
                    className="h-11 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold press transition-colors shadow-glow"
                  >
                    Save Changes
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Start Trip confirmation modal */}
      <AnimatePresence>
        {confirmStartTripOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmStartTripOpen(false)}
              className="absolute inset-0 z-50 bg-ink-900/40 backdrop-blur-sm pointer-events-auto"
            />
            <div className="absolute inset-0 z-50 flex items-center justify-center p-5 pointer-events-none">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="w-full max-w-sm bg-white rounded-3xl shadow-card p-6 pointer-events-auto flex flex-col items-center text-center"
              >
                <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mb-4 shrink-0">
                  <Compass className="w-7 h-7 text-brand-500" />
                </div>
                
                <h3 className="text-lg font-bold text-ink-900 font-display">Ready to start your trip?</h3>
                <p className="text-xs text-ink-500 mt-2 leading-relaxed">
                  You can still edit your itinerary later at any time from the <b>My Plans</b> section.
                </p>
                
                <div className="grid grid-cols-2 gap-3 w-full mt-6">
                  <button
                    onClick={() => setConfirmStartTripOpen(false)}
                    className="h-11 rounded-2xl bg-ink-50 text-ink-700 text-xs font-semibold press hover:bg-ink-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setConfirmStartTripOpen(false);
                      proceedConfirm();
                    }}
                    className="h-11 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold press transition-colors shadow-glow"
                  >
                    Start My Trip
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Guest Save Sheet */}
      <AnimatePresence>
        {signupSheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSignupSheetOpen(false)}
              className="absolute inset-0 z-50 bg-ink-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card pb-8 px-5 pt-4"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mb-4" />
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-ink-900 font-display">Save your progress?</h3>
                <p className="text-xs text-ink-500 mt-1">Sign up to access your plan on any device later.</p>
              </div>

              <div className="space-y-3 mb-5">
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-1">NAME</div>
                  <input
                    type="text"
                    placeholder="Your Name"
                    id="guest_signup_name"
                    className="w-full bg-ink-50 rounded-xl px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 outline-none border border-transparent focus:border-brand-400"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-1">EMAIL</div>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    id="guest_signup_email"
                    className="w-full bg-ink-50 rounded-xl px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 outline-none border border-transparent focus:border-brand-400"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-1">PASSWORD</div>
                  <input
                    type="password"
                    placeholder="••••••••"
                    id="guest_signup_password"
                    className="w-full bg-ink-50 rounded-xl px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 outline-none border border-transparent focus:border-brand-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    const nameEl = document.getElementById('guest_signup_name') as HTMLInputElement;
                    const emailEl = document.getElementById('guest_signup_email') as HTMLInputElement;
                    const passEl = document.getElementById('guest_signup_password') as HTMLInputElement;
                    const nameVal = nameEl?.value?.trim() || 'Traveler';
                    const emailVal = emailEl?.value?.trim();
                    const passVal = passEl?.value;

                    if (!emailVal || !passVal || passVal.length < 6) {
                      show('Please enter a valid email and minimum 6-character password', 'warn');
                      return;
                    }

                    show('Creating account...', 'info');
                    apiRegister(emailVal, passVal)
                      .then(() => apiLogin(emailVal, passVal))
                      .then((res) => {
                        setAccessToken(res.access_token);
                        signIn(nameVal, emailVal);
                        setSignupSheetOpen(false);
                        proceedConfirm();
                        show('Account created successfully!', 'success');
                      })
                      .catch((err) => {
                        console.error("Failed to register on confirm sheet:", err);
                        show(err.message || 'Failed to create account', 'warn');
                      });
                  }}
                  className="w-full h-12 rounded-xl bg-brand-500 text-white font-bold text-sm press shadow-glow flex items-center justify-center gap-1"
                >
                  Create Account & Save
                </button>
                <button
                  onClick={() => {
                    setSignupSheetOpen(false);
                    proceedConfirm();
                  }}
                  className="w-full h-10 rounded-xl text-ink-500 hover:text-ink-800 font-semibold text-xs press flex items-center justify-center"
                >
                  Continue as Guest (local-only)
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>



      {/* ── Edit Trip Details Modal ── */}
      <AnimatePresence>
        {editTripDetailsOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditTripDetailsOpen(false)}
              className="absolute inset-0 z-50 bg-ink-900/40 backdrop-blur-sm pointer-events-auto"
            />
            {/* Center aligned Modal Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="absolute inset-x-6 top-1/2 -translate-y-1/2 z-50 bg-white rounded-3xl p-6 shadow-xl border border-ink-100 flex flex-col pointer-events-auto font-sans"
            >
              <h3 className="font-bold text-ink-900 text-lg mb-4 font-display">Edit Trip Details</h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-ink-500 block mb-1.5 uppercase">Trip Name</label>
                  <input
                    type="text"
                    value={editTripName}
                    onChange={(e) => setEditTripName(e.target.value)}
                    placeholder="e.g. Summer Vacation"
                    className="w-full bg-ink-50 rounded-xl px-3 py-2.5 text-sm text-ink-900 border border-ink-200 outline-none focus:border-brand-400 font-sans"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold tracking-widest text-ink-500 block mb-1.5 uppercase font-sans">Start Date</label>
                    <input
                      type="date"
                      value={editTripStartDate}
                      onChange={(e) => setEditTripStartDate(e.target.value)}
                      className="w-full bg-ink-50 rounded-xl px-3 py-2.5 text-sm text-ink-900 border border-ink-200 outline-none focus:border-brand-400 font-sans"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold tracking-widest text-ink-500 block mb-1.5 uppercase font-sans">End Date</label>
                    <input
                      type="date"
                      value={editTripEndDate}
                      onChange={(e) => setEditTripEndDate(e.target.value)}
                      className="w-full bg-ink-50 rounded-xl px-3 py-2.5 text-sm text-ink-900 border border-ink-200 outline-none focus:border-brand-400 font-sans"
                    />
                  </div>
                </div>

                {editTripStartDate && editTripEndDate && (
                  <div className="text-xs text-ink-500 font-medium font-sans">
                    Total duration: <span className="text-brand-600 font-bold">{tripDurationDays(editTripStartDate, editTripEndDate)} days</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setEditTripDetailsOpen(false)}
                  className="flex-1 h-12 rounded-2xl bg-ink-50 hover:bg-ink-100 text-ink-700 font-semibold press flex items-center justify-center text-sm font-sans"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const newDays = tripDurationDays(editTripStartDate, editTripEndDate);
                    if (exceedsMaxDuration(newDays)) {
                      show(COPY.tripTooLong.urlToast(MAX_TRIP_DAYS), 'info');
                      return;
                    }

                    const allStops = perDayItineraries.flat();
                    if (allStops.length > 0 && newDays > 0) {
                      const redistributed: Place[][] = [];
                      const base = Math.floor(allStops.length / newDays);
                      const remainder = allStops.length % newDays;
                      let idx = 0;
                      for (let d = 0; d < newDays; d++) {
                        const count = base + (d < remainder ? 1 : 0);
                        redistributed.push(allStops.slice(idx, idx + count));
                        idx += count;
                      }
                      setPerDayItineraries(redistributed);
                      setItinerary(redistributed.flat());
                    } else {
                      const updatedPerDay = [...perDayItineraries];
                      if (newDays > updatedPerDay.length) {
                        while (updatedPerDay.length < newDays) {
                          updatedPerDay.push([]);
                        }
                      } else if (newDays < updatedPerDay.length) {
                        updatedPerDay.splice(newDays);
                      }
                      setPerDayItineraries(updatedPerDay);
                      setItinerary(updatedPerDay.flat());
                    }

                    setTripName(editTripName.trim() || activeTrip.name);
                    setJourneyStart({
                      ...journeyStart,
                      date: editTripStartDate || journeyStart.date,
                      days: newDays,
                    });
                    if (activeDay >= newDays) {
                      setActiveDay(newDays - 1);
                    }

                    setEditTripDetailsOpen(false);
                    show('Trip details updated', 'success');
                  }}
                  className="flex-1 h-12 rounded-2xl bg-brand-500 text-white font-bold press shadow-glow flex items-center justify-center text-sm font-sans"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────── */

const TRAVEL_DAY_IDEAS = [
  'Airport café & people-watch',
  'Local dinner near your hotel',
  'Easy evening walk around the neighborhood',
  'Check in, unpack, rest up',
  'Browse a local convenience store or market',
];

function EmptyDayCard({ dayIndex, totalDays, arrivalTime, departureTime, kind, fromCity, toCity, crossRegion }: {
  dayIndex: number; totalDays: number; arrivalTime: string; departureTime: string;
  kind?: 'arrival' | 'departure' | 'travel' | 'free';
  fromCity?: string; toCity?: string; crossRegion?: boolean;
}) {
  const isFirst = dayIndex === 0;
  const isLast = dayIndex === totalDays - 1;
  const resolvedKind: 'arrival' | 'departure' | 'travel' | 'free' =
    kind ?? (isFirst ? 'arrival' : isLast ? 'departure' : 'free');

  if (resolvedKind === 'travel') {
    const idea = TRAVEL_DAY_IDEAS[dayIndex % TRAVEL_DAY_IDEAS.length];
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center px-6">
        <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
          {crossRegion ? <Plane className="w-8 h-8 text-brand-500" /> : <Train className="w-8 h-8 text-brand-500" />}
        </div>
        <div>
          <div className="font-bold text-ink-900 text-lg font-display">
            Travel day{(fromCity && toCity) ? ` — ${fromCity} to ${toCity}` : ''}
          </div>
          <div className="text-sm text-ink-500 mt-1.5 max-w-[280px] leading-relaxed">
            A relaxed day to move between cities. Check in, rest, try something local.
          </div>
        </div>
        <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-full px-3 py-1.5">
          <span className="text-xs font-semibold text-brand-700">{idea}</span>
        </div>
      </div>
    );
  }

  const title = resolvedKind === 'arrival' ? 'Arrival Day' : resolvedKind === 'departure' ? 'Departure Day' : 'Free Day';
  const time = resolvedKind === 'arrival' ? arrivalTime : resolvedKind === 'departure' ? departureTime : null;
  const note = resolvedKind === 'arrival'
    ? `Arriving at ${time} — check in and settle in before tomorrow's adventures.`
    : resolvedKind === 'departure'
    ? `Departing at ${time} — pack up and head to the airport.`
    : 'No activities planned for this day — enjoy some rest or explore freely.';

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
        {resolvedKind === 'arrival' || resolvedKind === 'departure' ? (
          <Plane className="w-8 h-8 text-brand-500" />
        ) : (
          <Sun className="w-8 h-8 text-brand-500" />
        )}
      </div>
      <div>
        <div className="font-bold text-ink-900 text-lg font-display">{title}</div>
        <div className="text-sm text-ink-500 mt-1.5 max-w-[240px] leading-relaxed">{note}</div>
      </div>
    </div>
  );
}

function SummStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/15 rounded-xl py-2 px-2 text-center">
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-base font-bold leading-tight">{value}</div>
    </div>
  );
}

function LoadingState({ stepIdx, steps }: { stepIdx: number; steps: string[] }) {
  return (
    <motion.div
      key="loading"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex-1 flex flex-col items-center justify-center px-6 text-center bg-white"
    >
      <div className="relative w-32 h-32 flex items-center justify-center mb-8">
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [0.15, 0.4, 0.15] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-brand-500/10"
        />
        <motion.div
          animate={{ scale: [1.1, 1.6, 1.1], opacity: [0.1, 0.3, 0.1] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", delay: 0.4 }}
          className="absolute inset-0 rounded-full bg-brand-500/5"
        />
        
        <div className="relative w-24 h-24 rounded-full bg-white border border-brand-100 flex items-center justify-center shadow-sm z-10">
          <motion.img
            src="/mascot.svg"
            alt="TinTin"
            className="w-12 h-12"
            animate={{ y: [-6, 6, -6] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          />
        </div>
      </div>

      <h3 className="text-ink-900 font-bold text-lg font-display mb-2">
        {COPY.ctas.loadingHeadline}
      </h3>
      
      <div className="min-h-[24px] flex items-center justify-center text-brand-600 font-semibold text-sm mb-1.5">
        <AnimatePresence mode="wait">
          <motion.span
            key={stepIdx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="text-[15px]"
          >
            {steps[stepIdx]}
          </motion.span>
        </AnimatePresence>
      </div>
      
      <p className="text-xs text-ink-400">Just a moment…</p>
    </motion.div>
  );
}

/* ── Visual connector between stops ── */
function StopConnector({ distanceKm }: { distanceKm: number; fromTime?: string; durationMin?: number }) {
  const driveMin = Math.round(distanceKm * 3);

  return (
    <div className="flex items-center gap-3 ml-6 my-0.5 opacity-60">
      <div className="flex flex-col items-center w-6 shrink-0">
        <div className="w-0.5 bg-ink-200 border-dashed border-l h-5" />
      </div>
      <div className="flex items-center gap-1 bg-ink-50 px-2 py-0.5 rounded-full text-[10px] text-ink-400 font-medium">
        <Car className="w-3 h-3 text-ink-400 shrink-0" />
        <span>
          {distanceKm > 0.01
            ? `${driveMin} min (${distanceKm.toFixed(2)} km)`
            : `< 1 min (< 0.1 km)`}
        </span>
      </div>
    </div>
  );
}



function StopCard({
  index, place, scheduledTime, hasConflict, onTimeEdit, onRemove, onReplace, isManual, editable = true, onFixTime, dragControls, effectiveCurrency,
}: {
  index: number; total: number; place: Place;
  scheduledTime: string; hasConflict?: boolean; onTimeEdit: () => void;
  onRemove: () => void; onReplace: () => void; onMoveUp: () => void; onMoveDown: () => void;
  isManual?: boolean;
  editable?: boolean;
  onFixTime?: (newTime: string) => void;
  dragControls?: any;
  effectiveCurrency: Currency;
}) {
  const { activeTrip, isSaved, savePlace, removeSavedPlace } = useApp();
  const { show } = useToast();
  const canSwap = editable && !isManual;
  const saved = isSaved(place.id);
  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saved) {
      removeSavedPlace(place.id);
      show('Removed from saved places', 'info');
    } else {
      savePlace(place);
      show('Saved to saved places', 'success');
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -80, height: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="relative mb-2"
    >
      <div
        className="relative bg-white rounded-2xl border border-ink-150 p-2.5 flex flex-col gap-2 shadow-soft hover:shadow-soft transition-all duration-300"
      >
        {/* Row 1: Drag handle, Index + Image, Title/Stats, Edit Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Drag Handle */}
            {editable && dragControls && (
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="cursor-grab active:cursor-grabbing text-ink-300 hover:text-brand-600 p-0.5 shrink-0 select-none touch-none"
                aria-label="Drag to reorder"
              >
                <GripVertical className="w-4 h-4" />
              </div>
            )}

            {/* Image with overlaid index badge */}
            <div className="relative shrink-0">
              <img src={place.image} alt={place.name} className="w-11 h-11 rounded-xl object-cover border border-ink-100" />
              <div className="absolute -top-1.5 -left-1.5 bg-brand-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold border border-white shrink-0">
                {index + 1}
              </div>
              {isManual && (
                <div className="absolute -bottom-1 -right-1 bg-ink-900 text-white text-[7px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center border border-white">✎</div>
              )}
            </div>

            {/* Core Info */}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-ink-900 text-xs sm:text-sm leading-tight truncate">{place.name}</div>
              <div className="flex items-center gap-1.5 text-[10px] text-ink-500 mt-0.5 flex-wrap">
                <span className="flex items-center gap-0.5 font-semibold text-amber-500 bg-amber-50 px-1 rounded-sm shrink-0">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                  <span>{place.rating}</span>
                </span>
                <span className="text-ink-300">·</span>
                <span className="truncate">{place.category}</span>
                <span className="text-ink-300">·</span>
                <span className="text-brand-600 font-bold shrink-0">
                  {formatCost(place.priceRange.min, effectiveCurrency)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Edit Actions (Swap & Delete) */}
          {editable && (
            <div className="shrink-0 flex items-center gap-0.5">
              {canSwap && (
                <button
                  onClick={onReplace}
                  className="w-7 h-7 rounded-lg hover:bg-brand-50 text-brand-600 flex items-center justify-center transition-colors press"
                  title="Swap stop"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={onRemove}
                className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center transition-colors press"
                title="Remove stop"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Row 2: Time Button, Alerts, Tips, and Bookmark Button */}
        <div className="flex items-center justify-between border-t border-ink-50 pt-2 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
            {/* Time Pill */}
            <button
              onClick={onTimeEdit}
              className="flex items-center gap-1 bg-brand-50 hover:bg-brand-100 rounded-lg px-2 py-0.5 border border-brand-100/60 transition-colors press shrink-0"
            >
              <span className="text-[10px] font-bold text-brand-700">
                {scheduledTime}–{(() => {
                  const [h, m] = scheduledTime.split(':').map(Number);
                  const end = h * 60 + m + place.durationMin;
                  return `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
                })()}
              </span>
              <span className="text-[8px] text-brand-400 font-medium">Edit</span>
            </button>

            {/* Alert pills */}
            {hasConflict && (
              <div className="flex items-center gap-1 bg-red-50 border border-red-100 text-red-600 text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0">
                <span>Closes early</span>
                {editable && onFixTime && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const latestStartMin = place.closeHour * 60 - place.durationMin;
                      const h = Math.floor(latestStartMin / 60) % 24;
                      const m = latestStartMin % 60;
                      const newTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                      onFixTime(newTime);
                    }}
                    className="underline ml-0.5 hover:text-red-900 press"
                  >
                    Fix
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bookmark Action */}
          <button
            onClick={handleSave}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all press border shrink-0 ${
              saved ? 'bg-brand-50 text-brand-600 border-brand-200' : 'bg-ink-50 hover:bg-ink-100 text-ink-500 border-transparent'
            }`}
            title={saved ? 'Remove from Saved' : 'Save place'}
          >
            <Bookmark className={`w-3.5 h-3.5 ${saved ? 'fill-brand-500 text-brand-500' : ''}`} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Itinerary Item Wrapper to host useDragControls hook and prevent loop hooks violations ── */
function ItineraryItem({
  place,
  index,
  total,
  scheduledTime,
  hasConflict,
  editable,
  onTimeEdit,
  onRemove,
  onReplace,
  onMoveUp,
  onMoveDown,
  onFixTime,
  isManual,
  showConnector,
  nextDistanceKm,
  connectorFromTime,
  connectorDurationMin,
  effectiveCurrency,
}: {
  place: Place;
  index: number;
  total: number;
  scheduledTime: string;
  hasConflict?: boolean;
  editable: boolean;
  onTimeEdit: () => void;
  onRemove: () => void;
  onReplace: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onFixTime: (t: string) => void;
  isManual?: boolean;
  showConnector?: boolean;
  nextDistanceKm?: number;
  connectorFromTime?: string;
  connectorDurationMin?: number;
  effectiveCurrency: Currency;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={place}
      drag={editable ? 'y' : false}
      dragListener={false}
      dragControls={dragControls}
      className="mb-2 list-none"
    >
      <StopCard
        index={index}
        total={total}
        place={place}
        scheduledTime={scheduledTime}
        hasConflict={hasConflict}
        editable={editable}
        onTimeEdit={onTimeEdit}
        onRemove={onRemove}
        onReplace={onReplace}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onFixTime={onFixTime}
        isManual={isManual}
        dragControls={dragControls}
        effectiveCurrency={effectiveCurrency}
      />
      {showConnector && nextDistanceKm !== undefined && (
        <StopConnector
          distanceKm={nextDistanceKm}
          fromTime={connectorFromTime}
          durationMin={connectorDurationMin}
        />
      )}
    </Reorder.Item>
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
        onAdd({ id: `custom-${Date.now()}`, city: '', name: name.trim(), category: category as import('../data/places').Category, tags: ['Custom'], vibes: ['balanced'], image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80', cost: Number(cost) || 0, priceRange: { min: Number(cost) || 0, max: Number(cost) || 0 }, durationMin: Number(dur) || 60, distanceKm: 1.0, lat: -8.5055, lng: 115.2620, rating: 0, description: 'Custom stop.', openingHours: 'All day', indoor: true, openHour: 0, closeHour: 24 });
      }} className="w-full h-10 rounded-xl bg-brand-500 disabled:bg-ink-300 text-white font-semibold press flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" /> Add Custom Stop
      </button>
    </div>
  );
}

/* ── Alternatives Sheet ── */
function AlternativesSheet({ open, onClose, excludeIds, onPick, title, alternatives, effectiveCurrency }: {
  open: boolean; onClose: () => void; excludeIds: string[]; title: string;
  onPick: (p: Place) => void; alternatives: (ids: string[]) => Place[];
  effectiveCurrency: Currency;
}) {
  const { activeTrip } = useApp();
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    if (!query.trim()) return alternatives(excludeIds);
    const q = query.toLowerCase();
    return PLACES.filter((p) =>
      !excludeIds.includes(p.id) && (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      )
    ).slice(0, 12);
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
                    <div className="text-sm font-bold text-brand-600">{formatCost(p.cost, effectiveCurrency)}</div>
                    <div className="text-[11px] text-ink-500">{p.distanceKm > 0.01 ? `${p.distanceKm.toFixed(2)} km` : '< 0.1 km'}</div>
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

/* ── Alternative Card (swipable-to-add) ── */
function AlternativeCard({ altP, onAdd }: { altP: Place; onAdd: () => void }) {
  const [dragX, setDragX] = useState(0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -80, height: 0 }}
      className="relative overflow-hidden rounded-2xl"
    >
      {dragX < 0 && (
        <div className="absolute inset-0 bg-emerald-500 flex items-center justify-end pr-6">
          <span className="text-white text-xs font-bold">Add to Itinerary</span>
        </div>
      )}
      <motion.div
        drag="x"
        dragConstraints={{ left: -90, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        onDrag={(_, info) => setDragX(info.offset.x)}
        onDragEnd={(_, info) => {
          if (info.offset.x < -55) {
            onAdd();
          }
          setDragX(0);
        }}
        className="relative bg-ink-50/40 hover:bg-ink-50 border border-ink-100/60 p-2.5 flex items-center justify-between gap-3 transition-colors cursor-grab active:cursor-grabbing"
        style={{ x: dragX }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <img src={altP.image} alt={altP.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold text-ink-900 text-xs truncate">{altP.name}</div>
            <div className="text-[10px] text-ink-500 mt-0.5">
              {altP.rating} · {altP.category}
            </div>
          </div>
        </div>
        <button
          onClick={onAdd}
          className="text-[10px] font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-100 px-3 py-1.5 rounded-lg press shrink-0"
        >
          Add
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ── Tinder-Style swipe card for review queue ── */
interface SwipeCardProps {
  place: Place;
  isTop: boolean;
  depth: number;
  dayIndex: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  dragX: any;
  effectiveCurrency: Currency;
}

function SwipeCard({ place, isTop, depth, dayIndex, onSwipeLeft, onSwipeRight, dragX, effectiveCurrency }: SwipeCardProps) {
  const { activeTrip } = useApp();

  const scale = 1 - depth * 0.05;
  const yOffset = depth * 12;
  const zIndex = 10 - depth;
  const rotate = useTransform(dragX, [-200, 200], [-12, 12]);

  // Swipe LEFT = Discard/Remove, Swipe RIGHT = Keep/Accept
  const removeStampOpacity = useTransform(dragX, [-100, -25], [1, 0]);   // shows on left drag
  const keepStampOpacity = useTransform(dragX, [25, 100], [0, 1]);     // shows on right drag

  return (
    <motion.div
      style={{
        zIndex,
        scale: isTop ? 1 : scale,
        y: isTop ? 0 : yOffset,
        x: isTop ? dragX : 0,
        rotate: isTop ? rotate : 0,
      }}
      animate={
        isTop
          ? {}
          : {
              scale,
              y: yOffset,
              x: 0,
              rotate: 0,
            }
      }
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={(_, info) => {
        if (!isTop) return;
        if (info.offset.x < -120) {
          onSwipeLeft();
          dragX.set(0);
        } else if (info.offset.x > 120) {
          onSwipeRight();
          dragX.set(0);
        } else {
          animate(dragX, 0, { type: 'spring', stiffness: 300, damping: 25 });
        }
      }}
      className="absolute w-full max-w-[300px] aspect-[3/3.7] bg-white rounded-3xl border border-ink-100 shadow-xl overflow-hidden flex flex-col transition-shadow duration-300"
    >
      <div className="relative h-[50%] w-full bg-ink-100">
        <img
          src={place.image}
          alt={place.name}
          className="w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

        <div className="absolute top-4 left-4 flex gap-2">
          <span className="bg-brand-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
            Day {dayIndex}
          </span>
          <span className="bg-white/90 backdrop-blur text-ink-800 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
            {place.category}
          </span>
        </div>

        {isTop && (
          <>
            {/* Remove stamp on LEFT (swipe left = discard) */}
            <motion.div
              style={{ opacity: removeStampOpacity }}
              className="absolute top-1/2 left-8 -translate-y-1/2 -rotate-12 border-4 border-red-500 rounded-xl px-4 py-2 text-red-500 font-black text-2xl uppercase tracking-widest pointer-events-none select-none bg-white/90 backdrop-blur"
            >
              Remove
            </motion.div>

            {/* Keep stamp on RIGHT (swipe right = keep) */}
            <motion.div
              style={{ opacity: keepStampOpacity }}
              className="absolute top-1/2 right-8 -translate-y-1/2 rotate-12 border-4 border-brand-500 rounded-xl px-4 py-2 text-brand-500 font-black text-2xl uppercase tracking-widest pointer-events-none select-none bg-white/90 backdrop-blur"
            >
              Keep
            </motion.div>
          </>
        )}

        <div className="absolute bottom-4 inset-x-4">
          <h2 className="text-lg font-bold text-white leading-tight font-display drop-shadow">
            {place.name}
          </h2>
          <div className="flex items-center gap-1.5 text-white/90 text-[11px] mt-1 drop-shadow">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400 stroke-none" />
            <span className="font-bold">{place.rating}</span>
            <span>·</span>
            <span>{place.openingHours}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col justify-between bg-white text-ink-800">
        <div className="space-y-2">
          <p className="text-xs text-ink-500 leading-relaxed line-clamp-2">
            {place.description || 'Enjoy this wonderful spot carefully selected for your journey.'}
          </p>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-ink-500">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-ink-400" />
              <span>{place.durationMin} mins</span>
            </div>
            <div className="flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-ink-400" />
              <span>{place.distanceKm > 0.01 ? `${place.distanceKm.toFixed(2)} km` : '< 0.1 km'} dist</span>
            </div>
          </div>
        </div>

        <div className="pt-2.5 border-t border-ink-50 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">Est. Cost</span>
          <span className="text-xs font-bold text-brand-600">
            {formatCost(place.cost, effectiveCurrency)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}


