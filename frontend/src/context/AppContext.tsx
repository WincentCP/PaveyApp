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

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PLACES, pickItinerary, type Place, type Vibe } from '../data/places';
import { DEFAULT_TRIP, BUDGET_TOTAL, type Transaction, type Trip, type Currency, suggestCurrency, CURRENCY_RATES_TO_IDR } from '../data/wallet';
import {
  PACE_STOPS, allocateDays, generateItinerary,
  type TripPace, type DayKind, type DayPlan,
} from '../lib/itinerary';
import { apiGetMe, apiGetTrips, apiCreateTrip, apiAddExpense, apiGetExpenses, setApiToken, apiSaveOnboarding } from '../lib/api';

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
  accessToken: string | null;
  setAccessToken: (t: string | null) => void;
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
  unlinkWalletFromPlan: (id: string) => void;

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
  changeTripCurrency: (targetCurrency: Currency, exchangeRate: number, convertedTxns: Transaction[]) => void;
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

  // Intent-sheet draft — preserved across navigation so "Edit trip" restores
  // the previous inputs instead of forcing the user to re-enter them.
  intentDraft: IntentDraft | null;
  setIntentDraft: (d: IntentDraft | null) => void;

  // True only when activeDestIdx was advanced automatically by the date-aware
  // effect (not by a manual tab tap). Gates the currency-switch banner so it
  // doesn't fire on browsing.
  destAutoAdvanced: boolean;
  clearDestAutoAdvanced: () => void;
}

export interface IntentDraft {
  dest: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  vibe: Vibe | null;
  budget: number | null;
  pace: TripPace;
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
      accessToken?: string | null;  // tambah accessToken agar ter-restore saat reload
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
  const [accessToken, setAccessToken] = useState<string | null>(persisted?.accessToken ?? null);
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
  const [destAutoAdvanced, setDestAutoAdvanced] = useState(false);

  // Intent-sheet draft for state restoration on Edit-trip navigation.
  // Session-only — not persisted to localStorage.
  const [intentDraft, setIntentDraft] = useState<IntentDraft | null>(null);

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

  // Initialize API token synchronously on render
  if (persisted?.accessToken) {
    setApiToken(persisted.accessToken);
  }

  useEffect(() => {
    setApiToken(accessToken);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || authUser) return;
    apiGetMe()
      .then((res) => {
        setAuthUser({ name: res.name, email: res.email });
        setIsAuthenticated(true);
      })
      .catch(() => {
        // Token expired atau invalid, clear state
        setAccessToken(null);
        setIsAuthenticated(false);
      });
  }, []); 

  // Synchronize local trips to backend and pull backend trips on login
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    apiGetTrips()
      .then((res) => {
        const backendTrips = res.trips || [];

        setTrips((prev) => {
          let updated = [...prev];

          // Identify local unsynced trips (ID starts with 'trip-' but not 'trip-default')
          const unsyncedTrips = updated.filter(t => t.id.startsWith('trip-') && t.id !== 'trip-default');

          unsyncedTrips.forEach((localTrip) => {
            const startD = localTrip.journeyStart?.date || 'today';
            const startDateStr = startD === 'today' ? new Date().toISOString().slice(0, 10) : startD;
            const days = localTrip.daysTotal || 1;
            const endD = new Date(new Date(startDateStr).getTime() + (days - 1) * 86400000);
            const endDateStr = endD.toISOString().slice(0, 10);

            const rate = CURRENCY_RATES_TO_IDR[localTrip.currency] || 1;
            const budgetInIdr = Math.round(localTrip.budget * rate);

            apiCreateTrip({
              destination: localTrip.destination,
              start_date: startDateStr,
              end_date: endDateStr,
              vibe: localTrip.vibe || 'balanced',
              budget_min: budgetInIdr,
              budget_max: budgetInIdr,
            })
            .then((createRes) => {
              const newUuid = createRes.trip_id;

              // Sync local expenses for this trip to the backend
              const localExpenses = localTrip.transactions || [];
              localExpenses.forEach((exp) => {
                const expenseRate = CURRENCY_RATES_TO_IDR[localTrip.currency] || 1;
                const expenseAmountInIdr = Math.round(Math.abs(exp.amount) * expenseRate);

                apiAddExpense({
                  trip_id: newUuid,
                  amount: expenseAmountInIdr,
                  category: exp.category,
                  description: exp.title || exp.description || '',
                }).catch((e) => console.error("Failed to sync expense during sync:", e));
              });

              // Replace temporary local ID with backend UUID in trips state
              setTrips((currentTrips) =>
                currentTrips.map((t) =>
                  t.id === localTrip.id
                    ? { ...t, id: newUuid }
                    : t
                )
              );

              // Update activeTripId if it was this unsynced trip
              setActiveTripId((prevActive) => prevActive === localTrip.id ? newUuid : prevActive);
            })
            .catch((err) => {
              console.error("Failed to sync local trip during login sync:", err);
            });
          });

          // Add any backend trips that aren't already in local state
          backendTrips.forEach((bt: any) => {
            const exists = updated.some((t) => t.id === bt.id);
            if (!exists) {
              const start = new Date(bt.start_date);
              const end = new Date(bt.end_date);
              const diffTime = Math.abs(end.getTime() - start.getTime());
              const daysTotal = (isNaN(diffTime) ? 1 : Math.ceil(diffTime / (1000 * 60 * 60 * 24))) + 1;

              const suggestedCur = suggestCurrency(bt.destination);
              const rate = CURRENCY_RATES_TO_IDR[suggestedCur] || 1;
              const convertedBudget = Math.round((bt.budget_max || 500000) / rate);

              updated.push({
                id: bt.id,
                name: `${bt.destination.split(' → ')[0]} Trip`,
                destination: bt.destination,
                currency: suggestedCur,
                budget: convertedBudget,
                daysTotal: daysTotal,
                daysRemaining: daysTotal,
                transactions: [],
                createdAt: bt.created_at || new Date().toISOString(),
                itinerary: [],
                destinations: [],
                journeyStart: { date: bt.start_date, time: '09:00', days: daysTotal },
                vibe: bt.vibe,
                pace: 'balanced',
                perDayItineraries: [],
              });
            }
          });

          return updated;
        });
      })
      .catch((err) => {
        console.error("Failed to sync/fetch backend trips:", err);
      });
  }, [isAuthenticated, accessToken]);

  // Load expenses from backend for the active trip if it is a UUID
  useEffect(() => {
    if (!accessToken || !activeTripId) return;
    const isBackendTrip = /^[0-9a-f-]{36}$/.test(activeTripId);
    if (!isBackendTrip) return;

    apiGetExpenses(activeTripId)
      .then((res) => {
        const targetTrip = trips.find((t) => t.id === activeTripId);
        const tripCurrency = targetTrip?.currency ?? 'IDR';
        const rate = CURRENCY_RATES_TO_IDR[tripCurrency] || 1;

        const fetched = (res.transactions ?? []).map((t: any) => ({
          id: t.id,
          title: t.description,
          category: t.category,
          amount: -(t.amount / rate),
          date: t.created_at,
          icon: '',
        }));

        setTrips((prev) =>
          prev.map((t) =>
            t.id === activeTripId
              ? { ...t, transactions: fetched }
              : t
          )
        );
      })
      .catch((err) => {
        console.warn("Failed to fetch expenses for active trip:", err);
      });
  }, [activeTripId, accessToken]);

  // Issue 35: persist key state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PERSIST_KEY, JSON.stringify({
        isAuthenticated, authUser, onboardingComplete, everOnboarded, accessToken,
        vibe, budget, itinerary, savedPlaces, destinations,
        trips, activeTripId, journeyStart,
        placeRatings,
        visitedPlaceIds: Array.from(visitedPlaceIds),
        perDayItineraries,
        pace,
      }));
    } catch { /* storage full — ignore */ }
  }, [isAuthenticated, authUser, onboardingComplete, everOnboarded, accessToken, vibe, budget, itinerary, savedPlaces, destinations, trips, activeTripId, journeyStart, placeRatings, visitedPlaceIds, perDayItineraries, pace]);

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
    if (idx !== -1 && idx !== activeDestIdx) {
      setActiveDestIdx(idx);
      setDestAutoAdvanced(true);
    }
  }, [destinations]); // eslint-disable-line

  const activeTrip = useMemo(
    () => trips.find((t) => t.id === activeTripId) ?? trips[0] ?? DEFAULT_TRIP,
    [trips, activeTripId],
  );

  const prevActiveTripIdRef = useRef(activeTripId);

  useEffect(() => {
    if (activeTripId !== prevActiveTripIdRef.current) {
      prevActiveTripIdRef.current = activeTripId;
      const targetTrip = trips.find((t) => t.id === activeTripId);
      if (targetTrip) {
        if (targetTrip.itinerary) setItinerary(targetTrip.itinerary);
        if (targetTrip.destinations) setDestinations(targetTrip.destinations);
        if (targetTrip.journeyStart) setJourneyStart(targetTrip.journeyStart);
        if (targetTrip.vibe) setVibe(targetTrip.vibe as Vibe);
        if (targetTrip.pace) setPace(targetTrip.pace as TripPace);
        if (targetTrip.perDayItineraries) setPerDayItineraries(targetTrip.perDayItineraries);
      }
    }
  }, [activeTripId, trips]);

  useEffect(() => {
    const currentActive = trips.find((t) => t.id === activeTripId);
    if (!currentActive) return;

    const isDifferent =
      JSON.stringify(currentActive.itinerary) !== JSON.stringify(itinerary) ||
      JSON.stringify(currentActive.destinations) !== JSON.stringify(destinations) ||
      JSON.stringify(currentActive.journeyStart) !== JSON.stringify(journeyStart) ||
      currentActive.vibe !== vibe ||
      currentActive.pace !== pace ||
      JSON.stringify(currentActive.perDayItineraries) !== JSON.stringify(perDayItineraries);

    if (isDifferent) {
      setTrips((prev) =>
        prev.map((t) =>
          t.id === activeTripId
            ? {
                ...t,
                itinerary,
                destinations,
                journeyStart,
                vibe,
                pace,
                perDayItineraries,
              }
            : t
        )
      );
    }
  }, [itinerary, destinations, journeyStart, vibe, pace, perDayItineraries, activeTripId]);

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
    const newTrip: Trip = {
      ...data,
      id,
      transactions: [],
      createdAt: new Date().toISOString(),
      itinerary,
      destinations,
      journeyStart,
      vibe,
      pace,
      perDayItineraries,
    };
    setTrips((prev) => [...prev, newTrip]);
    setActiveTripId(id);

    // Sync to backend if logged in
    if (accessToken) {
      const startD = journeyStart.date === 'today' ? new Date().toISOString().slice(0, 10) : (journeyStart.date || new Date().toISOString().slice(0, 10));
      const days = data.daysTotal || 1;
      const endD = new Date(new Date(startD).getTime() + (days - 1) * 86400000);
      const endDateStr = endD.toISOString().slice(0, 10);

      const rate = CURRENCY_RATES_TO_IDR[data.currency] || 1;
      const budgetInIdr = Math.round(data.budget * rate);

      apiCreateTrip({
        destination: data.destination,
        start_date: startD,
        end_date: endDateStr,
        vibe: vibe || 'balanced',
        budget_min: budgetInIdr,
        budget_max: budgetInIdr,
      })
      .then((res) => {
        const backendUuid = res.trip_id;
        setTrips((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, id: backendUuid }
              : t
          )
        );
        setActiveTripId((prevActive) => prevActive === id ? backendUuid : prevActive);
      })
      .catch((err) => {
        console.error("Failed to sync new trip to backend:", err);
      });
    }

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
      const newTripCurrency = newDests[0]?.currency ?? 'IDR';
      const rate = CURRENCY_RATES_TO_IDR[newTripCurrency] || 1;
      const convertedBudget = Math.round((data.budget * Math.max(1, data.totalDays)) / rate);

      const newTrip: Trip = {
        id,
        name: tripName,
        destination: tripDest,
        currency: newTripCurrency,
        budget: convertedBudget,
        daysTotal: data.totalDays,
        daysRemaining: data.totalDays,
        transactions: [],
        createdAt: new Date().toISOString(),
      };
      setTrips([newTrip]);
      setActiveTripId(id);
    }

    const token = accessToken || (() => {
      try {
        const raw = localStorage.getItem('pavey_state');
        return raw ? JSON.parse(raw).accessToken : null;
      } catch { return null; }
    })();

    if (token) {
      apiSaveOnboarding({
        name: data.name,
        vibe: data.vibe,
        budget: data.budget,
        destinations: data.destinations.map((d) => d.name),
      }).catch((err) => {
        console.error("Failed to save onboarding preferences to database:", err);
      });
    }

    setOnboardingComplete(true);
    setEverOnboarded(true);
  };

  const changeAccessToken = (token: string | null) => {
    setAccessToken(token);
    setApiToken(token);
  };

  const value: AppState = {
    // Auth
    isAuthenticated,
    authUser,
    onboardingComplete,
    everOnboarded,
    isOnboarded: onboardingComplete,
    accessToken,
    setAccessToken: changeAccessToken,
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
    // Manual setter — clears the auto-advance flag so the currency banner
    // doesn't fire when the user just taps to browse a destination tab.
    setActiveDestIdx: (i: number) => { setDestAutoAdvanced(false); setActiveDestIdx(i); },
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
    unlinkWalletFromPlan: (id) =>
      setTrips((prev) => prev.map((t) => t.id === id ? { ...t, linkedToPlan: false } : t)),

    // Active trip proxies
    transactions: activeTrip.transactions,
    addTransaction: (t) => {
      const tempId = `t${Math.random().toString(36).slice(2, 9)}`;
      const txn: Transaction = {
        id: tempId,
        date: t.date ?? new Date().toISOString(),
        ...t,
      };
      updateActiveTrip((trip) => ({ ...trip, transactions: [txn, ...trip.transactions] }));

      // Sync to backend if logged in and activeTrip is a UUID
      if (accessToken && activeTripId) {
        const isBackendTrip = /^[0-9a-f-]{36}$/.test(activeTripId);
        if (isBackendTrip) {
          const rate = CURRENCY_RATES_TO_IDR[activeTrip.currency] || 1;
          const amountInIdr = Math.round(Math.abs(t.amount) * rate);

          apiAddExpense({
            trip_id: activeTripId,
            amount: amountInIdr,
            category: t.category,
            description: t.title,
          })
          .then((res) => {
            setTrips((prev) =>
              prev.map((trip) =>
                trip.id === activeTripId
                  ? {
                      ...trip,
                      transactions: trip.transactions.map((tx) =>
                        tx.id === tempId ? { ...tx, id: res.data.id } : tx
                      ),
                    }
                  : trip
              )
            );
          })
          .catch((err) => {
            console.error("Failed to sync expense to backend:", err);
          });
        }
      }
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
    changeTripCurrency: (targetCurrency, exchangeRate, convertedTxns) => {
      setTrips((prev) =>
        prev.map((t) =>
          t.id === activeTripId
            ? {
                ...t,
                currency: targetCurrency,
                budget: Math.round(t.budget * exchangeRate),
                transactions: convertedTxns,
              }
            : t
        )
      );
    },
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

    // Intent draft + auto-advance flag
    intentDraft,
    setIntentDraft,
    destAutoAdvanced,
    clearDestAutoAdvanced: () => setDestAutoAdvanced(false),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
