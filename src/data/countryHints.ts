/**
 * Country → suggested city hints.
 *
 * When the user types a country name into the destination field, we offer a
 * one-tap chip suggesting a specific city — better itineraries come from
 * city-level inputs.
 *
 * Keys are lowercased. Matching is exact (intent sheet calls
 * `COUNTRY_CITY_HINTS[trimmed.toLowerCase()]`). Add entries as needed.
 */

export const COUNTRY_CITY_HINTS: Record<string, string> = {
  thailand: 'Bangkok',
  japan: 'Tokyo',
  france: 'Paris',
  indonesia: 'Bali',
  spain: 'Barcelona',
  italy: 'Rome',
  'united kingdom': 'London',
  england: 'London',
  'united states': 'New York',
  america: 'New York',
  usa: 'New York',
  australia: 'Sydney',
  'south korea': 'Seoul',
  korea: 'Seoul',
  vietnam: 'Hanoi',
  mexico: 'Mexico City',
  india: 'Mumbai',
  greece: 'Athens',
  portugal: 'Lisbon',
  netherlands: 'Amsterdam',
  germany: 'Berlin',
};
