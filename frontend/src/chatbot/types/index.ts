// src/types/index.ts

export interface LatLng {
    lat: number
    lng: number
}

export interface Place {
    id: string
    name: string
    type: 'destination' | 'restaurant' | 'hotel' | 'attraction'
    category?: string
    lat: number
    lng: number
    rating?: number
    address?: string
    description?: string
    openHours?: string
    imageUrl?: string
    distanceFromHotel?: number
}

export interface HotelResult {
    id: string
    name: string
    address: string
    city: string
    lat?: number
    lng?: number
    rating?: number
    reviewCount?: number
    priceLevel?: string
    priceMin?: number
    priceMax?: number
    currency?: string
    imageUrl?: string
    bookingUrl?: string
    amenities?: string[]
    description?: string
    source: 'rapidapi' | 'nominatim' | 'mock'
}

export interface WeatherData {
    city: string
    temp: number
    feels_like: number
    description: string
    icon: string
    humidity: number
    wind_speed: number
    rain?: number
    lat: number
    lng: number
    isRainy: boolean
    isExtreme: boolean
}

export interface ItineraryStop {
    step: number
    place: Place
    arrival_time: string
    duration_minutes: number
    travel_time_to_next_minutes: number
    activity: string
    note?: string
    weather_warning?: string
}

export interface TravelPlan {
    title: string
    date: string
    hotel?: Place
    stops: ItineraryStop[]
    totalDurationMinutes: number
    weatherSummary?: WeatherData
    mapCenter: LatLng
    mapZoom: number
}

export type MessageRole = 'user' | 'assistant'

export interface ChatMessage {
    id: string
    role: MessageRole
    content: string
    timestamp: Date
    richContent?: RichContent
    isStreaming?: boolean
}

export type RichContent =
| { type: 'map'; places: Place[]; center: LatLng; zoom: number; hotel?: Place }
| { type: 'travel_plan'; plan: TravelPlan }
| { type: 'weather'; data: WeatherData }
| { type: 'place_cards'; places: Place[] }
| { type: 'hotel_search'; hotels: HotelResult[]; city: string }

export interface UserPreferences {
    currentCity?: string
    coords?: LatLng
    hotelName?: string
}
