/**
 * Day density check — pure helper used both by the existing density warning
 * and the new Add-recommendation feasibility prompt.
 *
 * Mirrors the rules already in GeneratePage's inline density banner:
 *   - too many stops on the day
 *   - too far between them (km)
 *   - too long total activity (min)
 *
 * Returns a single tight flag + a short reason string. Pure TS, no React —
 * backend can mirror these thresholds for its own /plan validation.
 */

export interface DensityStop {
  distanceKm: number;
  durationMin: number;
}

const MAX_STOPS = 5;
const MAX_DISTANCE_KM = 30;
const MAX_DURATION_MIN = 600;

export function dayIsTight(stops: DensityStop[]): { tight: boolean; reason: string } {
  const tooMany = stops.length > MAX_STOPS;
  const totalDist = stops.reduce((s, p) => s + (p.distanceKm || 0), 0);
  const totalTime = stops.reduce((s, p) => s + (p.durationMin || 0), 0);
  const farApart = totalDist > MAX_DISTANCE_KM;
  const tooLong = totalTime > MAX_DURATION_MIN;
  if (!tooMany && !farApart && !tooLong) return { tight: false, reason: '' };

  const reason = tooMany
    ? `${stops.length} stops`
    : farApart
      ? `${totalDist.toFixed(0)} km of travel`
      : `${Math.round(totalTime / 60)}h of activity`;
  return { tight: true, reason };
}
