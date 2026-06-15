import type { TravelPlan } from '../types'
import { MapView } from './MapView'
import { WeatherWidget } from './WeatherWidget'
import { Clock, MapPin, Hotel, ChevronRight } from 'lucide-react'

interface TravelPlanViewProps {
    plan: TravelPlan
}

export function TravelPlanView({ plan }: TravelPlanViewProps) {
    const totalHours = Math.floor(plan.totalDurationMinutes / 60)
    const totalMins = plan.totalDurationMinutes % 60

    return (
        <div className="space-y-4 w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-accent/20 to-purple-500/10 border border-accent/30 rounded-2xl p-4">
        <p className="text-accent text-xs font-mono uppercase tracking-widest">Travel Plan</p>
        <h2 className="font-display font-bold text-white text-xl mt-1">{plan.title}</h2>
        <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-300">
        {plan.hotel && (
            <span className="flex items-center gap-1">
            <Hotel size={14} className="text-purple-400" />
            {plan.hotel.name}
            </span>
        )}
        <span className="flex items-center gap-1">
        <Clock size={14} className="text-accent" />
        {totalHours}h {totalMins > 0 ? `${totalMins}m` : ''} total
        </span>
        <span className="text-muted">{plan.stops.length} stops</span>
        </div>
        </div>

        {/* Weather summary */}
        {plan.weatherSummary && (
            <WeatherWidget data={plan.weatherSummary} compact />
        )}

        {/* Map */}
        <MapView
        places={plan.stops.map((s) => s.place)}
        center={plan.mapCenter}
        zoom={plan.mapZoom}
        hotel={plan.hotel}
        />

        {/* Timeline */}
        <div className="space-y-2">
        <p className="text-xs text-muted uppercase tracking-wider font-mono">Itinerary</p>

        {/* Hotel start */}
        {plan.hotel && (
            <div className="flex items-center gap-3 py-2 px-3 bg-purple-900/20 border border-purple-500/20 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-base flex-shrink-0">
            🏨
            </div>
            <div>
            <p className="text-white text-sm font-medium">Start at {plan.hotel.name}</p>
            <p className="text-xs text-muted">Departure point · drop off your bags first</p>
            </div>
            </div>
        )}

        {/* Stops */}
        {plan.stops.map((stop, idx) => (
            <div key={idx} className="relative">
            {idx < plan.stops.length - 1 && (
                <div className="absolute left-7 top-14 w-0.5 h-4 bg-border z-0" />
            )}
            <div className={`
                flex gap-3 p-3 rounded-2xl border transition
                ${stop.note ? 'border-purple-500/30 bg-purple-900/10' : 'border-border bg-card/50'}
                `}>
                {/* Step number */}
                <div className="w-8 h-8 rounded-full bg-accent/20 text-accent font-bold text-xs flex items-center justify-center flex-shrink-0">
                {stop.step}
                </div>

                <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                <p className="text-white font-medium text-sm leading-tight">{stop.place.name}</p>
                <span className="text-accent font-mono text-xs flex-shrink-0">{stop.arrival_time}</span>
                </div>

                {stop.place.category && (
                    <p className="text-xs text-muted capitalize mt-0.5">{stop.place.category}</p>
                )}
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{stop.activity}</p>

                <div className="flex flex-wrap items-center gap-3 mt-2">
                <span className="text-xs text-muted flex items-center gap-1">
                <Clock size={10} />
                {stop.duration_minutes}min here
                </span>
                {stop.travel_time_to_next_minutes > 0 && (
                    <span className="text-xs text-muted flex items-center gap-1">
                    <ChevronRight size={10} />
                    {stop.travel_time_to_next_minutes}min to next
                    </span>
                )}
                {stop.place.distanceFromHotel !== undefined && (
                    <span className="text-xs text-purple-400 flex items-center gap-1">
                    <MapPin size={10} />
                    {stop.place.distanceFromHotel.toFixed(1)} km from hotel
                    </span>
                )}
                </div>

                {stop.note && (
                    <p className="text-xs text-purple-300 mt-1.5 bg-purple-500/10 rounded-lg px-2 py-1">
                    {stop.note}
                    </p>
                )}
                {stop.weather_warning && (
                    <p className="text-xs text-yellow-300 mt-1.5 bg-yellow-500/10 rounded-lg px-2 py-1">
                    {stop.weather_warning}
                    </p>
                )}
                </div>
                </div>
                </div>
        ))}

        {/* Hotel return */}
        {plan.hotel && (
            <div className="flex items-center gap-3 py-2 px-3 bg-purple-900/20 border border-purple-500/20 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-base flex-shrink-0">
            🛏️
            </div>
            <div>
            <p className="text-white text-sm font-medium">Return to {plan.hotel.name}</p>
            <p className="text-xs text-muted">You're done! Time to rest.</p>
            </div>
            </div>
        )}
        </div>
        </div>
    )
}
