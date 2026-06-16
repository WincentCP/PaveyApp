import type { ChatPlace } from '../types';

export async function geocodeName(
    name: string,
    cityContext: string,
): Promise<{ lat: number; lon: number } | null> {
    const query = `${name}, ${cityContext}`;
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
                                { headers: { 'Accept-Language': 'en', 'User-Agent': 'PaveyApp/1.0' } },
        );
        const data = await res.json();
        if (!data[0]) return null;

        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        // Sanity: cross-continent check
        const center = await getCityCenter(cityContext);
        if (center && haversineKm(lat, lon, center.lat, center.lon) > 200) return null;

        return { lat, lon };
    } catch {
        return null;
    }
}

export async function getCityCenter(
    city: string,
): Promise<{ lat: number; lon: number } | null> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
                                { headers: { 'Accept-Language': 'en', 'User-Agent': 'PaveyApp/1.0' } },
        );
        const data = await res.json();
        if (!data[0]) return null;
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    } catch {
        return null;
    }
}

/** Sequential geocoding — respects Nominatim 1 req/sec limit */
export async function enrichPlaces(
    places: ChatPlace[],
    cityContext: string,
): Promise<ChatPlace[]> {
    const results: ChatPlace[] = [];
    for (const p of places) {
        const coords = await geocodeName(p.name, cityContext);
        results.push(coords ? { ...p, ...coords } : p);
        await sleep(350); // stay under 1 req/sec
    }
    return results;
}

export async function searchHotelsOSM(city: string): Promise<ChatPlace[]> {
    const center = await getCityCenter(city);
    if (!center) return [];

    const radius = 15000;
    const query = `[out:json][timeout:20];(node["tourism"="hotel"](around:${radius},${center.lat},${center.lon});node["tourism"="hostel"](around:${radius},${center.lat},${center.lon});node["tourism"="guest_house"](around:${radius},${center.lat},${center.lon}););out body 10;`;

    try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`,
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        const data = await res.json();

        return (data.elements as Record<string, unknown>[])
        .filter((el) => el.tags && (el.tags as Record<string, string>).name)
        .slice(0, 8)
        .map((el) => {
            const tags = el.tags as Record<string, string>;
            return {
                name: tags.name,
                type: 'hotel' as const,
                category: tags.tourism ?? 'hotel',
                address: [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']]
                .filter(Boolean).join(' ') || city,
             lat: el.lat as number,
             lon: el.lon as number,
             website: tags.website,
             phone: tags.phone,
            };
        });
    } catch {
        return [];
    }
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}
