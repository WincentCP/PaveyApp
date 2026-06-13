// src/services/routing.ts
import type { LatLng, Place } from '../types'

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

export interface RouteResult {
    durationSeconds: number
    distanceMeters: number
    durationMinutes: number
    distanceKm: number
}

/**
 * Calculates routing data using the public OSRM engine
 */
export async function getRouteTime(from: LatLng, to: LatLng): Promise<RouteResult> {
    try {
        const url = `${OSRM_BASE}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`
        const res = await fetch(url)
        if (!res.ok) throw new Error('OSRM network response error')

            const data = await res.json()
            if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('No valid route from OSRM')

                const route = data.routes[0]
                return {
                    durationSeconds: route.duration,
                    distanceMeters: route.distance,
                    durationMinutes: Math.ceil(route.duration / 60),
                    distanceKm: Math.round(route.distance / 100) / 10,
                }
    } catch (err) {
        console.warn('[Routing] OSRM gateway failed, falling back to Haversine estimation:', err)
        const dist = haversineKm(from, to)
        const avgSpeedKmh = 30 // Typical city driving speed baseline
        return {
            durationSeconds: (dist / avgSpeedKmh) * 3600,
            distanceMeters: dist * 1000,
            durationMinutes: Math.ceil((dist / avgSpeedKmh) * 60),
            distanceKm: dist,
        }
    }
}

/**
 * Great-circle distance calculation via Haversine Formula
 */
export function haversineKm(a: LatLng, b: LatLng): number {
    if (!a || !b || isNaN(a.lat) || isNaN(a.lng) || isNaN(b.lat) || isNaN(b.lng)) {
        return 0
    }
    const R = 6371 // Earth's radius in kilometers
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
    return parseFloat((R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))).toFixed(2))
}

function toRad(deg: number): number {
    return (deg * Math.PI) / 180
}

/**
 * Pythagorean travel planner approach:
 * Sorts indexing arrays based on absolute geographical distance from a hotel anchor coordinate
 */
export function sortByHotelProximity(hotelCoord: LatLng, places: Place[]): number[] {
    return places
    .map((place, index) => ({
        index,
        distance: haversineKm(hotelCoord, { lat: place.lat, lng: place.lng })
    }))
    .sort((a, b) => a.distance - b.distance)
    .map(item => item.index)
}
