/**
 * AppContext — central client-side state for the planner.
 *
 * State slices (each is a `useState` below):
 *   - Auth: isAuthenticated, authUser, onboardingComplete
 *   - Plan inputs: vibe, budget, pace, journeyStart, destinations, activeDestIdx
 *   - Plan output: itinerary (flat), perDayItineraries (grouped), perDayMeta (day-kind labels)
 *   - Wallet: trips[], activeTripId — transactions live INSIDE each Trip.
 *     "Active trip proxies" (tripBudget/tripName/currency/etc.) read from
 *     `trips.find(t => t.id === activeTripId)` so callers don't need to know
 *     about the multi-trip structure.
 *   - User behavior: savedPlaces, visited, placeRatings, visitedPlaceIds
 *   - UI flags: isNavigating, buddyOpen, rainyDayMode
 *
 * Persistence: see `loadPersistedState` + the effect at the top of AppProvider —
 * a single localStorage key (`pavey_state`) holds the JSON blob.
 *
 * Backend migration notes:
 *   - Planning logic lives in src/lib/itinerary.ts. `buildFullItinerary` here
 *     is just a thin state-binding wrapper; replacing it with a `POST /plan`
 *     call is a one-file change.
 *   - Validation rules live in src/lib/planValidation.ts.
 *   - Wallet/trip shape is in src/data/wallet.ts.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PLACES, pickItinerary, type Place, type Vibe } from '../data/places';
import { DEFAULT_TRIP, BUDGET_TOTAL, type Transaction, type Trip, type Currency, suggestCurrency } from '../data/wallet';
import {
  PACE_STOPS, allocateDays, generateItinerary,
  type TripPace, type DayKind, type DayPlan,
} from '../lib/itinerary';

// Re-export planning types so existing imports from '../context/AppContext' keep working.
export { PACE_STOPS, allocateDays };
export type { TripPace, DayKind, DayPlan };

export type TransitMode = 'flight' | 'train' | 'bus' | 'drive' | 'ferry';

export interface Destination {
  id: string;
  name: string;   // e.g. "Paris, France"
  days: number;
  currency: Currency;
  itinerary: Place[];
  // new fields:
  arriveDate?: string;   // ISO date string e.g. '2025-06-14'
  departDate?: string;
  transitMode?: TransitMode;
  isTransitDay?: boolean;  // true = this is a transit leg, not a planning day
  legBudget?: number;      // per-leg budget override
  visaNote?: string;       // free-text visa/entry note
}

interface AppState {
  // Auth
  isAuthenticated: boolean;
  authUser: { name: string; email: string } | null;
  onboardingComplete: boolean;
  everOnboarded: boolean;
  isOnboarded: boolean;
  signIn: (name: string, email: string) => void;
  completeOnboarding: (data: {
    name: string;
    email: string;
    vibe: Vibe;
    destinations: Array<{ name: string; days: number }>;
    totalDays: number;
    budget: number;
    startDate: string;
  }) => void;
  logout: () => void;

  // Vibe & itinerary
  vibe: Vibe;
  setVibe: (v: Vibe) => void;
  budget: number;
  setBudget: (b: number) => void;
  itinerary: Place[];
  setItinerary: (p: Place[]) => void;
  buildItinerary: () => Place[];
  perDayItineraries: Place[][];
  setPerDayItineraries: (p: Place[][]) => void;
  perDayMeta: DayPlan[];
  buildFullItinerary: (days: number, arrivalTime?: string, departureTime?: string) => void;
  reorderStop: (from: number, to: number) => void;
  removeStop: (id: string) => void;
  replaceStop: (id: string, withPlace: Place) => void;
  addStop: (p: Place) => void;
  alternatives: (excludeIds: string[]) => Place[];

  // Multi-destination
  destinations: Destination[];
  setDestinations: (d: Destination[]) => void;
  activeDestIdx: number;
  setActiveDestIdx: (i: number) => void;
  addDestination: (dest: { name: string; days: number; arriveDate?: string; departDate?: string }) => void;
  removeDestination: (id: string) => void;
  insertDestination: (afterIdx: number, dest: { name: string; days: number }) => void;

  // Trip completion
  tripCompleted: boolean;
  completeTrip: () => void;

  // Multi-trip wallet
  trips: Trip[];
  activeTripId: string;
  setActiveTripId: (id: string) => void;
  activeTrip: Trip;
  createTrip: (data: Omit<Trip, 'id' | 'transactions' | 'createdAt'>) => string;
  deleteTrip: (id: string) => void;

  // Active trip proxies (for backward compat)
  transactions: Transaction[];
  addTransaction: (t: Omit<Transaction, 'id' | 'date'> & { date?: string }) => void;
  budgetTotal: number;
  totalSpent: number;
  tripBudget: number;
  setTripBudget: (n: number) => void;
  tripName: string;
  setTripName: (s: string) => void;
  tripDays: number;
  tripDaysRemaining: number;
  setTripDaysRemaining: (n: number) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  dailyAllowance: number;

  // Navigation
  isNavigating: boolean;
  setIsNavigating: (v: boolean) => void;
  navIndex: number;
  setNavIndex: (i: number) => void;
  visited: Set<string>;
  markVisited: (id: string) => void;

  // Saved places
  savedPlaces: Place[];
  savePlace: (p: Place) => void;
  removeSavedPlace: (id: string) => void;
  isSaved: (id: string) => boolean;

  // Journey settings
  journeyStart: { date: string; time: string; days: number; endTime?: string };
  setJourneyStart: (s: { date: string; time: string; days: number; endTime?: string }) => void;

  // Trip pace
  pace: TripPace;
  setPace: (p: TripPace) => void;

  // Buddy
  buddyOpen: boolean;
  setBuddyOpen: (v: boolean) => void;

  // Place ratings (1-4 emoji index)
  placeRatings: Record<string, number>;
  ratePlace: (id: string, rating: number) => void;

  // Rainy day mode
  rainyDayMode: boolean;
  setRainyDayMode: (v: boolean) => void;

  // Permanently visited places
  visitedPlaceIds: Set<string>;
  markVisitedPermanent: (id: string) => void;
}

const Ctx = createContext<AppState | null>(null);

const PERSIST_KEY = 'pavey_state';

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      isAuthenticated: boolean;
      authUser: { name: string; email: string } | null;
      onboardingComplete: boolean;
      everOnboarded?: boolean;
      vibe: Vibe;
      budget: number;
      itinerary: Place[];
      savedPlaces: Place[];
      destinations: Destination[];
      trips: Trip[];
      activeTripId: string;
      journeyStart: { date: string; time: string; days: number; endTime?: string };
      placeRatings?: Record<string, number>;
      visitedPlaceIds?: string[];
      perDayItineraries?: Place[][];
      pace?: TripPace;
    };
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Issue 35: load persisted state on mount
  const persisted = useMemo(() => loadPersistedState(), []);

  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(persisted?.isAuthenticated ?? false);
  const [authUser, setAuthUser] = useState<{ name: string; email: string } | null>(persisted?.authUser ?? null);
  const [onboardingComplete, setOnboardingComplete] = useState(persisted?.onboardingComplete ?? false);
  const [everOnboarded, setEverOnboarded] = useState(persisted?.everOnboarded ?? false);

  // Vibe & itinerary
  const [vibe, setVibe] = useState<Vibe>(persisted?.vibe ?? 'balanced');
  const [budget, setBudget] = useState<number>(persisted?.budget ?? 500_000);
  const [itinerary, setItinerary] = useState<Place[]>(persisted?.itinerary ?? [
    PLACES[0], PLACES[1], PLACES[2], PLACES[3],
  ]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [buddyOpen, setBuddyOpen] = useState(false);
  const [navIndex, setNavIndex] = useState(0);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [savedPlaces, setSavedPlaces] = useState<Place[]>(persisted?.savedPlaces ?? []);
  const [journeyStart, setJourneyStart] = useState(persisted?.journeyStart ?? { date: 'today', time: '09:00', days: 1 });
  const [perDayItineraries, setPerDayItineraries] = useState<Place[][]>(persisted?.perDayItineraries ?? []);
  const [perDayMeta, setPerDayMeta] = useState<DayPlan[]>([]);

  // Multi-destination
  const [destinations, setDestinations] = useState<Destination[]>(persisted?.destinations ?? []);
  const [activeDestIdx, setActiveDestIdx] = useState(0);

  // Trip completion
  const [tripCompleted, setTripCompleted] = useState(false);

  // Multi-trip state
  const [trips, setTrips] = useState<Trip[]>(persisted?.trips ?? []);
  const [activeTripId, setActiveTripId] = useState<string>(persisted?.activeTripId ?? DEFAULT_TRIP.id);

  // New state
  const [placeRatings, setPlaceRatings] = useState<Record<string, number>>(persisted?.placeRatings ?? {});
  const [rainyDayMode, setRainyDayMode] = useState(false);
  const [visitedPlaceIds, setVisitedPlaceIds] = useState<Set<string>>(new Set(persisted?.visitedPlaceIds ?? []));
  const [pace, setPace] = useState<TripPace>(persisted?.pace ?? 'balanced');

  // Issue 35: persist key state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PERSIST_KEY, JSON.stringify({
        isAuthenticated, authUser, onboardingComplete, everOnboarded,
        vibe, budget, itinerary, savedPlaces, destinations,
        trips, activeTripId, journeyStart,
        placeRatings,
        visitedPlaceIds: Array.from(visitedPlaceIds),
        perDayItineraries,
        pace,
      }));
    } catch { /* storage full — ignore */ }
  }, [isAuthenticated, authUser, onboardingComplete, everOnboarded, vibe, budget, itinerary, savedPlaces, destinations, trips, activeTripId, journeyStart, placeRatings, visitedPlaceIds, perDayItineraries, pace]);

  // Per-destination itinerary sync:
  // When activeDestIdx changes, load that destination's itinerary into global state.
  useEffect(() => {
    const dest = destinations[activeDestIdx];
    if (!dest) return;
    if (dest.itinerary && dest.itinerary.length > 0) {
      setItinerary(dest.itinerary);
    } else {
      setItinerary([]);
    }
  }, [activeDestIdx]); // eslint-disable-line

  // When global itinerary changes, save it back to the active destination.
  useEffect(() => {
    if (!destinations[activeDestIdx]) return;
    setDestinations((prev) =>
      prev.map((d, i) => i === activeDestIdx ? { ...d, itinerary } : d)
    );
  }, [itinerary]); // eslint-disable-line

  // 1.3 — Date-aware active destination
  useEffect(() => {
    if (!destinations.length || !destinations[0].arriveDate) return;
    const today = new Date().toISOString().slice(0, 10);
    const idx = destinations.findIndex((d) => {
      if (d.arriveDate && d.departDate) {
        return today >= d.arriveDate && today < d.departDate;
      }
      return false;
    });
    if (idx !== -1 && idx !== activeDestIdx) setActiveDestIdx(idx);
  }, [destinations]); // eslint-disable-line

  const activeTrip = useMemo(
    () => trips.find((t) => t.id === activeTripId) ?? trips[0] ?? DEFAULT_TRIP,
    [trips, activeTripId],
  );

  const updateActiveTrip = (updater: (trip: Trip) => Trip) => {
    setTrips((prev) => prev.map((t) => t.id === activeTripId ? updater(t) : t));
  };

  const totalSpent = useMemo(
    () => activeTrip.transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
    [activeTrip.transactions],
  );

  const dailyAllowance = useMemo(() => {
    const remaining = activeTrip.budget - totalSpent;
    return activeTrip.daysRemaining > 0 ? Math.max(0, remaining / activeTrip.daysRemaining) : 0;
  }, [activeTrip.budget, totalSpent, activeTrip.daysRemaining]);

  const createTripFn = (data: Omit<Trip, 'id' | 'transactions' | 'createdAt'>): string => {
    const id = `trip-${Math.random().toString(36).slice(2, 9)}`;
    const newTrip: Trip = { ...data, id, transactions: [], createdAt: new Date().toISOString() };
    setTrips((prev) => [...prev, newTrip]);
    setActiveTripId(id);
    return id;
  };

  const completeOnboarding = (data: {
    name: string;
    email: string;
    vibe: Vibe;
    destinations: Array<{ name: string; days: number }>;
    totalDays: number;
    budget: number;
    startDate: string;
  }) => {
    setAuthUser({ name: data.name, email: data.email });
    setIsAuthenticated(true);
    setVibe(data.vibe);
    setBudget(data.budget);

    const newDests: Destination[] = data.destinations.map((d, i) => ({
      id: `dest-${i}-${Date.now()}`,
      name: d.name,
      days: d.days,
      currency: suggestCurrency(d.name),
      itinerary: [],
    }));
    setDestinations(newDests);
    setActiveDestIdx(0);

    // Clear itinerary — user will generate it from Home
    setItinerary([]);

    setJourneyStart({ date: data.startDate, time: '09:00', days: data.totalDays });

    // Create wallet trip only when the user actually picked destinations
    // during onboarding. If they skipped (e.g. quick-login flow), leave the
    // wallet on the default empty state — the first plan from HomePage will
    // mint a real trip with `linkedToPlan: true`.
    if (data.destinations.length > 0) {
      const tripName = data.destinations.length === 1
        ? `${data.destinations[0].name} Trip`
        : `${data.destinations[0].name} + ${data.destinations.length - 1} more`;
      const tripDest = data.destinations.map((d) => d.name).join(' → ');
      const id = `trip-${Math.random().toString(36).slice(2, 9)}`;
      const newTrip: Trip = {
        id,
        name: tripName,
        destination: tripDest,
        currency: newDests[0]?.currency ?? 'IDR',
        budget: data.budget * Math.max(1, data.totalDays),
        daysTotal: data.totalDays,
        daysRemaining: data.totalDays,
        transactions: [],
        createdAt: new Date().toISOString(),
      };
      setTrips([newTrip]);
      setActiveTripId(id);
    }

    setOnboardingComplete(true);
    setEverOnboarded(true);
  };

  const value: AppState = {
    // Auth
    isAuthenticated,
    authUser,
    onboardingComplete,
    everOnboarded,
    isOnboarded: onboardingComplete,
    signIn: (name, email) => {
      setAuthUser({ name, email });
      setIsAuthenticated(true);
      setOnboardingComplete(true);
      setEverOnboarded(true);
    },
    completeOnboarding,
    logout: () => {
      setIsAuthenticated(false);
      setAuthUser(null);
      setOnboardingComplete(false);
      // keep everOnboarded = true so re-login lands on auth form only
      setItinerary([]);
      setVisited(new Set());
      setSavedPlaces([]);
      setIsNavigating(false);
      setNavIndex(0);
      setTrips([DEFAULT_TRIP]);
      setActiveTripId(DEFAULT_TRIP.id);
      setTripCompleted(false);
      setDestinations([]);
      setPlaceRatings({});
      setVisitedPlaceIds(new Set());
      setRainyDayMode(false);
      setPerDayItineraries([]);
      // Preserve everOnboarded flag in localStorage by re-writing only that key
      try {
        localStorage.setItem(PERSIST_KEY, JSON.stringify({ everOnboarded: true }));
      } catch { /* ignore */ }
    },

    vibe, setVibe,
    budget, setBudget,
    itinerary, setItinerary,
    buildItinerary: () => pickItinerary(vibe, budget, rainyDayMode),
    perDayItineraries,
    setPerDayItineraries,
    perDayMeta,
    // Thin wrapper around the pure planning engine. When migrating to a backend,
    // replace the `generateItinerary` call with `await api.plan(...)`.
    buildFullItinerary: (days: number, arrivalTime = '09:00', departureTime = '14:00') => {
      const { days: planDays, meta } = generateItinerary({
        destinations,
        activeDestIdx,
        totalDays: days,
        pace,
        vibe,
        budget,
        rainyDayMode,
        arrivalTime,
        departureTime,
      });
      setPerDayItineraries(planDays);
      setPerDayMeta(meta);
      setItinerary(planDays.flat());
    },
    reorderStop: (from, to) => {
      setItinerary((cur) => {
        const next = cur.slice();
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
      });
    },
    removeStop: (id) => setItinerary((cur) => cur.filter((p) => p.id !== id)),
    replaceStop: (id, withPlace) =>
      setItinerary((cur) => cur.map((p) => (p.id === id ? withPlace : p))),
    addStop: (p) =>
      setItinerary((cur) => (cur.find((x) => x.id === p.id) ? cur : [...cur, p])),
    alternatives: (excludeIds) => PLACES.filter((p) => !excludeIds.includes(p.id)).slice(0, 8),

    // Multi-destination
    destinations,
    setDestinations,
    activeDestIdx,
    setActiveDestIdx,
    addDestination: (dest) => {
      const newDest: Destination = {
        id: `dest-${Date.now()}`,
        name: dest.name,
        days: dest.days,
        currency: suggestCurrency(dest.name),
        itinerary: [],
        arriveDate: dest.arriveDate,
        departDate: dest.departDate,
      };
      setDestinations((prev) => [...prev, newDest]);
    },
    removeDestination: (id) => {
      setDestinations((prev) => prev.filter((d) => d.id !== id));
      setActiveDestIdx(0);
    },
    insertDestination: (afterIdx, dest) => {
      const newDest: Destination = {
        id: `dest-${Date.now()}`,
        name: dest.name,
        days: dest.days,
        currency: suggestCurrency(dest.name),
        itinerary: [],
      };
      setDestinations((prev) => {
        const next = prev.slice();
        next.splice(afterIdx + 1, 0, newDest);
        return next;
      });
    },

    // Trip completion
    tripCompleted,
    completeTrip: () => setTripCompleted(true),

    // Multi-trip
    trips,
    activeTripId,
    setActiveTripId,
    activeTrip,
    createTrip: createTripFn,
    deleteTrip: (id) => {
      if (trips.length <= 1) return;
      setTrips((prev) => prev.filter((t) => t.id !== id));
      if (activeTripId === id) {
        setActiveTripId(trips.find((t) => t.id !== id)?.id ?? trips[0].id);
      }
    },

    // Active trip proxies
    transactions: activeTrip.transactions,
    addTransaction: (t) => {
      const txn: Transaction = {
        id: `t${Math.random().toString(36).slice(2, 9)}`,
        date: t.date ?? new Date().toISOString(),
        ...t,
      };
      updateActiveTrip((trip) => ({ ...trip, transactions: [txn, ...trip.transactions] }));
    },
    budgetTotal: BUDGET_TOTAL,
    totalSpent,
    tripBudget: activeTrip.budget,
    setTripBudget: (n) => updateActiveTrip((t) => ({ ...t, budget: n })),
    tripName: activeTrip.name,
    setTripName: (s) => updateActiveTrip((t) => ({ ...t, name: s })),
    tripDays: activeTrip.daysTotal,
    tripDaysRemaining: activeTrip.daysRemaining,
    setTripDaysRemaining: (n) => updateActiveTrip((t) => ({ ...t, daysRemaining: n })),
    currency: activeTrip.currency,
    setCurrency: (c) => updateActiveTrip((t) => ({ ...t, currency: c })),
    dailyAllowance,

    isNavigating, setIsNavigating,
    navIndex, setNavIndex,
    visited,
    markVisited: (id) => setVisited((cur) => new Set(cur).add(id)),

    savedPlaces,
    savePlace: (p) => setSavedPlaces((cur) => cur.find((x) => x.id === p.id) ? cur : [...cur, p]),
    removeSavedPlace: (id) => setSavedPlaces((cur) => cur.filter((p) => p.id !== id)),
    isSaved: (id) => savedPlaces.some((p) => p.id === id),
    journeyStart,
    setJourneyStart,

    pace,
    setPace,

    buddyOpen,
    setBuddyOpen,

    // Place ratings
    placeRatings,
    ratePlace: (id, r) => setPlaceRatings((prev) => ({ ...prev, [id]: r })),

    // Rainy day mode
    rainyDayMode,
    setRainyDayMode,

    // Permanently visited places
    visitedPlaceIds,
    markVisitedPermanent: (id) => setVisitedPlaceIds((cur) => new Set(cur).add(id)),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
