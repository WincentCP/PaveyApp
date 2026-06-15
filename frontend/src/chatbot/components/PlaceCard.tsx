import type { Place } from '../types'
import { MapPin, Star, Clock, ExternalLink } from 'lucide-react'

const TYPE_EMOJI: Record<string, string> = {
    destination: '🏛️',
    restaurant: '🍜',
    hotel: '🏨',
    attraction: '🎡',
}

const TYPE_BG: Record<string, string> = {
    destination: 'from-blue-900/30 to-blue-800/10',
    restaurant: 'from-orange-900/30 to-orange-800/10',
    hotel: 'from-purple-900/30 to-purple-800/10',
    attraction: 'from-green-900/30 to-green-800/10',
}

interface PlaceCardProps {
    place: Place
    index?: number
    onClick?: () => void
}

export function PlaceCard({ place, index, onClick }: PlaceCardProps) {
    const openMaps = (e: React.MouseEvent) => {
        e.stopPropagation()
        window.open(
            `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}&zoom=17`,
            '_blank'
        )
    }

    return (
        <div
        onClick={onClick}
        className={`
            relative rounded-2xl overflow-hidden border border-border
            bg-gradient-to-br ${TYPE_BG[place.type] || TYPE_BG.destination}
            cursor-pointer hover:border-accent/50 transition-all duration-200
            hover:scale-[1.01] active:scale-[0.99]
            min-w-[200px] max-w-[220px] flex-shrink-0
            `}
            >
            {/* Header */}
            <div className="px-4 pt-4 pb-2">
            <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
            {index !== undefined && (
                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0">
                {index + 1}
                </span>
            )}
            <span className="text-xl">{TYPE_EMOJI[place.type] || '📍'}</span>
            </div>
            {place.rating && (
                <span className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                <Star size={10} fill="currentColor" />
                {place.rating}
                </span>
            )}
            </div>
            <h3 className="font-display font-semibold text-white text-sm mt-2 leading-tight line-clamp-2">
            {place.name}
            </h3>
            {place.category && (
                <span className="text-xs text-accent/70 capitalize">{place.category}</span>
            )}
            </div>

            {/* Body */}
            <div className="px-4 pb-2 space-y-1">
            {place.address && (
                <p className="text-xs text-muted flex items-start gap-1">
                <MapPin size={10} className="mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{place.address}</span>
                </p>
            )}
            {place.openHours && (
                <p className="text-xs text-muted flex items-center gap-1">
                <Clock size={10} />
                <span className="line-clamp-1">{place.openHours}</span>
                </p>
            )}
            {place.description && (
                <p className="text-xs text-slate-300/70 line-clamp-3 mt-1">{place.description}</p>
            )}
            {place.distanceFromHotel !== undefined && (
                <p className="text-xs text-purple-400 font-medium">
                📍 {place.distanceFromHotel.toFixed(1)} km from hotel
                </p>
            )}
            </div>

            {/* Footer */}
            <div className="px-4 pb-4">
            <button
            onClick={openMaps}
            className="w-full flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium py-2 rounded-xl transition-colors"
            >
            <ExternalLink size={12} />
            View on Map
            </button>
            </div>
            </div>
    )
}

export function PlaceCarousel({ places }: { places: Place[] }) {
    return (
        <div className="flex gap-3 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory scrollbar-none">
        {places.map((place, i) => (
            <div key={place.id} className="snap-start">
            <PlaceCard place={place} index={i} />
            </div>
        ))}
        </div>
    )
}
