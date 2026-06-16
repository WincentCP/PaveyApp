/**
 * geocoding.ts — Nominatim (OSM) geocoding + Overpass place search
 * 100% open source, no API key required.
 */

import type { ChatPlace } from '../types';

// ─── Nominatim: name → coords ─────────────────────────────────────────────────

export async function geocodeName(
    name: string,
    cityContext: string,
): Promise<{ lat: number; lon: number } | null> {
    const query = `${name} ${cityContext}`;
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`,
                                { headers: { 'Accept-Language': 'en', 'User-Agent': 'PaveyApp/1.0' } },
        );
        const data = await res.json();
        if (!data[0]) return null;

        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        // Sanity check: city center lookup
        const center = await getCityCenter(cityContext);
        if (center) {
            const dist = haversineKm(lat, lon, center.lat, center.lon);
            if (dist > 200) return null; // Cross-continent misfire protection
        }

        return { lat, lon };
    } catch {
        return null;
    }
}

/** Get approximate center coords of a city name. */
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

// ─── Overpass: hotel search ────────────────────────────────────────────────────

export async function searchHotelsOSM(city: string): Promise<ChatPlace[]> {
    const center = await getCityCenter(city);
    if (!center) return [];

    const radius = 15000; // 15 km
    const query = `
    [out:json][timeout:20];
    (
        node["tourism"="hotel"](around:${radius},${center.lat},${center.lon});
        node["tourism"="hostel"](around:${radius},${center.lat},${center.lon});
        node["tourism"="guest_house"](around:${radius},${center.lat},${center.lon});
        node["tourism"="motel"](around:${radius},${center.lat},${center.lon});
        node["tourism"="apartment"](around:${radius},${center.lat},${center.lon});
    );
    out body 10;
    `.trim();

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
                .filter(Boolean)
                .join(' ') || city,
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

// ─── Bulk geocode enrichment ──────────────────────────────────────────────────

/**
 * Enrich a list of places with real coordinates from Nominatim.
 * Always appends city name to avoid cross-continent misfire.
 */
export async function enrichPlaces(
    places: ChatPlace[],
    cityContext: string,
): Promise<ChatPlace[]> {
    const results: ChatPlace[] = [];
    for (const p of places) {
        const coords = await geocodeName(p.name, cityContext);
        results.push(coords ? { ...p, ...coords } : p);
        // 300ms sleep delay to satisfy OSM Nominatim rate limits (max 1 req/sec)
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return results;
}

// ─── Haversine distance ───────────────────────────────────────────────────────

export function haversineKm(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
): number {
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
