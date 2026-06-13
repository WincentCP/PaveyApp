/**
 * Hotel Search Service
 *
 * Priority:
 * 1. RapidAPI — TripAdvisor Hotels (VITE_RAPIDAPI_KEY) — free tier 500 req/month
 * https://rapidapi.com/DataCrawler/api/tripadvisor16
 * 2. Overpass API (OSM) — strictly hotels only, no other tourism types
 * 3. Mock fallback (for tiny towns with no OSM data)
 */
import type { HotelResult, LatLng } from '../types'
import { geocodeCity } from './geocoding'

const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY
const TRIPADVISOR_HOST = 'tripadvisor16.p.rapidapi.com'

// ── RapidAPI TripAdvisor ────────────────────────────────────────────────────

async function searchTripAdvisor(city: string): Promise<HotelResult[]> {
    const searchRes = await fetch(
        `https://${TRIPADVISOR_HOST}/api/v1/hotels/searchLocation?query=${encodeURIComponent(city)}`,
                                  {
                                      headers: {
                                          'x-rapidapi-key': RAPIDAPI_KEY!,
                                          'x-rapidapi-host': TRIPADVISOR_HOST,
                                      },
                                  }
    )

    if (!searchRes.ok) throw new Error(`TripAdvisor search ${searchRes.status}`)
        const searchData = await searchRes.json()
        const locationId = searchData?.data?.[0]?.locationId
        if (!locationId) throw new Error('No locationId found')

            const hotelsRes = await fetch(
                `https://${TRIPADVISOR_HOST}/api/v1/hotels/getHotelsByLocation?` +
                `locationId=${locationId}&pageNumber=1&currencyCode=USD`,
                {
                    headers: {
                        'x-rapidapi-key': RAPIDAPI_KEY!,
                        'x-rapidapi-host': TRIPADVISOR_HOST,
                    },
                }
            )

            if (!hotelsRes.ok) throw new Error(`TripAdvisor hotels ${hotelsRes.status}`)
                const hotelsData = await hotelsRes.json()

                return (hotelsData?.data?.data || [])
                .slice(0, 8)
                .map((h: any): HotelResult => ({
                    id: `ta-${h.id || h.locationId}`,
                    name: h.name || h.title,
                    address: h.address || h.addressObj?.street1 || '',
                    city,
                    rating: h.bubbleRating?.rating ? parseFloat(h.bubbleRating.rating) : undefined,
                                               reviewCount: h.bubbleRating?.count,
                                               priceLevel: h.priceLevel,
                                               priceMin: h.priceForDisplay ? parseInt(h.priceForDisplay.replace(/\D/g, '')) : undefined,
                                               imageUrl: h.cardPhotos?.[0]?.sizes?.urlTemplate
                                               ?.replace('{width}', '400')
                                               ?.replace('{height}', '300'),
                                               bookingUrl: h.commerceInfo?.externalUrl || `https://www.tripadvisor.com`,
                                               amenities: h.amenitiesScreen?.map((a: any) => a.text).filter(Boolean) || [],
                                               description: h.tagline || '',
                                               source: 'rapidapi',
                }))
                .filter((h: HotelResult) => h.name)
}

// ── Overpass / OSM fallback — HOTELS ONLY ──────────────────────────────────

async function searchHotelsOSM(city: string): Promise<HotelResult[]> {
    const coords = await geocodeCity(city)
    if (!coords) return getMockHotels(city)

        // Use a large radius (15km) so small towns still get results from nearby area
        const radius = 15000

        // STRICTLY hotel/hostel/guest_house/motel — no other tourism tags
        const query = `
        [out:json][timeout:20];
    (
        node["tourism"="hotel"](around:${radius},${coords.lat},${coords.lng});
        node["tourism"="hostel"](around:${radius},${coords.lat},${coords.lng});
        node["tourism"="guest_house"](around:${radius},${coords.lat},${coords.lng});
        node["tourism"="motel"](around:${radius},${coords.lat},${coords.lng});
        node["tourism"="apartment"](around:${radius},${coords.lat},${coords.lng});
        way["tourism"="hotel"](around:${radius},${coords.lat},${coords.lng});
        way["tourism"="hostel"](around:${radius},${coords.lat},${coords.lng});
        way["tourism"="guest_house"](around:${radius},${coords.lat},${coords.lng});
    );
    out center body 10;
    `

    try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`,
        })
        if (!res.ok) return getMockHotels(city)
            const data = await res.json()

            const results: HotelResult[] = (data.elements || [])
            .filter((e: any) => e.tags?.name)
            .slice(0, 8)
            .map((e: any): HotelResult => {
                // `way` elements have center coords
                const lat = e.lat ?? e.center?.lat
                const lng = e.lon ?? e.center?.lon

                const street = [e.tags['addr:street'], e.tags['addr:housenumber']].filter(Boolean).join(' ')
                const addrCity = e.tags['addr:city'] || city
                const address = street ? `${street}, ${addrCity}` : addrCity

                const tourismType = e.tags['tourism'] || 'hotel'
            const stars = e.tags['stars'] ? parseFloat(e.tags['stars']) : undefined
            const phone = e.tags['phone'] || e.tags['contact:phone'] || ''
            const website = e.tags['website'] || e.tags['contact:website'] || ''

            return {
                id: `osm-${e.id}`,
                name: e.tags.name,
                address,
                city,
                lat,
                lng,
                rating: stars,
                bookingUrl: website || undefined,
                description: `${capitalize(tourismType)} in ${addrCity}${phone ? ` · ${phone}` : ''}`,
                 amenities: buildAmenities(e.tags),
                 source: 'nominatim',
            }
            })

            return results.length > 0 ? results : getMockHotels(city)
    } catch (err) {
        console.warn('[Hotels] OSM query failed:', err)
        return getMockHotels(city)
    }
}

function buildAmenities(tags: Record<string, string>): string[] {
    const amenities: string[] = []
    if (tags['internet_access'] === 'wlan' || tags['wifi'] === 'yes') amenities.push('WiFi')
        if (tags['amenity'] === 'restaurant' || tags['restaurant'] === 'yes') amenities.push('Restaurant')
            if (tags['swimming_pool'] === 'yes' || tags['leisure'] === 'swimming_pool') amenities.push('Pool')
                if (tags['parking'] === 'yes' || tags['amenity'] === 'parking') amenities.push('Parking')
                    if (tags['breakfast'] === 'yes') amenities.push('Breakfast')
                        if (tags['air_conditioning'] === 'yes') amenities.push('AC')
                            return amenities
}

function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ')
}

// ── Mock fallback ───────────────────────────────────────────────────────────

function getMockHotels(city: string): HotelResult[] {
    return [
        {
            id: 'mock-1',
            name: `Hotel ${city} Central`,
            address: `Main Street 1, ${city}`,
            city,
            rating: 4.1,
            reviewCount: 320,
            priceLevel: '$$',
            priceMin: 60,
            priceMax: 130,
            currency: 'EUR',
            description: 'Centrally located hotel with comfortable rooms and friendly service.',
            amenities: ['WiFi', 'Breakfast', 'Parking'],
            source: 'mock',
        },
        {
            id: 'mock-2',
            name: `Gasthof ${city}`,
            address: `Church Square 5, ${city}`,
            city,
            rating: 3.9,
            reviewCount: 128,
            priceLevel: '$',
            priceMin: 35,
            priceMax: 75,
            currency: 'EUR',
            description: 'Traditional guesthouse with local charm and home-cooked breakfast.',
            amenities: ['WiFi', 'Breakfast'],
            source: 'mock',
        },
        {
            id: 'mock-3',
            name: `Pension Schwarzwald`,
            address: `Forest Road 12, near ${city}`,
            city,
            rating: 4.4,
            reviewCount: 87,
            priceLevel: '$$',
            priceMin: 55,
            priceMax: 100,
            currency: 'EUR',
            description: 'Peaceful pension surrounded by nature, ideal for hiking and cycling trips.',
            amenities: ['WiFi', 'Parking', 'Garden'],
            source: 'mock',
        },
    ]
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function searchHotels(city: string): Promise<HotelResult[]> {
    if (RAPIDAPI_KEY) {
        try {
            const results = await searchTripAdvisor(city)
            if (results.length > 0) return results
        } catch (err) {
            console.warn('[Hotels] TripAdvisor failed, falling back to OSM:', err)
        }
    }
    return searchHotelsOSM(city)
}

export async function geocodeHotel(name: string, city: string): Promise<LatLng | null> {
    return geocodeCity(`${name} ${city}`)
}
