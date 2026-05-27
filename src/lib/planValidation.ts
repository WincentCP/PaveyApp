/**
 * Plan-intent validation rules — pure, declarative, no JSX.
 *
 * Centralizes the warning logic that the intent sheet shows below the form.
 * The function returns at most one "major" and one "secondary" banner key.
 * HomePage maps those keys to JSX. Keeping rules data-shaped (not JSX) means:
 *   - backend can mirror the same rules server-side (e.g. for /plan validation)
 *   - new rules slot in without touching React tree
 *   - tests are trivial: feed an input, assert keys
 *
 * Priority ladder (highest first):
 *   MAJOR
 *     1. regional chaos — 3+ regions in tight window
 *     2. cross-region cluster — 4+ cities across multiple regions, <2 days each
 *     3. duration ≥ 46 (severe)
 *     4. duration ≥ 31
 *     5. duration ≥ 21
 *     6. multi-city ratio < 1 (days < cities)
 *   SECONDARY
 *     1. duration 14–20 (clustering tip)
 *     2. multi-city ratio in [1, 2)
 *
 * Hard errors (missing dest, end<start, duplicate) are handled separately at
 * the input layer — they are field-attached and not part of this banner stack.
 * Interactive warnings (overlap dates, single-day confirm) live in their own
 * action flows.
 */

import { countDistinctRegions, getRegion, suggestPrimaryRegion, type Region } from '../data/regions';

/**
 * Strict maximum trip duration. Trips beyond this are hard-blocked at the
 * generate button — `TripTooLongModal` explains why and offers next steps.
 * Backend should mirror this cap on the /plan endpoint.
 */
export const MAX_TRIP_DAYS = 30;

/** Returns true when a trip exceeds the supported planning window. */
export function exceedsMaxDuration(days: number): boolean {
  return days > MAX_TRIP_DAYS;
}

/** Returns true when more cities than days — generation produces an unusable plan. */
export function isOverDense(citiesCount: number, days: number): boolean {
  return citiesCount > 1 && citiesCount > days;
}

export type MajorBannerKey =
  | 'chaos-regions'
  | 'chaos-cities'
  | 'duration-over-20'
  | 'ratio-under-1';

export type SecondaryBannerKey =
  | 'duration-14-20'
  | 'ratio-1-to-2';

export interface IntentBannerInput {
  /** Calculated inclusive day count for the trip. 0 means "no dates set yet". */
  durationDays: number;
  /** Destination names exactly as stored (e.g. "Bangkok, Thailand"). */
  destinationNames: string[];
}

export interface IntentBanners {
  major?: {
    key: MajorBannerKey;
    /** Suggested primary region — only set when the rule should offer a "Keep only X" action. */
    primaryRegion?: Region;
    /** Variables the UI can interpolate into copy. */
    vars: { days: number; cities: number; regions: number };
  };
  secondary?: {
    key: SecondaryBannerKey;
    vars: { days: number; cities: number };
  };
}

/**
 * Compute which banners (if any) to show in the intent sheet.
 * Pure function. UI renders by switching on the returned keys.
 */
export function computeIntentBanners(input: IntentBannerInput): IntentBanners {
  const { durationDays: days, destinationNames } = input;
  const out: IntentBanners = {};
  if (!days) return out;

  const cities = destinationNames.length;
  const regions = countDistinctRegions(destinationNames);
  const primary = suggestPrimaryRegion(destinationNames) ?? undefined;
  const ratio = cities > 0 ? days / cities : Infinity;

  // ── Major (pick first match in priority order) ─────
  // Note: durations > MAX_TRIP_DAYS are hard-blocked at the button level
  // (see TripTooLongModal). They never appear as soft banners.
  if (regions >= 3 && days <= regions * 4) {
    out.major = { key: 'chaos-regions', primaryRegion: primary, vars: { days, cities, regions } };
  } else if (regions >= 2 && cities >= 4 && ratio < 2) {
    out.major = { key: 'chaos-cities', primaryRegion: primary, vars: { days, cities, regions } };
  } else if (days >= 21 && days <= MAX_TRIP_DAYS) {
    out.major = { key: 'duration-over-20', vars: { days, cities, regions } };
  } else if (cities > 1 && ratio < 1) {
    out.major = { key: 'ratio-under-1', vars: { days, cities, regions } };
  }

  // ── Secondary (independent of major) ──────────────
  if (days >= 14 && days <= 20) {
    out.secondary = { key: 'duration-14-20', vars: { days, cities } };
  } else if (cities > 1 && ratio >= 1 && ratio < 2) {
    out.secondary = { key: 'ratio-1-to-2', vars: { days, cities } };
  }

  return out;
}

/**
 * Filter a destination list down to only those whose region matches `region`.
 * Used by the "Keep only {region}" action on chaos banners.
 * Returns the filtered list — caller decides whether to apply.
 */
export function filterDestinationsByRegion<T extends { name: string }>(
  destinations: T[],
  region: Region,
): T[] {
  return destinations.filter((d) => getRegion(d.name) === region);
}
