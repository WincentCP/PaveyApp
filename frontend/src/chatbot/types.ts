// ─── Weather ────────────────────────────────────────────────────────────────

export interface WeatherData {
    city: string;
    temp: number;
    feels_like: number;
    humidity: number;
    wind_speed: number;
    description: string;
    icon: string;
    rain?: number;
    isRainy: boolean;
    isExtreme: boolean;
}

// ─── Places / Geocoding ──────────────────────────────────────────────────────

export interface ChatPlace {
    name: string;
    type: 'destination' | 'restaurant' | 'hotel' | 'attraction';
    category?: string;
    description?: string;
    address?: string;
    rating?: number;
    lat?: number;
    lon?: number;
    priceRange?: string;
    website?: string;
    phone?: string;
}

// ─── Itinerary ───────────────────────────────────────────────────────────────

export interface ItineraryStop {
    step: number;
    name: string;
    type: 'destination' | 'restaurant' | 'hotel' | 'attraction';
    arrival_time: string;
    duration_minutes: number;
    travel_time_to_next_minutes: number;
    description?: string;
    lat?: number;
    lon?: number;
    address?: string;
}

export interface TravelPlan {
    city: string;
    date?: string;
    hotel?: { name: string; lat?: number; lon?: number };
    stops: ItineraryStop[];
}

// ─── AI Response ─────────────────────────────────────────────────────────────

export type ChatIntent =
| 'recommend_places'
| 'travel_plan'
| 'check_weather'
| 'search_hotels'
| 'general';

export interface AIResult {
    intent: ChatIntent;
    city?: string;
    intro: string;
    hotel_name?: string;
    places?: {
        name: string;
        type: string;
        category?: string;
        description?: string;
        address?: string;
        rating?: number;
    }[];
    start_time?: string;
}

// ─── Chat Messages ───────────────────────────────────────────────────────────

export type MsgRole = 'user' | 'assistant';

export interface RichContent {
    type: 'weather' | 'places' | 'travel_plan' | 'hotels';
    weather?: WeatherData;
    places?: ChatPlace[];
    plan?: TravelPlan;
}

export interface ChatMsg {
    id: string;
    role: MsgRole;
    text: string;
    isStreaming?: boolean;
    richContent?: RichContent;
}
