import type { WeatherData, LatLng } from '../types'

const OWM_BASE = 'https://api.openweathermap.org/data/2.5'

function getKey(): string {
    return import.meta.env.VITE_OPENWEATHER_KEY || ''
}

export async function getWeatherByCity(city: string): Promise<WeatherData | null> {
    const key = getKey()
    if (!key) {
        console.warn('[Weather] No VITE_OPENWEATHER_KEY set — returning mock data. Add it to .env to get real weather.')
        return getMockWeather(city, { lat: 0, lng: 0 })
    }
    try {
        const res = await fetch(
            `${OWM_BASE}/weather?q=${encodeURIComponent(city)}&appid=${key}&units=metric&lang=en`
        )
        if (!res.ok) {
            console.error(`[Weather] OWM responded ${res.status} for city "${city}"`)
            return getMockWeather(city, { lat: 0, lng: 0 })
        }
        return parseOWMResponse(await res.json())
    } catch (err) {
        console.error('[Weather] fetch failed:', err)
        return getMockWeather(city, { lat: 0, lng: 0 })
    }
}

export async function getWeatherByCoords(coords: LatLng): Promise<WeatherData | null> {
    const key = getKey()
    if (!key) {
        console.warn('[Weather] No VITE_OPENWEATHER_KEY set — returning mock data.')
        return getMockWeather('Your Location', coords)
    }
    try {
        const res = await fetch(
            `${OWM_BASE}/weather?lat=${coords.lat}&lon=${coords.lng}&appid=${key}&units=metric&lang=en`
        )
        if (!res.ok) {
            console.error(`[Weather] OWM responded ${res.status} for coords`)
            return getMockWeather('Your Location', coords)
        }
        return parseOWMResponse(await res.json())
    } catch (err) {
        console.error('[Weather] fetch failed:', err)
        return getMockWeather('Your Location', coords)
    }
}

function parseOWMResponse(data: any): WeatherData {
    const rain = data.rain?.['3h'] ?? data.rain?.['1h'] ?? 0
    const weatherId = data.weather[0].id
    const isRainy = rain > 0 || (weatherId >= 500 && weatherId < 700)
    const isExtreme = (weatherId >= 200 && weatherId < 300) || rain > 10 || data.wind.speed > 15
    return {
        city: data.name,
        temp: Math.round(data.main.temp),
        feels_like: Math.round(data.main.feels_like),
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        humidity: data.main.humidity,
        wind_speed: Math.round(data.wind.speed * 3.6), // m/s → km/h
        rain,
        lat: data.coord.lat,
        lng: data.coord.lon,
        isRainy,
        isExtreme,
    }
}

function getMockWeather(city: string, coords: LatLng): WeatherData {
    return {
        city,
        temp: 22,
        feels_like: 21,
        description: 'partly cloudy (demo — add VITE_OPENWEATHER_KEY for real data)',
        icon: '02d',
        humidity: 65,
        wind_speed: 12,
        rain: 0,
        lat: coords.lat,
        lng: coords.lng,
        isRainy: false,
        isExtreme: false,
    }
}
