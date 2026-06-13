import type { Place, TravelPlan, ItineraryStop, WeatherData } from '../types'
import { haversineKm, sortByHotelProximity } from './routing'

const DEFAULT_DURATIONS: Record<Place['type'], number> = {
    destination: 90,
    restaurant: 60,
    hotel: 30,
    attraction: 75,
}

const ACTIVITY_MAP: Record<string, string> = {
    museum: 'Explore the exhibits and galleries — grab photos at the best spots.',
    restaurant: "Enjoy authentic local cuisine. Don't skip the house specials!",
    cafe: 'Grab a coffee and soak in the local atmosphere.',
    attraction: 'Take your time exploring — great opportunity for photos and cultural immersion.',
    park: 'Relax, stroll, or cycle through the greenery.',
    viewpoint: 'Capture the panoramic view. Best light: early morning or golden hour.',
    beach: 'Swim, sunbathe, or just take a long walk along the shore.',
    temple: 'Explore the architecture and history. Dress modestly out of respect.',
    mall: 'Browse local products and grab a quick snack while you\'re here.',
    default: 'Take your time exploring at your own pace.',
}

// Max reasonable travel time between stops in a 1-day itinerary
const MAX_TRAVEL_MIN = 60

export function generateTravelPlan(
    places: Place[],
    hotel: Place | null,
    startTime: string,
    weather: WeatherData | null,
    date: string
): TravelPlan {
    // Filter out any place that landed suspiciously far from the city center
    // City center = average of all place coords (or hotel if available)
    const refLat = hotel?.lat ?? (places.reduce((s, p) => s + p.lat, 0) / places.length)
    const refLng = hotel?.lng ?? (places.reduce((s, p) => s + p.lng, 0) / places.length)
    const ref = { lat: refLat, lng: refLng }

    // Drop any place more than 200km from the reference center — wrong continent
    const sane = places.filter((p) => haversineKm(ref, { lat: p.lat, lng: p.lng }) < 200)
    // If filtering killed everything, fall back to all places (better than empty)
    let orderedPlaces = sane.length >= 2 ? sane : places

    if (hotel) {
        const hotelCoord = { lat: hotel.lat, lng: hotel.lng }
        const sortedIndices = sortByHotelProximity(hotelCoord, orderedPlaces)
        const sorted = sortedIndices.map((i) => orderedPlaces[i])
        const mid = Math.ceil(sorted.length / 2)
        orderedPlaces = [...sorted.slice(0, mid), ...sorted.slice(mid).reverse()]
    }

    const stops: ItineraryStop[] = []
    const [startH, startM] = startTime.split(':').map(Number)
    let currentMinutes = startH * 60 + (startM || 0)

    for (let i = 0; i < orderedPlaces.length; i++) {
        const place = orderedPlaces[i]
        const next = orderedPlaces[i + 1]

        const fromCoord =
        i === 0 && hotel
        ? { lat: hotel.lat, lng: hotel.lng }
        : { lat: orderedPlaces[i - 1]?.lat ?? place.lat, lng: orderedPlaces[i - 1]?.lng ?? place.lng }

        const rawTravel = i === 0 ? 0 : estimateTravelMin(fromCoord, { lat: place.lat, lng: place.lng })
        // Cap so a bad geocode can never produce 28797min
        const travelMin = Math.min(rawTravel, MAX_TRAVEL_MIN)
        currentMinutes += travelMin

        const duration = DEFAULT_DURATIONS[place.type] ?? 60

        const rawTravelToNext = next
        ? estimateTravelMin({ lat: place.lat, lng: place.lng }, { lat: next.lat, lng: next.lng })
        : 0
        const travelToNext = Math.min(rawTravelToNext, MAX_TRAVEL_MIN)

        const distFromHotel = hotel
        ? haversineKm({ lat: hotel.lat, lng: hotel.lng }, { lat: place.lat, lng: place.lng })
        : undefined

        stops.push({
            step: i + 1,
            place: { ...place, distanceFromHotel: distFromHotel },
            arrival_time: minsToTime(currentMinutes),
                   duration_minutes: duration,
                   travel_time_to_next_minutes: travelToNext,
                   activity: getActivity(place),
                   note:
                   hotel && i === 0
                   ? '⚡ Starting close to your hotel — perfect to drop off bags first!'
        : hotel && i === orderedPlaces.length - 1
        ? '🏨 Last stop is near your hotel — easy walk back to rest.'
        : undefined,
        weather_warning: buildWeatherNote(weather),
        })

        currentMinutes += duration
    }

    const mapCenter = hotel
    ? { lat: hotel.lat, lng: hotel.lng }
    : orderedPlaces[0]
    ? { lat: orderedPlaces[0].lat, lng: orderedPlaces[0].lng }
    : { lat: 0, lng: 0 }

    return {
        title: `Travel Plan · ${date}`,
        date,
        hotel: hotel ?? undefined,
        stops,
        totalDurationMinutes: currentMinutes - startH * 60 - (startM || 0),
        weatherSummary: weather ?? undefined,
        mapCenter,
        mapZoom: 13,
    }
}

function estimateTravelMin(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
): number {
    const dist = haversineKm(a, b)
    return Math.max(5, Math.ceil((dist / 25) * 60))
}

function minsToTime(mins: number): string {
    const h = Math.floor(mins / 60) % 24
    const m = mins % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function getActivity(place: Place): string {
    for (const [key, val] of Object.entries(ACTIVITY_MAP)) {
        if (key === 'default') continue
            if (
                place.category?.toLowerCase().includes(key) ||
                place.name.toLowerCase().includes(key)
            ) {
                return val
            }
    }
    return place.description || ACTIVITY_MAP.default
}

function buildWeatherNote(weather: WeatherData | null): string | undefined {
    if (!weather) return undefined
        if (weather.isExtreme) return '⚠️ Extreme weather — consider indoor alternatives'
            if (weather.isRainy) return '🌧️ Rain expected — bring an umbrella'
                return undefined
}
