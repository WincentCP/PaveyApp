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
                let city = await reverseCityName(lat, lon);
                
                // Fallback: If Nominatim fails or returns 'your location', fetch city name from IP
                if (city === 'your location') {
                    const ipGeo = await tryIPGeo();
                    if (ipGeo && ipGeo.city) {
                        city = ipGeo.city;
                    }
                }
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
            d.address?.municipality ||
            d.address?.suburb ||
            d.address?.city_district ||
            d.address?.county ||
            d.address?.state ||
            'your location'
        );
    } catch {
        return 'your location';
    }
}

async function tryIPGeo(): Promise<UserLocation | null> {
    try {
        // ip-api.com works over HTTP too
        const res = await fetch('http://ip-api.com/json/?fields=status,city,lat,lon');
        const d = await res.json();
        if (d.status !== 'success') return null;
        return { lat: d.lat, lon: d.lon, city: d.city, fromIP: true };
    } catch {
        // Try alternate: ipapi.co (HTTPS)
        try {
            const res = await fetch('https://ipapi.co/json/');
            const d = await res.json();
            if (d.city && d.latitude) {
                return { lat: d.latitude, lon: d.longitude, city: d.city, fromIP: true };
            }
        } catch { /* ignore */ }
        return null;
    }
}
