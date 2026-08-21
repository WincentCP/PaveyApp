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
import { apiGetMe, apiGetTrips, apiCreateTrip, apiAddExpense, apiGetExpenses, setApiToken, apiSaveOnboarding, apiSavePlace, apiDeleteSavedPlace, apiGetSavedPlaces, apiGetUserPreferences, apiGeneratePlan, apiGenerateTripItinerary, apiGetItinerary, apiSaveItinerary } from '../lib/api';
import { getCityCenter, haversineKm } from '../chatbot/services/geocoding';


// Re-export planning types so existing imports from '../context/AppContext' keep working.
export { PACE_STOPS, allocateDays };
export type { TripPace, DayKind, DayPlan };

/** Geocode itinerary places that have missing/zero/wrong coordinates via Nominatim OSM.
 *  Reuses the same pipeline as the chatbot `enrichPlaces()` so both produce consistent,
 *  accurate coordinates shown on Leaflet maps. */
async function geocodeItineraryPlaces(places: Place[], city: string): Promise<Place[]> {
  if (!city) return places;
  const center = await getCityCenter(city);
  const results: Place[] = [];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < places.length; i++) {
    const p = places[i];

    try {
      const query = `${p.name}, ${city}`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'PaveyApp/1.0' } },
      );
      const data = await res.json();
      if (data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        // Sanity check: must be within 80km of city center
        if (!center || haversineKm(lat, lng, center.lat, center.lon) <= 80) {
          results.push({ ...p, lat, lng });
          await sleep(350); // Nominatim rate limit: max 1 req/sec
          continue;
        }
      }
    } catch { /* silent fail, use fallback below */ }

    // Radial fallback: distribute around city center if Nominatim fails
    if (center) {
      const angle = (i * 2 * Math.PI) / Math.max(1, places.length);
      const r = 0.006 + (i * 0.0015);
      results.push({
        ...p,
        lat: center.lat + r * Math.sin(angle),
        lng: center.lon + r * Math.cos(angle),
      });
    } else {
      results.push(p);
    }
  }
  return results;
}

// ── Curated place image lookup (no API key needed) ──────────────────────────
// Maps city keyword + place type to a real Unsplash photo.
// Falls back to type-only, then to a generic travel photo.
const CITY_IMAGES: Record<string, Record<string, string>> = {
  bali: {
    temple:      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
    beach:       'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=800&q=80',
    restaurant:  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
    market:      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&q=80',
    cafe:        'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80',
    hotel:       'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80',
    default:     'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
  },
  jakarta: {
    restaurant:  'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=800&q=80',
    mall:        'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80',
    hotel:       'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
    default:     'https://images.unsplash.com/photo-1555899434-94d1368aa7af?auto=format&fit=crop&w=800&q=80',
  },
  yogyakarta: {
    temple:      'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80',
    restaurant:  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
    hotel:       'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80',
    default:     'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80',
  },
  jogjakarta: {
    temple:      'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80',
    restaurant:  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
    hotel:       'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80',
    default:     'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80',
  },
  bandung: {
    nature:      'https://images.unsplash.com/photo-1597047084897-51e81819a499?auto=format&fit=crop&w=800&q=80',
    restaurant:  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80',
    hotel:       'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
    default:     'https://images.unsplash.com/photo-1626125345510-4603468eedfb?auto=format&fit=crop&w=800&q=80',
  },
  lombok: {
    beach:       'https://images.unsplash.com/photo-1562837832-7b4960bc6d10?auto=format&fit=crop&w=800&q=80',
    default:     'https://images.unsplash.com/photo-1562837832-7b4960bc6d10?auto=format&fit=crop&w=800&q=80',
  },
  singapore: {
    restaurant:  'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80',
    attraction:  'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?auto=format&fit=crop&w=800&q=80',
    park:        'https://images.unsplash.com/photo-1538484661700-3af6cc41b0e4?auto=format&fit=crop&w=800&q=80',
    default:     'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?auto=format&fit=crop&w=800&q=80',
  },
  tokyo: {
    restaurant:  'https://images.unsplash.com/photo-1557872943-16a5ac26437e?auto=format&fit=crop&w=800&q=80',
    shrine:      'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=800&q=80',
    market:      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80',
    default:     'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80',
  },
  osaka: {
    restaurant:  'https://images.unsplash.com/photo-1557872943-16a5ac26437e?auto=format&fit=crop&w=800&q=80',
    default:     'https://images.unsplash.com/photo-1590559899731-a382839e5549?auto=format&fit=crop&w=800&q=80',
  },
  kyoto: {
    temple:      'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=800&q=80',
    default:     'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=800&q=80',
  },
  bangkok: {
    temple:      'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80',
    restaurant:  'https://images.unsplash.com/photo-1541795795328-f073b763494e?auto=format&fit=crop&w=800&q=80',
    market:      'https://images.unsplash.com/photo-1569596082827-c9c9b72df8a4?auto=format&fit=crop&w=800&q=80',
    default:     'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80',
  },
  'kuala lumpur': {
    restaurant:  'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=800&q=80',
    default:     'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=800&q=80',
  },
  paris: {
    restaurant:  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80',
    default:     'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80',
  },
};

// Comprehensive topic-based high-resolution fallback photos for any city
const CATEGORY_DYNAMIC_IMAGES: Record<string, string[]> = {
  restaurant: [
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1549294413-26f195200c16?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
  ],
  cafe: [
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=800&q=80',
  ],
  hotel: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80',
  ],
  beach: [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1562837832-7b4960bc6d10?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=800&q=80',
  ],
  temple: [
    'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80',
  ],
  nature: [
    'https://images.unsplash.com/photo-1597047084897-51e81819a499?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
  ],
  mall: [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1569596082827-c9c9b72df8a4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80',
  ],
  museum: [
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=800&q=80',
  ],
  attraction: [
    'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1555899434-94d1368aa7af?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1486873249359-2731bd6dafc7?auto=format&fit=crop&w=800&q=80',
  ],
};

export function getPlaceImage(city: string, type: string, placeName?: string): string {
  const cityKey = city?.toLowerCase().split(',')[0].trim() || '';
  const nameLower = placeName?.toLowerCase().trim() || '';

  // 1. Check if placeName has specific keyword indicators
  let categoryKey = 'attraction';
  if (/hotel|resort|villa|inn|lodging|hostel|stay/i.test(nameLower) || /hotel/i.test(type)) {
    categoryKey = 'hotel';
  } else if (/cafe|kopi|coffee|roastery|bakery/i.test(nameLower) || /cafe/i.test(type)) {
    categoryKey = 'cafe';
  } else if (/restaurant|resto|warung|sate|bakso|nasi|dapur|kuliner|food|dining/i.test(nameLower) || /restaurant|food/i.test(type)) {
    categoryKey = 'restaurant';
  } else if (/pantai|beach|island|gili|cove/i.test(nameLower) || /beach/i.test(type)) {
    categoryKey = 'beach';
  } else if (/candi|temple|pura|mosque|masjid|church|gereja|shrine/i.test(nameLower) || /temple|shrine/i.test(type)) {
    categoryKey = 'temple';
  } else if (/taman|park|curug|waterfall|gunung|mountain|hutan|forest|bukit|ridge/i.test(nameLower) || /nature|park/i.test(type)) {
    categoryKey = 'nature';
  } else if (/mall|plaza|square|market|pasar/i.test(nameLower) || /mall|market|shopping/i.test(type)) {
    categoryKey = 'mall';
  } else if (/museum|gallery|istana|palace|benteng|fort|monumen|monas/i.test(nameLower) || /museum/i.test(type)) {
    categoryKey = 'museum';
  }

  // 2. Try city-specific match first
  for (const [key, map] of Object.entries(CITY_IMAGES)) {
    if (cityKey && (cityKey.includes(key) || key.includes(cityKey))) {
      if (map[categoryKey]) return map[categoryKey];
      if (map[type]) return map[type];
      if (map.default) return map.default;
    }
  }

  // 3. Dynamic hash pick from the relevant category pool
  const pool = CATEGORY_DYNAMIC_IMAGES[categoryKey] || CATEGORY_DYNAMIC_IMAGES.attraction;
  if (placeName) {
    let hash = 0;
    for (let i = 0; i < placeName.length; i++) {
      hash = placeName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return pool[Math.abs(hash) % pool.length];
  }

  return pool[0];
}


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
    isGuest?: boolean;
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
  setPerDayMeta: (m: DayPlan[]) => void;
  buildFullItinerary: (days: number, arrivalTime?: string, departureTime?: string, bypassCache?: boolean, cityOverride?: string) => Promise<void>;
  loadingPlan: boolean;
  reorderStop: (from: number, to: number) => void;
  removeStop: (id: string) => void;
  replaceStop: (id: string, withPlace: Place) => void;
  addStop: (p: Place, dayIndex?: number) => void;
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
  saveItineraryToBackend: (tripId: string, currentItinerary: Place[], currentPerDay: Place[][]) => Promise<void>;
  activeDay: number;
  setActiveDay: (d: number) => void;
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
      activeDay?: number;
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
  const [itinerary, setItinerary] = useState<Place[]>(persisted?.itinerary ?? []);
  const [isNavigating, setIsNavigating] = useState(false);
  const [buddyOpen, setBuddyOpen] = useState(false);
  const [navIndex, setNavIndex] = useState(0);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [savedPlaces, setSavedPlaces] = useState<Place[]>(persisted?.savedPlaces ?? []);
  const [journeyStart, setJourneyStart] = useState(persisted?.journeyStart ?? { date: 'today', time: '09:00', days: 1 });
  const [perDayItineraries, setPerDayItineraries] = useState<Place[][]>(persisted?.perDayItineraries ?? []);
  const [perDayMeta, setPerDayMeta] = useState<DayPlan[]>([]);
  const [activeDay, setActiveDay] = useState(persisted?.activeDay ?? 0);

  // Multi-destination
  const [destinations, setDestinations] = useState<Destination[]>(persisted?.destinations ?? []);
  const [activeDestIdx, setActiveDestIdx] = useState(0);
  const [destAutoAdvanced, setDestAutoAdvanced] = useState(false);

  // Reset activeDay when active destination changes
  useEffect(() => {
    setActiveDay(0);
  }, [activeDestIdx]);

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
  const [loadingPlan, setLoadingPlan] = useState(false);

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

  // Load saved places and user preferences on login
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    // Fetch saved places from Supabase
    apiGetSavedPlaces()
      .then((res) => {
        if (res.places) {
          setSavedPlaces(res.places);
        }
      })
      .catch((err) => console.error("Failed to load saved places:", err));

    // Fetch preferences (vibe, budget, etc.)
    apiGetUserPreferences()
      .then((res) => {
        if (res.has_history && res.preferences) {
          const pref = res.preferences;
          if (pref.vibe) setVibe(pref.vibe);
          if (pref.budget_min) setBudget(pref.budget_min);
        }
      })
      .catch((err) => console.error("Failed to load user preferences:", err));
  }, [isAuthenticated, accessToken]);

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
                  description: exp.title || exp.note || '',
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
 
  // Load itinerary from backend for the active trip if it is a UUID
  useEffect(() => {
    if (!accessToken || !activeTripId) return;
    const isBackendTrip = /^[0-9a-f-]{36}$/.test(activeTripId);
    if (!isBackendTrip) return;
 
    apiGetItinerary(activeTripId)
      .then((res: any) => {
        if (!res || !res.itinerary) return;
        const daysKeys = Object.keys(res.itinerary).sort((a, b) => Number(a) - Number(b));
        const flatItinerary: Place[] = [];
        const perDay: Place[][] = [];
 
        const targetTrip = trips.find((t) => t.id === activeTripId);
        const targetCity = targetTrip?.destination?.split(' → ')?.[0] || '';
 
        daysKeys.forEach((dayKey) => {
          const dayItems = res.itinerary[dayKey] || [];
          const dayPlaces: Place[] = dayItems.map((item: any) => {
            let notes: any = {};
            try {
              notes = typeof item.notes === 'string' ? JSON.parse(item.notes) : (item.notes || {});
            } catch (e) {
              console.warn("Failed to parse notes JSON:", e);
            }
 
            return {
              id: item.id || `db-${item.order_index}-${dayKey}-${Date.now()}`,
              city: targetCity,
              name: item.place_name,
              category: item.place_type === 'restaurant' ? 'Foodie' : 'Cultural',
              tags: [item.place_type],
              vibes: [],
              image: notes.image || '',
              cost: notes.cost || 0,
              priceRange: { min: notes.cost || 0, max: notes.cost || 0 },
              durationMin: notes.duration_minutes || 60,
              distanceKm: item.travel_time_to_next ? (item.travel_time_to_next * 0.4) : 0.5,
              lat: notes.latitude || 0,
              lng: notes.longitude || 0,
              rating: notes.rating || 4.5,
              description: notes.activity || 'Explore the location',
              openingHours: '09:00 – 21:00',
              indoor: false,
              openHour: 9,
              closeHour: 21,
            };
          });
          perDay.push(dayPlaces);
          flatItinerary.push(...dayPlaces);
        });
 
        // Update the trips list
        setTrips((prev) =>
          prev.map((t) =>
            t.id === activeTripId
              ? { ...t, itinerary: flatItinerary, perDayItineraries: perDay }
              : t
          )
        );
 
        // Also update local active state
        setItinerary(flatItinerary);
        setPerDayItineraries(perDay);
      })
      .catch((err) => {
        console.warn("Failed to fetch itinerary for active trip:", err);
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
        activeDay,
      }));
    } catch { /* storage full — ignore */ }
  }, [isAuthenticated, authUser, onboardingComplete, everOnboarded, accessToken, vibe, budget, itinerary, savedPlaces, destinations, trips, activeTripId, journeyStart, placeRatings, visitedPlaceIds, perDayItineraries, pace, activeDay]);

  // Per-destination itinerary sync:
  // When activeDestIdx changes, load that destination's itinerary into global state.
  useEffect(() => {
    const dest = destinations[activeDestIdx];
    if (!dest) return;
    if (JSON.stringify(dest.itinerary) !== JSON.stringify(itinerary)) {
      setItinerary(dest.itinerary || []);
    }
  }, [activeDestIdx, destinations]); // eslint-disable-line

  // When global itinerary changes, save it back to the active destination.
  useEffect(() => {
    if (!destinations[activeDestIdx]) return;
    const currentDest = destinations[activeDestIdx];
    if (JSON.stringify(currentDest.itinerary) !== JSON.stringify(itinerary)) {
      setDestinations((prev) =>
        prev.map((d, i) => i === activeDestIdx ? { ...d, itinerary } : d)
      );
    }
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
    const targetTrip = trips.find((t) => t.id === activeTripId);
    if (targetTrip && activeTripId !== prevActiveTripIdRef.current) {
      prevActiveTripIdRef.current = activeTripId;
      setItinerary(targetTrip.itinerary || []);
      setDestinations(targetTrip.destinations || []);
      setJourneyStart(targetTrip.journeyStart || { date: 'today', time: '09:00', days: 1 });
      setVibe((targetTrip.vibe as Vibe) || 'balanced');
      setPace((targetTrip.pace as TripPace) || 'balanced');
      setPerDayItineraries(targetTrip.perDayItineraries || []);
    }
  }, [activeTripId, trips]);

  const syncActiveTripIdRef = useRef(activeTripId);

  useEffect(() => {
    if (activeTripId !== syncActiveTripIdRef.current) {
      syncActiveTripIdRef.current = activeTripId;
      return;
    }
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

  const saveItineraryToBackend = async (tripId: string, currentItinerary: Place[], currentPerDay: Place[][]) => {
    if (!accessToken || !tripId) return;
    try {
      const dbItems = currentItinerary.map((item, idx) => {
        const notesData = JSON.stringify({
          activity: item.description || '',
          latitude: item.lat || 0,
          longitude: item.lng || 0,
          rating: item.rating || 4.5,
          duration_minutes: item.durationMin || 60,
          image: item.image || '',
          cost: item.cost || 0,
        });

        let dayNumber = 1;
        let orderIndex = idx;
        if (currentPerDay && currentPerDay.length > 0) {
          for (let d = 0; d < currentPerDay.length; d++) {
            const pIdx = currentPerDay[d].findIndex((p) => p.id === item.id);
            if (pIdx !== -1) {
              dayNumber = d + 1;
              orderIndex = pIdx;
              break;
            }
          }
        }

        let baseMin = 9 * 60;
        const start = baseMin + orderIndex * 90;
        const sh = Math.floor(start / 60) % 24;
        const sm = start % 60;
        const startTimeStr = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;

        const end = start + (item.durationMin || 60);
        const eh = Math.floor(end / 60) % 24;
        const em = end % 60;
        const endTimeStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;

        return {
          day_number: dayNumber,
          order_index: orderIndex,
          place_name: item.name,
          place_type: item.tags?.[0] || 'destination',
          start_time: startTimeStr,
          end_time: endTimeStr,
          travel_time_to_next: item.distanceKm ? Math.max(1, Math.round(item.distanceKm * 3)) : 15,
          notes: notesData,
        };
      });

      await apiSaveItinerary(tripId, dbItems);
      console.log("[AppContext] Successfully saved itinerary to database for trip:", tripId);
    } catch (err) {
      console.error("[AppContext] Failed to save itinerary to backend:", err);
    }
  };

  const createTripFn = (data: Omit<Trip, 'id' | 'transactions' | 'createdAt'>): string => {
    const id = `trip-${Math.random().toString(36).slice(2, 9)}`;
    const newTrip: Trip = {
      itinerary,
      destinations,
      journeyStart,
      vibe,
      pace,
      perDayItineraries,
      ...data,
      id,
      transactions: [],
      createdAt: new Date().toISOString(),
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
        
        // Save the itinerary to the backend!
        saveItineraryToBackend(backendUuid, itinerary, perDayItineraries);
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
    isGuest?: boolean;
  }) => {
    if (data.isGuest) {
      setAuthUser(null);
      setIsAuthenticated(false);
    } else {
      setAuthUser({ name: data.name, email: data.email });
      setIsAuthenticated(true);
    }
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

    if (token && data.destinations && data.destinations.length > 0) {
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
    setPerDayMeta,
    loadingPlan,
    buildFullItinerary: async (days: number, arrivalTime = '09:00', departureTime = '14:00', bypassCache = false, cityOverride?: string) => {
      setLoadingPlan(true);
      // Fix #6 & #7: clear previous itinerary so "plan another trip" starts fresh
      setItinerary([]);
      setPerDayItineraries([]);
      try {
        let res: any;
        // Use the first destination name, then activeTrip destination, then empty string.
        // Do NOT fall back to 'Bali, Indonesia' — that would generate wrong-city results.
        // cityOverride from URL param wins — it's set by HomePage before navigation,
        // so it's always fresh even if React context state hasn't settled yet.
        const targetCity = cityOverride || destinations[0]?.name || activeTrip?.destination || '';

        // Fix #3: auto-suggest currency from destination and update the active trip
        if (targetCity) {
          const suggestedCurrency = suggestCurrency(targetCity);
          // Update trip currency only if it differs from the current one (avoid redundant renders)
          setTrips((prev) => prev.map((t) =>
            t.id === activeTripId ? { ...t, currency: suggestedCurrency } : t
          ));
        }
        
        // If we have an explicit targetCity from the intent sheet, always use
        // apiGeneratePlan so the AI generates places for the correct city.
        // Only use apiGenerateTripItinerary when viewing a saved trip (no new city input).
        if (targetCity) {
          res = await apiGeneratePlan({
            city: targetCity,
            vibe,
            budget,
            days,
            arrival_time: arrivalTime,
            departure_time: departureTime,
            bypass_cache: bypassCache,
          });
        } else if (isAuthenticated && accessToken && activeTripId && activeTripId !== 'trip-default') {
          res = await apiGenerateTripItinerary(activeTripId);
        } else {
          res = await apiGeneratePlan({
            city: targetCity,
            vibe,
            budget,
            days,
            arrival_time: arrivalTime,
            departure_time: departureTime,
            bypass_cache: bypassCache,
          });
        }

        const rawItinerary = res.itinerary || [];
        const daysMap: Record<number, Place[]> = {};
        
        rawItinerary.forEach((item: any) => {
          const d = item.day_number || 1;
          if (!daysMap[d]) daysMap[d] = [];
          
          // Local matching to PLACES database
          const nameLower = (item.name || '').toLowerCase().trim();
          const localMatch = PLACES.find(p => p.name.toLowerCase().trim() === nameLower)
            || PLACES.find(p => nameLower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(nameLower));

          const p: Place = {
            id: `ai-${item.step || Math.random().toString(36).slice(2, 6)}-${d}-${Date.now()}`,
            city: targetCity,
            name: item.name || 'AI Destination',
            category: item.type === 'restaurant' ? 'Foodie' : 'Cultural',
            tags: [item.type || 'destination'],
            vibes: [vibe],
            image: item.image || localMatch?.image || getPlaceImage(targetCity, item.type || 'attraction', item.name),
            cost: item.cost ?? item.price ?? localMatch?.cost ?? 0,
            priceRange: { 
              min: item.cost ?? item.price ?? localMatch?.priceRange.min ?? 0, 
              max: item.cost ?? item.price ?? localMatch?.priceRange.max ?? 0 
            },
            durationMin: item.duration_spent_minutes || localMatch?.durationMin || 60,
            distanceKm: item.travel_time_to_next_minutes ? (item.travel_time_to_next_minutes * 0.4) : (localMatch?.distanceKm || 0.5),
            lat: typeof item.latitude === 'number' && item.latitude !== 0 ? item.latitude : (item.latitude ? parseFloat(item.latitude) : (localMatch?.lat ?? 0)),
            lng: typeof item.longitude === 'number' && item.longitude !== 0 ? item.longitude : (item.longitude ? parseFloat(item.longitude) : (localMatch?.lng ?? 0)),
            rating: item.rating !== undefined && item.rating !== null ? item.rating : (localMatch?.rating ?? 4.5),
            description: item.activity_todo || localMatch?.description || 'Explore the location',
            openingHours: localMatch?.openingHours || '09:00 – 21:00',
            indoor: localMatch?.indoor || false,
            openHour: localMatch?.openHour || 9,
            closeHour: localMatch?.closeHour || 21,
          };
          daysMap[d].push(p);
        });

        // Fix #7: Build planDays from daysMap, then redistribute evenly if some days are empty
        let planDays: Place[][] = [];
        for (let d = 1; d <= days; d++) {
          planDays.push(daysMap[d] || []);
        }

        // Redistribute stops evenly across all days if the distribution is uneven
        // (e.g. AI returns day_number=[1,1,2,2,2] for a 3-day trip, leaving Day 3 empty)
        const allStops = planDays.flat();
        if (allStops.length > 0 && days > 1) {
          const emptyDays = planDays.filter(d => d.length === 0).length;
          const unevenDistribution = planDays.some(d => d.length === 0) || 
            (planDays.filter(d => d.length > 0).length > 0 && 
            Math.max(...planDays.map(d => d.length)) - Math.min(...planDays.filter(d => d.length > 0).map(d => d.length)) > 2);

          if (emptyDays > 0 || unevenDistribution) {
            // Distribusi merata: setiap hari dapat stops yang sama
            const base = Math.floor(allStops.length / days);
            const remainder = allStops.length % days;
            planDays = [];
            let idx = 0;
            for (let d = 0; d < days; d++) {
              const count = base + (d < remainder ? 1 : 0);
              planDays.push(allStops.slice(idx, idx + count));
              idx += count;
            }
          }
        }

        // ── Geocode all places via Nominatim OSM (same as chatbot) ──
        // This gives real coordinates for every stop regardless of what the
        // backend returned — fixing wrong/zero coordinates on the Leaflet map.
        const allRaw = planDays.flat();
        const allGeocoded = await geocodeItineraryPlaces(allRaw, targetCity);

        // Rebuild planDays preserving day grouping, with geocoded coords.
        // Also compute real haversine distanceKm between consecutive stops.
        let gIdx = 0;
        const geocodedDays: Place[][] = planDays.map((dayPlaces) => {
          const geocodedDay: Place[] = [];
          for (let i = 0; i < dayPlaces.length; i++) {
            const gp = allGeocoded[gIdx] ?? dayPlaces[i];
            const nextGp = (i < dayPlaces.length - 1) ? (allGeocoded[gIdx + 1] ?? null) : null;
            gIdx++;
            let distKm = (nextGp && gp.lat && gp.lng && nextGp.lat && nextGp.lng)
              ? haversineKm(gp.lat, gp.lng, nextGp.lat, nextGp.lng)
              : 0;
            // Floor at 0.1 km if sequential stops are identical or extremely close
            if (nextGp && distKm < 0.01) {
              distKm = 0.1;
            }
            geocodedDay.push({ ...gp, distanceKm: distKm });
          }
          return geocodedDay;
        });

        const meta: DayPlan[] = geocodedDays.map(() => ({
          destIdx: 0,
          kind: 'normal',
        }));

        setPerDayItineraries(geocodedDays);
        setPerDayMeta(meta);
        setItinerary(geocodedDays.flat());

      } catch (err) {
        console.error("Failed to generate plan:", err);
        throw err;
      } finally {
        setLoadingPlan(false);
      }
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
    addStop: (p, dayIndex) => {
      setItinerary((cur) => (cur.find((x) => x.id === p.id) ? cur : [...cur, p]));
      if (perDayItineraries.length > 0) {
        const targetDay = (dayIndex !== undefined && dayIndex >= 0 && dayIndex < perDayItineraries.length) ? dayIndex : 0;
        setPerDayItineraries((prev) =>
          prev.map((day, idx) => idx === targetDay && !day.find((x) => x.id === p.id) ? [...day, p] : day)
        );
      }
    },
    // Fix #4: alternatives now prioritizes AI-generated places from itinerary city
    // rather than always pulling from static local PLACES data.
    alternatives: (excludeIds) => {
      // Collect all AI-generated places from perDayItineraries that aren't currently shown
      const aiPoolFromDays = perDayItineraries.flat().filter((p) => !excludeIds.includes(p.id));
      // Also include any itinerary places not in excludeIds
      const aiPoolFromItinerary = itinerary.filter((p) => !excludeIds.includes(p.id));
      // Merge, deduplicate by id, take AI places first
      const seen = new Set<string>();
      const merged: typeof PLACES = [];
      for (const p of [...aiPoolFromDays, ...aiPoolFromItinerary]) {
        if (!seen.has(p.id)) { seen.add(p.id); merged.push(p as any); }
      }
      // Supplement with static PLACES if we don't have enough AI suggestions
      if (merged.length < 8) {
        for (const p of PLACES) {
          if (!excludeIds.includes(p.id) && !seen.has(p.id)) {
            seen.add(p.id);
            merged.push(p);
          }
          if (merged.length >= 8) break;
        }
      }
      return merged.slice(0, 8);
    },

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
      const remaining = trips.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        setTrips([DEFAULT_TRIP]);
        setActiveTripId(DEFAULT_TRIP.id);
      } else {
        setTrips(remaining);
        if (activeTripId === id) {
          setActiveTripId(remaining[0].id);
        }
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
                budget: t.budget * exchangeRate,
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
    savePlace: (p) => {
      setSavedPlaces((cur) => {
        if (cur.find((x) => x.id === p.id)) return cur;
        const next = [...cur, p];
        if (isAuthenticated && accessToken) {
          apiSavePlace(p).catch((err) => console.error("Failed to save place to database:", err));
        }
        return next;
      });
    },
    removeSavedPlace: (id) => {
      setSavedPlaces((cur) => {
        const item = cur.find((p) => p.id === id);
        const next = cur.filter((p) => p.id !== id);
        if (item && isAuthenticated && accessToken) {
          apiDeleteSavedPlace(item.name).catch((err) => console.error("Failed to delete place from database:", err));
        }
        return next;
      });
    },
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
    saveItineraryToBackend,
    activeDay,
    setActiveDay,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
