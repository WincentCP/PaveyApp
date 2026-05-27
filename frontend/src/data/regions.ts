// Lightweight, intentionally fuzzy region lookup.
// Unsupported cities resolve to null — chaos detection silently skips them
// rather than misclassifying. No alias map, no spelling correction.
// To support a new city, add a single lowercase key here.

export type Region =
  | 'Southeast Asia'
  | 'East Asia'
  | 'South Asia'
  | 'Europe'
  | 'North America'
  | 'Oceania'
  | 'Middle East'
  | 'Latin America'
  | 'Africa';

export const REGIONS: Record<string, Region> = {
  // Southeast Asia
  bali: 'Southeast Asia',
  ubud: 'Southeast Asia',
  bangkok: 'Southeast Asia',
  thailand: 'Southeast Asia',
  phuket: 'Southeast Asia',
  'chiang mai': 'Southeast Asia',
  hanoi: 'Southeast Asia',
  'ho chi minh': 'Southeast Asia',
  vietnam: 'Southeast Asia',
  singapore: 'Southeast Asia',
  'kuala lumpur': 'Southeast Asia',
  malaysia: 'Southeast Asia',
  indonesia: 'Southeast Asia',
  jakarta: 'Southeast Asia',
  manila: 'Southeast Asia',
  philippines: 'Southeast Asia',

  // East Asia
  tokyo: 'East Asia',
  kyoto: 'East Asia',
  osaka: 'East Asia',
  japan: 'East Asia',
  seoul: 'East Asia',
  'south korea': 'East Asia',
  korea: 'East Asia',
  busan: 'East Asia',
  taipei: 'East Asia',
  taiwan: 'East Asia',
  'hong kong': 'East Asia',
  shanghai: 'East Asia',
  beijing: 'East Asia',
  china: 'East Asia',

  // South Asia
  mumbai: 'South Asia',
  delhi: 'South Asia',
  india: 'South Asia',
  goa: 'South Asia',
  kathmandu: 'South Asia',
  colombo: 'South Asia',

  // Europe
  paris: 'Europe',
  france: 'Europe',
  rome: 'Europe',
  milan: 'Europe',
  venice: 'Europe',
  florence: 'Europe',
  italy: 'Europe',
  barcelona: 'Europe',
  madrid: 'Europe',
  spain: 'Europe',
  london: 'Europe',
  'united kingdom': 'Europe',
  england: 'Europe',
  edinburgh: 'Europe',
  amsterdam: 'Europe',
  netherlands: 'Europe',
  berlin: 'Europe',
  munich: 'Europe',
  germany: 'Europe',
  lisbon: 'Europe',
  porto: 'Europe',
  portugal: 'Europe',
  athens: 'Europe',
  greece: 'Europe',
  prague: 'Europe',
  vienna: 'Europe',
  budapest: 'Europe',
  copenhagen: 'Europe',
  stockholm: 'Europe',
  oslo: 'Europe',
  dublin: 'Europe',
  zurich: 'Europe',

  // North America
  'new york': 'North America',
  nyc: 'North America',
  'los angeles': 'North America',
  la: 'North America',
  'san francisco': 'North America',
  chicago: 'North America',
  miami: 'North America',
  boston: 'North America',
  seattle: 'North America',
  'las vegas': 'North America',
  toronto: 'North America',
  vancouver: 'North America',
  montreal: 'North America',
  usa: 'North America',
  'united states': 'North America',
  america: 'North America',
  canada: 'North America',

  // Oceania
  sydney: 'Oceania',
  melbourne: 'Oceania',
  brisbane: 'Oceania',
  australia: 'Oceania',
  auckland: 'Oceania',
  'new zealand': 'Oceania',

  // Middle East
  dubai: 'Middle East',
  'abu dhabi': 'Middle East',
  uae: 'Middle East',
  istanbul: 'Middle East',
  turkey: 'Middle East',

  // Latin America
  'mexico city': 'Latin America',
  cancun: 'Latin America',
  mexico: 'Latin America',
  'buenos aires': 'Latin America',
  argentina: 'Latin America',
  'rio de janeiro': 'Latin America',
  brazil: 'Latin America',
  lima: 'Latin America',
  peru: 'Latin America',

  // Africa
  cairo: 'Africa',
  egypt: 'Africa',
  marrakech: 'Africa',
  morocco: 'Africa',
  'cape town': 'Africa',
  'south africa': 'Africa',
  nairobi: 'Africa',
};

// Fuzzy lookup: lowercase input, return first key it includes()
// e.g. "Bangkok, Thailand" matches "bangkok" → 'Southeast Asia'
export function getRegion(cityName: string): Region | null {
  if (!cityName) return null;
  const q = cityName.toLowerCase();
  for (const key of Object.keys(REGIONS)) {
    if (q.includes(key)) return REGIONS[key];
  }
  return null;
}

export function countDistinctRegions(destNames: string[]): number {
  const set = new Set<Region>();
  for (const n of destNames) {
    const r = getRegion(n);
    if (r) set.add(r);
  }
  return set.size;
}

// Modal region; ties broken by first-seen order
export function suggestPrimaryRegion(destNames: string[]): Region | null {
  const counts = new Map<Region, number>();
  const firstSeen = new Map<Region, number>();
  destNames.forEach((n, i) => {
    const r = getRegion(n);
    if (!r) return;
    counts.set(r, (counts.get(r) ?? 0) + 1);
    if (!firstSeen.has(r)) firstSeen.set(r, i);
  });
  if (counts.size === 0) return null;
  let best: Region | null = null;
  let bestCount = -1;
  for (const [r, c] of counts) {
    if (c > bestCount || (c === bestCount && (firstSeen.get(r) ?? 0) < (firstSeen.get(best!) ?? 0))) {
      best = r;
      bestCount = c;
    }
  }
  return best;
}
