import type { ChatPlace } from '../types';
import { searchHotelsOSM } from './geocoding';

const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY as string | undefined;

async function searchTripAdvisor(city: string): Promise<ChatPlace[]> {
    if (!RAPIDAPI_KEY) throw new Error('no key');
    const locRes = await fetch(
        `https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchLocation?query=${encodeURIComponent(city)}`,
                               { headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': 'tripadvisor16.p.rapidapi.com' } },
    );
    if (!locRes.ok) throw new Error('ta loc fail');
    const locData = await locRes.json();
    const geoId: string | undefined = locData.data?.[0]?.geoId;
    if (!geoId) throw new Error('no geoId');

    const hRes = await fetch(
        `https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchHotels?geoId=${geoId}&checkIn=2025-01-01&checkOut=2025-01-02&adults=1`,
        { headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': 'tripadvisor16.p.rapidapi.com' } },
    );
    if (!hRes.ok) throw new Error('ta hotels fail');
    const hData = await hRes.json();

    return ((hData.data?.data as Record<string, unknown>[]) ?? []).slice(0, 6).map((h) => ({
        name: h.title as string,
        type: 'hotel' as const,
        category: 'hotel',
        description: (h.primaryInfo as string) ?? '',
                                                                                           rating: h.bubbleRating ? parseFloat((h.bubbleRating as Record<string, string>).rating) : undefined,
                                                                                           priceRange: (h.priceForDisplay as string) ?? undefined,
    }));
}

function mockHotels(city: string): ChatPlace[] {
    return [
        { name: `${city} Grand Hotel`, type: 'hotel', category: 'hotel', description: 'Comfortable stay in the heart of the city.', rating: 4.2 },
        { name: `${city} Budget Inn`, type: 'hotel', category: 'hostel', description: 'Affordable rooms with essential amenities.', rating: 3.8 },
        { name: `${city} Boutique Suites`, type: 'hotel', category: 'guest_house', description: 'Charming boutique property with local character.', rating: 4.5 },
    ];
}

export async function searchHotels(city: string): Promise<ChatPlace[]> {
    try { const r = await searchTripAdvisor(city); if (r.length) return r; } catch { /* fall */ }
    try { const r = await searchHotelsOSM(city); if (r.length) return r; } catch { /* fall */ }
    return mockHotels(city);
}
