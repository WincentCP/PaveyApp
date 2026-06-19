/**
 * planner.ts — Hotel-anchored itinerary builder
 *
 * Pythagorean proximity pattern:
 *   - Stop 1 and Stop N: closest to hotel
 *   - Middle stops: farthest from hotel
 *   - e.g. 5 stops: [nearest, 2nd near, FARTHEST, 2nd near, nearest]
 *
 * This ensures easy start & return, no backtracking, max coverage mid-day.
 */

import type { ChatPlace, ItineraryStop, TravelPlan } from '../types';
import { haversineKm, getCityCenter, geocodeName } from './geocoding';

const AVG_SPEED_KMH = 25;
const MAX_TRAVEL_MIN = 60;

function parseTime(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
}

function formatTime(totalMin: number): string {
    const h = Math.floor(totalMin / 60) % 24;
    const m = Math.round((totalMin % 60) / 5) * 5;
    return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function travelMin(km: number): number {
    return Math.min(MAX_TRAVEL_MIN, Math.round((km / AVG_SPEED_KMH) * 60));
}

/**
 * Sort places using Pythagorean hotel-anchor pattern.
 * nearest, 3rd-nearest, 5th... FARTHEST ...4th, 2nd, nearest
 * So the route goes: close → middle → far → middle → close
 */
function hotelAnchorSort(places: ChatPlace[], hotel: { lat: number; lon: number }): ChatPlace[] {
    const withDist = places
    .map((p) => ({
        place: p,
        dist:
        p.lat != null && p.lon != null
        ? haversineKm(hotel.lat, hotel.lon, p.lat, p.lon)
        : 999,
    }))
    .sort((a, b) => a.dist - b.dist);

    const n = withDist.length;
    if (n <= 2) return withDist.map((x) => x.place);

    // Build pattern: interleave from both ends so near→far→near
    // Result indices: 0, n-1, 1, n-2, 2, n-3 ...
    const result: ChatPlace[] = [];
    let lo = 0;
    let hi = n - 1;
    let fromLo = true;

    while (lo <= hi) {
        if (fromLo) result.push(withDist[lo++].place);
        else result.push(withDist[hi--].place);
        fromLo = !fromLo;
    }

    return result;
}

export async function generateTravelPlan(
    city: string,
    places: ChatPlace[],
    startTime = '09:00',
    hotelName?: string | null,
): Promise<TravelPlan> {
    const center = await getCityCenter(city);

    // Filter obvious misfires
    const nearby = center
    ? places.filter((p) => {
        if (p.lat == null || p.lon == null) return true;
        return haversineKm(center.lat, center.lon, p.lat, p.lon) <= 80;
    })
    : places;

    let hotel: { name: string; lat: number; lon: number } | undefined;
    if (hotelName) {
        const coords = await geocodeName(hotelName, city);
        if (coords) hotel = { name: hotelName, ...coords };
    }

    const sorted = hotel ? hotelAnchorSort(nearby, hotel) : nearby;

    const durationByType: Record<string, number> = {
        restaurant: 60,
        hotel: 30,
        attraction: 75,
        destination: 90,
    };

    let cursor = parseTime(startTime);
    const stops: ItineraryStop[] = sorted.map((p, i) => {
        const arrival_time = formatTime(cursor);
        const duration_minutes = durationByType[p.type] ?? 75;

        let travel_time_to_next_minutes = 15;
        if (i < sorted.length - 1) {
            const next = sorted[i + 1];
            if (p.lat != null && p.lon != null && next.lat != null && next.lon != null) {
                travel_time_to_next_minutes = travelMin(haversineKm(p.lat, p.lon, next.lat, next.lon));
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
