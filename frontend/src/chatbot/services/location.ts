/**
 * location.ts — Get user location
 *
 * Only uses browser GPS (navigator.geolocation).
 * IP geolocation is intentionally removed — it is unreliable in Indonesia
 * (ISP routing causes wrong city detection, e.g. South Tangerang for users elsewhere).
 *
 * If GPS is denied/unavailable, returns null and the calling flow will
 * ask the user to type their city manually.
 *
 * Returns { lat, lon, city } or null.
 */

export interface UserLocation {
    lat: number;
    lon: number;
    city: string;
}

/** GPS only — returns null if unavailable/denied so UI can ask for city */
export async function detectUserLocation(): Promise<UserLocation | null> {
    return tryGPS();
}

function tryGPS(): Promise<UserLocation | null> {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }

        const timeout = setTimeout(() => resolve(null), 8000);

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                clearTimeout(timeout);
                const { latitude: lat, longitude: lon } = pos.coords;
                // Reverse geocode with Nominatim to get city name
                const city = await reverseCityName(lat, lon);
                resolve({ lat, lon, city });
            },
            () => {
                clearTimeout(timeout);
                resolve(null);
            },
            { timeout: 7000, maximumAge: 60000 },
        );
    });
}

async function reverseCityName(lat: number, lon: number): Promise<string> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'PaveyApp/1.0' } },
        );
        const d = await res.json();
        return (
            d.address?.city ||
            d.address?.town ||
            d.address?.village ||
            d.address?.county ||
            'your location'
        );
    } catch {
        return 'your location';
    }
}


