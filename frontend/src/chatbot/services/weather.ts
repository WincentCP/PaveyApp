import type { WeatherData } from '../types';
import { getCityCenter } from './geocoding';

const BASE_URL = 'https://siilvered-pavey-backend.hf.space';

export async function fetchWeather(city: string): Promise<WeatherData> {
    try {
        const coords = await getCityCenter(city);
        if (!coords) throw new Error('Could not geocode city');
        return await fetchWeatherByCoords(coords.lat, coords.lon, city);
    } catch {
        return makeDummy(city);
    }
}

/** Fetch weather by GPS coords (for "Places Near Me") */
export async function fetchWeatherByCoords(lat: number, lon: number, cityName?: string): Promise<WeatherData> {
    try {
        const res = await fetch(
            `${BASE_URL}/weather/current?lat=${lat}&lon=${lon}`,
        );
        if (!res.ok) throw new Error(`Backend weather failed`);
        const d = await res.json();

        const temp = Math.round(d.temp_celsius);
        const feels_like = Math.round(d.feels_like ?? d.temp_celsius);
        const humidity: number = d.humidity;
        const wind_speed = Math.round(d.wind_speed ?? 0);
        const description: string = d.condition;
        const icon: string = d.icon;
        const rain: number | undefined = d.rain;

        const isRainy = description.toLowerCase().includes('rain') || 
                        description.toLowerCase().includes('drizzle') || 
                        description.toLowerCase().includes('hujan') || 
                        !!rain;
        const isExtreme =
        temp >= 38 || temp <= -5 || wind_speed > 72 || (isRainy && !!rain && rain > 10);

        return { 
            city: cityName || d.city || 'Your Location', 
            temp, 
            feels_like, 
            humidity, 
            wind_speed, 
            description, 
            icon, 
            rain, 
            isRainy, 
            isExtreme 
        };
    } catch {
        return makeDummy(cityName || 'Your Location');
    }
}

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
