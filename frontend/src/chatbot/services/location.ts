/**
 * location.ts — Get user location
 *
 * Priority:
 *   1. navigator.geolocation (HTTPS + user allow)
 *   2. IP geolocation via ip-api.com (HTTP-safe, no key needed)
 *
 * Returns { lat, lon, city } or null.
 */

export interface UserLocation {
    lat: number;
    lon: number;
    city: string;
    fromIP?: boolean; // true when GPS failed and IP was used (city may be inaccurate)
}

/** Try GPS first, fallback to IP geolocation */
export async function detectUserLocation(): Promise<UserLocation | null> {
    // 1. Try GPS
    const gps = await tryGPS();
    if (gps) return gps;

    // 2. Fallback: IP geolocation (less accurate, especially in Indonesia)
    return tryIPGeo();
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
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'PaveyApp/1.0' } },
        );
        if (!res.ok) return '';
        const d = await res.json();
        const addr = d.address ?? {};

        const city =
            addr.city ||
            addr.town ||
            addr.municipality ||
            addr.county ||       // kabupaten (fallback for rural areas)
            addr.state_district ||
            addr.state ||
            '';

        return city.trim();
    } catch {
        return '';
    }
}

async function tryIPGeo(): Promise<UserLocation | null> {
    // 1. Try ipwho.is (Free, HTTPS, CORS, fast, reliable)
    try {
        const res = await fetch('https://ipwho.is/');
        if (res.ok) {
            const d = await res.json();
            if (d.success && d.city && d.latitude && d.longitude) {
                return { lat: d.latitude, lon: d.longitude, city: d.city, fromIP: true };
            }
        }
    } catch { /* try next */ }

    // 2. Try ipapi.co (HTTPS fallback)
    try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
            const d = await res.json();
            if (d.city && d.latitude && d.longitude) {
                return { lat: d.latitude, lon: d.longitude, city: d.city, fromIP: true };
            }
        }
    } catch { /* ignore */ }

    return null;
}
