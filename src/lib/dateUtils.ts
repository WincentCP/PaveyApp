/**
 * Date utilities for trip planning.
 *
 * Centralizes the small date math that was inlined across HomePage / GeneratePage.
 * Backend devs: these mirror what a server-side scheduler would compute — keep the
 * semantics identical when porting.
 */

export const MS_PER_DAY = 86_400_000;

/**
 * Inclusive trip duration in days between two ISO date strings.
 * - Single day (start === end) → 1
 * - Always returns >= 1
 *
 * Example: tripDurationDays('2026-06-01', '2026-06-03') === 3
 */
export function tripDurationDays(startISO: string, endISO: string): number {
  if (!startISO || !endISO) return 1;
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  return Math.max(1, Math.round((end - start) / MS_PER_DAY) + 1);
}

/**
 * True when the given ISO date is strictly before today (local time).
 * Used for the past-date soft warning in the intent sheet.
 */
export function isPastDate(iso: string): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date(new Date().toDateString());
}

/**
 * Today as ISO yyyy-mm-dd (local).
 */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
