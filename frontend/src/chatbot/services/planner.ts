/**
 * planner.ts — Travel plan builder
 *
 * Takes AI-suggested places + geocoded coords, then:
 *   1. Geocodes hotel if provided (Nominatim)
 *   2. Sorts stops with Pythagorean hotel-anchor pattern
 *      (closest → farthest → closest pattern around hotel)
 *   3. Estimates travel time via haversine (avg 25 km/h city speed)
 *   4. Assigns arrival times starting from start_time
 *   5. Caps travel time at 60 min, filters outliers > 200 km from city center
 */

import type { ChatPlace, ItineraryStop, TravelPlan } from '../types';
import { haversineKm, getCityCenter, geocodeName } from './geocoding';

const AVG_CITY_SPEED_KMH = 25;
const MAX_TRAVEL_MIN     = 60;
const MAX_DIST_FROM_CITY = 200; // km — outlier filter

// ─── Time helpers ─────────────────────────────────────────────────────────────

function parseTime(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
}

function formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    // Round to nearest 5 min for human-friendly output
    const mRounded = Math.round(m / 5) * 5;
    return `${String(h).padStart(2, '0')}:${String(mRounded % 60).padStart(2, '0')}`;
}

function travelMinutes(distKm: number): number {
    return Math.min(MAX_TRAVEL_MIN, Math.round((distKm / AVG_CITY_SPEED_KMH) * 60));
}

// ─── Hotel-anchored sort ──────────────────────────────────────────────────────

/**
 * Pythagorean routing: nearest place first (check-in / drop bags),
 * farthest places in the middle of day, nearest again at end (easy return).
 */
function sortByHotelProximity(
    places: ChatPlace[],
    hotel: { lat: number; lon: number },
): ChatPlace[] {
    const withDist = places.map((p) => ({
        place: p,
        dist: p.lat != null && p.lon != null
        ? haversineKm(hotel.lat, hotel.lon, p.lat, p.lon)
        : 999,
    }));

    withDist.sort((a, b) => a.dist - b.dist);
    const n = withDist.length;
    if (n <= 2) return withDist.map((x) => x.place);

    // Interleave: near, far, ..., near
    const sorted: ChatPlace[] = [];
    let lo = 0, hi = n - 1;
    let takeFromLow = true;
    while (lo <= hi) {
        if (takeFromLow) sorted.push(withDist[lo++].place);
        else             sorted.push(withDist[hi--].place);
        takeFromLow = !takeFromLow;
    }
    return sorted;
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateTravelPlan(
    city: string,
    places: ChatPlace[],
    startTime: string = '09:00',
    hotelName?: string | null,
): Promise<TravelPlan> {
    const center = await getCityCenter(city);

    // Filter places too far from city center (cross-continent geocode misfire)
    const nearby = center
    ? places.filter((p) => {
        if (p.lat == null || p.lon == null) return true; // ungeocoded — keep
        return haversineKm(center.lat, center.lon, p.lat, p.lon) <= MAX_DIST_FROM_CITY;
    })
    : places;

    // Geocode hotel if provided
    let hotel: { name: string; lat: number; lon: number } | undefined;
    if (hotelName) {
        const coords = await geocodeName(hotelName, city);
        if (coords) {
            hotel = { name: hotelName, ...coords };
        }
    }

    // Sort stops around hotel
    const sorted = hotel ? sortByHotelProximity(nearby, hotel) : nearby;

    // Build timeline
    let cursor = parseTime(startTime);
    const stops: ItineraryStop[] = sorted.map((p, i) => {
        const arrival_time = formatTime(cursor);

        // Duration by type
        const durationMap: Record<string, number> = {
            restaurant: 60,
            hotel: 30,
            attraction: 75,
            destination: 90,
        };
        const duration_minutes = durationMap[p.type] ?? 75;

        // Travel to next
        let travel_time_to_next_minutes = 15; // default
        if (i < sorted.length - 1) {
            const next = sorted[i + 1];
            if (p.lat != null && p.lon != null && next.lat != null && next.lon != null) {
                const dist = haversineKm(p.lat, p.lon, next.lat, next.lon);
                travel_time_to_next_minutes = travelMinutes(dist);
            }
        }

        cursor += duration_minutes + travel_time_to_next_minutes;

        return {
            step: i + 1,
            name: p.name,
            type: p.type,
            arrival_time,
            duration_minutes,
            travel_time_to_next_minutes: i < sorted.length - 1 ? travel_time_to_next_minutes : 0,
            description: p.description,
            lat: p.lat,
            lon: p.lon,
            address: p.address,
        };
    });

    return { city, hotel, stops };
}
