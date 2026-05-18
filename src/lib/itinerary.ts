/**
 * Itinerary planning engine — pure functions, no React, no state.
 *
 * This file is the "planning brain" of the app. When this project migrates to a
 * backend, the natural API boundary is:
 *
 *     POST /plan  →  body: GenerateInput   →  response: GenerateResult
 *
 * AppContext is a thin wrapper that feeds React state into `generateItinerary`
 * and stores the result. Replacing this file with `await api.plan(input)` is the
 * single-file migration path.
 *
 * Functions exported here MUST stay pure:
 *   - no React imports
 *   - no global mutation
 *   - same input → same output (modulo Place selection from PLACES)
 */

import type { Place, Vibe } from '../data/places';
import { pickDayItinerary } from '../data/places';

/* ── Pace ─────────────────────────────────────────── */

export type TripPace = 'relaxed' | 'balanced' | 'fast';

export const PACE_STOPS: Record<TripPace, number> = {
  relaxed: 2,
  balanced: 3,
  fast: 4,
};

/* ── Day plan ─────────────────────────────────────── */

export type DayKind = 'normal' | 'travel' | 'arrival' | 'departure';

export interface DayPlan {
  /** Index into the destinations array that this day belongs to. */
  destIdx: number;
  kind: DayKind;
  /** Travel days only — origin city short name. */
  fromCity?: string;
  /** Travel days only — destination city short name. */
  toCity?: string;
}

/**
 * Minimal Destination shape consumed by the planner.
 * Mirrors the `Destination` type in AppContext but only the fields the engine
 * needs — keeps the planner decoupled from the wider state shape.
 */
export interface PlannerDestination {
  name: string;
  days?: number;
  arriveDate?: string;
  departDate?: string;
}

/**
 * Allocate `totalDays` across the given destinations. Inserts exactly one
 * travel day between each adjacent pair of destinations.
 *
 * Allocation strategy:
 *   - Per-destination weight = (departDate - arriveDate) span if both set,
 *     otherwise `dest.days` (or 1).
 *   - planDays = totalDays - travelDays, distributed proportionally with a
 *     floor of 1 per destination.
 *   - If totalDays is smaller than destinations.length, the tail is truncated.
 */
export function allocateDays(
  destinations: PlannerDestination[],
  totalDays: number,
): DayPlan[] {
  if (destinations.length <= 1 || totalDays <= 0) {
    return Array.from({ length: totalDays }, () => ({ destIdx: 0, kind: 'normal' as const }));
  }

  const weights = destinations.map((d) => {
    if (d.arriveDate && d.departDate) {
      const span = Math.max(1, Math.round(
        (new Date(d.departDate).getTime() - new Date(d.arriveDate).getTime()) / 86_400_000,
      ));
      return span;
    }
    return Math.max(1, d.days || 1);
  });

  const travelDays = destinations.length - 1;
  const planDays = Math.max(destinations.length, totalDays - travelDays);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const allocPerDest = weights.map((w) =>
    Math.max(1, Math.round((w / weightSum) * planDays)),
  );

  // Reconcile to planDays exactly
  let allocSum = allocPerDest.reduce((a, b) => a + b, 0);
  let i = 0;
  const cap = 1000; // safety cap on reconciliation loop
  while (allocSum > planDays && i < cap) {
    const idx = i % destinations.length;
    if (allocPerDest[idx] > 1) {
      allocPerDest[idx] -= 1;
      allocSum -= 1;
    }
    i += 1;
  }
  while (allocSum < planDays && i < cap) {
    allocPerDest[i % destinations.length] += 1;
    allocSum += 1;
    i += 1;
  }

  const plan: DayPlan[] = [];
  for (let dIdx = 0; dIdx < destinations.length; dIdx++) {
    if (dIdx > 0 && plan.length < totalDays) {
      plan.push({
        destIdx: dIdx,
        kind: 'travel',
        fromCity: destinations[dIdx - 1].name.split(',')[0],
        toCity: destinations[dIdx].name.split(',')[0],
      });
    }
    for (let k = 0; k < allocPerDest[dIdx] && plan.length < totalDays; k++) {
      plan.push({ destIdx: dIdx, kind: 'normal' });
    }
  }
  while (plan.length < totalDays) {
    plan.push({ destIdx: destinations.length - 1, kind: 'normal' });
  }
  return plan.slice(0, totalDays);
}

/* ── Stop count per day ───────────────────────────── */

/**
 * How many stops the planner should attempt to schedule for a given day.
 *
 * Applies, in order:
 *   1. Pace baseline (PACE_STOPS) + 1 if vibe is 'activities'.
 *   2. Arrival/departure time taper (late arrival → fewer stops).
 *   3. Recovery-day rule: the day right after a travel day gets one fewer.
 */
export function computeMaxStops(args: {
  dayIndex: number;
  totalDays: number;
  pace: TripPace;
  vibe: Vibe;
  arrivalTime: string;
  departureTime: string;
  prevWasTravel: boolean;
}): number {
  const { dayIndex, totalDays, pace, vibe, arrivalTime, departureTime, prevWasTravel } = args;
  let max = PACE_STOPS[pace] + (vibe === 'activities' ? 1 : 0);

  if (dayIndex === 0) {
    const h = parseInt(arrivalTime.split(':')[0]);
    if (h >= 18) max = 0;
    else if (h >= 15) max = 1;
    else if (h >= 12) max = 2;
  }
  if (dayIndex === totalDays - 1 && totalDays > 1) {
    const h = parseInt(departureTime.split(':')[0]);
    if (h <= 10) max = 0;
    else if (h <= 12) max = 1;
    else if (h <= 14) max = 2;
  }
  if (prevWasTravel && max > 1) max -= 1;

  return max;
}

/* ── Top-level generation entrypoint ──────────────── */

export interface GenerateInput {
  destinations: PlannerDestination[];
  /** Index of the user's "currently active" destination — used as fallback when allocation yields none. */
  activeDestIdx: number;
  totalDays: number;
  pace: TripPace;
  vibe: Vibe;
  budget: number;
  rainyDayMode: boolean;
  arrivalTime: string;
  departureTime: string;
}

export interface GenerateResult {
  /** Per-day list of stops. Travel days are intentionally `[]` — EmptyDayCard renders them. */
  days: Place[][];
  /** Per-day metadata (kind / cities). Same length as `days`. */
  meta: DayPlan[];
}

/**
 * Build a full multi-day itinerary. Pure function. No state writes.
 *
 * Migration note: a backend replacement would take `GenerateInput` as the
 * request body and return `GenerateResult`. AppContext.buildFullItinerary
 * is the only consumer.
 */
export function generateItinerary(input: GenerateInput): GenerateResult {
  const {
    destinations, activeDestIdx, totalDays, pace, vibe, budget,
    rainyDayMode, arrivalTime, departureTime,
  } = input;

  const usedIds = new Set<string>();
  const allocation = allocateDays(destinations, totalDays);
  const fallbackCity = destinations[activeDestIdx]?.name;

  const days: Place[][] = [];
  const meta: DayPlan[] = [];

  for (let d = 0; d < totalDays; d++) {
    const slot = allocation[d] ?? { destIdx: activeDestIdx, kind: 'normal' as const };
    const prevWasTravel = d > 0 && allocation[d - 1]?.kind === 'travel';

    // Travel days are intentionally unscheduled — UI renders a light suggestion.
    if (slot.kind === 'travel') {
      days.push([]);
      meta.push(slot);
      continue;
    }

    const maxStops = computeMaxStops({
      dayIndex: d,
      totalDays,
      pace,
      vibe,
      arrivalTime,
      departureTime,
      prevWasTravel,
    });

    const cityForDay = destinations[slot.destIdx]?.name ?? fallbackCity;
    const dayStops = maxStops === 0
      ? []
      : pickDayItinerary(vibe, budget, d, usedIds, maxStops, rainyDayMode, cityForDay);
    dayStops.forEach((p) => usedIds.add(p.id));
    days.push(dayStops);
    meta.push(slot);
  }

  return { days, meta };
}
