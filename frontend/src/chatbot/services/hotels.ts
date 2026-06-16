/**
 * hotels.ts — Hotel search
 * Level 1: TripAdvisor via RapidAPI  (VITE_RAPIDAPI_KEY required)
 * Level 2: Overpass OSM              (no key, open source)
 * Level 3: Curated mock data         (always returns something)
 */

import type { ChatPlace } from '../types';
import { searchHotelsOSM } from './geocoding';

const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY as string | undefined;

// ─── Level 1: TripAdvisor ─────────────────────────────────────────────────────

async function searchTripAdvisor(city: string): Promise<ChatPlace[]> {
    if (!RAPIDAPI_KEY) throw new Error('No RapidAPI key');

    const locationRes = await fetch(
        `https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchLocation?query=${encodeURIComponent(city)}`,
                                    {
                                        headers: {
                                            'x-rapidapi-key': RAPIDAPI_KEY,
                                            'x-rapidapi-host': 'tripadvisor16.p.rapidapi.com',
                                        },
                                    },
    );
    if (!locationRes.ok) throw new Error(`TA location ${locationRes.status}`);
    const locData = await locationRes.json();
    const geoId: string | undefined = locData.data?.[0]?.geoId;
    if (!geoId) throw new Error('No geoId');

    const hotelsRes = await fetch(
        `https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchHotels?geoId=${geoId}&checkIn=2025-01-01&checkOut=2025-01-02&adults=1`,
        {
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': 'tripadvisor16.p.rapidapi.com',
            },
        },
    );
    if (!hotelsRes.ok) throw new Error(`TA hotels ${hotelsRes.status}`);
    const hotelsData = await hotelsRes.json();

    return ((hotelsData.data?.data as Record<string, unknown>[]) ?? [])
    .slice(0, 6)
    .map((h) => ({
        name: h.title as string,
        type: 'hotel' as const,
        category: 'hotel',
        description: (h.primaryInfo as string) ?? '',
                 rating: h.bubbleRating
                 ? parseFloat((h.bubbleRating as Record<string, string>).rating)
                 : undefined,
                 priceRange: (h.priceForDisplay as string) ?? undefined,
    }));
}

// ─── Level 3: Mock data ───────────────────────────────────────────────────────

function mockHotels(city: string): ChatPlace[] {
    return [
        {
            name: `${city} Grand Hotel`,
            type: 'hotel',
            category: 'hotel',
            description: 'A comfortable stay in the heart of the city.',
            rating: 4.2,
        },
        {
            name: `${city} Budget Inn`,
            type: 'hotel',
            category: 'hostel',
            description: 'Affordable rooms with all essential amenities.',
            rating: 3.8,
        },
        {
            name: `${city} Boutique Suites`,
            type: 'hotel',
            category: 'guest_house',
            description: 'Charming boutique property with local character.',
            rating: 4.5,
        },
    ];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function searchHotels(city: string): Promise<ChatPlace[]> {
    // Level 1: TripAdvisor
    try {
        const results = await searchTripAdvisor(city);
        if (results.length > 0) return results;
    } catch {
        // fall through
    }

    // Level 2: OSM Overpass
    try {
        const osmResults = await searchHotelsOSM(city);
        if (osmResults.length > 0) return osmResults;
    } catch {
        // fall through
    }

    // Level 3: Mock — always returns something so UI never goes blank
    return mockHotels(city);
}
