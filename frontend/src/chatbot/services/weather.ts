/**
 * weather.ts — OpenWeatherMap integration
 * Falls back to dummy data when API key is missing (dev/preview mode).
 */

import type { WeatherData } from '../types';

const OWM_KEY = import.meta.env.VITE_OPENWEATHER_KEY as string | undefined;
const OWM_BASE = 'https://api.openweathermap.org/data/2.5';

// ─── Geocode city name to coords (Nominatim) ──────────────────────────────────

export async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
                                { headers: { 'Accept-Language': 'en' } },
        );
        const data = await res.json();
        if (!data[0]) return null;
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    } catch {
        return null;
    }
}

// ─── Fetch weather ────────────────────────────────────────────────────────────

export async function fetchWeather(city: string): Promise<WeatherData> {
    if (!OWM_KEY) {
        return makeDummy(city);
    }

    try {
        const res = await fetch(
            `${OWM_BASE}/weather?q=${encodeURIComponent(city)}&appid=${OWM_KEY}&units=metric&lang=en`,
        );
        if (!res.ok) throw new Error(`OWM ${res.status}`);
        const d = await res.json();

        const temp       = Math.round(d.main.temp);
        const feels_like = Math.round(d.main.feels_like);
        const humidity   = d.main.humidity as number;
        const wind_speed = Math.round((d.wind.speed as number) * 3.6); // m/s → km/h
        const description: string = d.weather[0].description;
        const icon: string        = d.weather[0].icon;
        const rain: number | undefined = d.rain?.['1h'];

        const isRainy   = description.includes('rain') || description.includes('drizzle') || !!rain;
        const isExtreme = temp >= 38 || temp <= -10 || (d.wind.speed as number) > 20 || isRainy && !!rain && rain > 10;

        return {
            city: d.name as string,
            temp, feels_like, humidity, wind_speed,
            description, icon,
            rain,
            isRainy,
            isExtreme,
        };
    } catch {
        return makeDummy(city);
    }
}

// ─── Dummy fallback ───────────────────────────────────────────────────────────

function makeDummy(city: string): WeatherData {
    return {
        city,
        temp: 28,
        feels_like: 31,
        humidity: 72,
        wind_speed: 14,
        description: 'partly cloudy',
        icon: '02d',
        isRainy: false,
        isExtreme: false,
    };
}
