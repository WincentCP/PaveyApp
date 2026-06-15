import type { LatLng, Place } from '../types'

const NOMINATIM = 'https://nominatim.openstreetmap.org'

export async function geocodeCity(query: string): Promise<LatLng | null> {
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2000)

        const res = await fetch(
            `${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
            { 
                headers: { 'Accept-Language': 'en,id', 'User-Agent': 'PaveyChatbot/1.0' },
                signal: controller.signal
            }
        )
        clearTimeout(timeoutId)
        if (!res.ok) return null
        const data = await res.json()
        if (!data[0]) return null
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    } catch {
        return null
    }
}

export async function reverseGeocode(coords: LatLng): Promise<string> {
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2000)

        const res = await fetch(
            `${NOMINATIM}/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json`,
            { 
                headers: { 'Accept-Language': 'en,id', 'User-Agent': 'PaveyChatbot/1.0' },
                signal: controller.signal
            }
        )
        clearTimeout(timeoutId)
        const data = await res.json()
        return data.address?.city || data.address?.town || data.address?.county || 'Your Location'
    } catch {
        return 'Your Location'
    }
}

/** Search tourism places via Overpass API (OSM) — no key required */
export async function searchPlacesOSM(
    center: LatLng,
    radius = 4000
): Promise<Place[]> {
    const query = `
    [out:json][timeout:15];
    (
        node["tourism"~"attraction|museum|artwork|viewpoint|theme_park"](around:${radius},${center.lat},${center.lng});
        node["leisure"~"park|garden"](around:${radius},${center.lat},${center.lng});
        node["amenity"~"restaurant|cafe"](around:${radius / 2},${center.lat},${center.lng});
    );
    out body 20;
    `
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 4000)

        const res = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`,
            signal: controller.signal
        })
        clearTimeout(timeoutId)
        if (!res.ok) return []
        const data = await res.json()
        return (data.elements || [])
            .filter((e: any) => e.lat && e.lon && e.tags?.name)
            .slice(0, 15)
            .map((e: any, i: number): Place => ({
                id: `osm-${e.id || i}`,
                name: e.tags.name,
                type: guessType(e.tags),
                category: e.tags.tourism || e.tags.amenity || e.tags.leisure,
                lat: e.lat,
                lng: e.lon,
                address: [e.tags['addr:street'], e.tags['addr:city']].filter(Boolean).join(', '),
                description: e.tags.description || '',
                openHours: e.tags.opening_hours || '',
                rating: e.tags['stars'] ? parseFloat(e.tags['stars']) : undefined,
            }))
    } catch {
        return []
    }
}

function guessType(tags: any): Place['type'] {
    if (tags.amenity === 'restaurant' || tags.amenity === 'cafe') return 'restaurant'
    if (tags.tourism === 'hotel' || tags.tourism === 'hostel') return 'hotel'
    return 'destination'
}
