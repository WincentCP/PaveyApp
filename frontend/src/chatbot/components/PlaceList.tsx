import { MapPin, Star, Clock, ExternalLink, Plus, X } from 'lucide-react';
import type { ChatPlace } from '../types';
import { useApp, getPlaceImage } from '../../context/AppContext';
import { useToast } from '../../components/Toast';
import { useState } from 'react';

const TYPE_EMOJI: Record<string, string> = {
    destination: '🗺️',
    restaurant: '🍽️',
    hotel: '🏨',
    attraction: '🎡',
};

const TYPE_GRADIENT: Record<string, string> = {
    destination: 'from-brand-500 to-brand-600',
    restaurant:  'from-orange-500 to-orange-600',
    hotel:       'from-violet-500 to-violet-600',
    attraction:  'from-emerald-500 to-emerald-600',
};

const TYPE_BG: Record<string, string> = {
    destination: 'bg-brand-50 text-brand-700 border-brand-200',
    restaurant:  'bg-orange-50 text-orange-700 border-orange-200',
    hotel:       'bg-violet-50 text-violet-700 border-violet-200',
    attraction:  'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function PlaceList({
    places,
    showIndex = false,
    city,
}: {
    places: ChatPlace[];
    showIndex?: boolean;
    city?: string;
}) {
    const { addStop, perDayItineraries, activeTrip, vibe } = useApp();
    const { show } = useToast();
    const [selectedPlaceIdx, setSelectedPlaceIdx] = useState<number | null>(null);

    if (!places.length) return null;

    const convertChatPlaceToPlace = (cp: ChatPlace): any => {
        const currentCity = city || activeTrip?.destination?.split(' → ')[0] || '';
        const placeImg = getPlaceImage(currentCity, cp.type, cp.name);
        return {
            id: `ai-chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            city: currentCity,
            name: cp.name,
            category: cp.type === 'restaurant' ? 'Foodie' : cp.type === 'hotel' ? 'Cozy' : 'Cultural',
            tags: [cp.type],
            vibes: [vibe || 'balanced'],
            image: placeImg,
            cost: 0,
            priceRange: { min: 0, max: 0 },
            durationMin: cp.type === 'restaurant' ? 90 : cp.type === 'hotel' ? 120 : 60,
            distanceKm: 1.0,
            lat: cp.lat ?? 0,
            lng: cp.lon ?? 0,
            rating: cp.rating ?? 4.5,
            description: cp.description ?? '',
            openingHours: '09:00 – 21:00',
            indoor: false,
            openHour: 9,
            closeHour: 21,
        };
    };

    const handleAddClick = (idx: number, p: ChatPlace) => {
        if (perDayItineraries.length <= 1) {
            const place = convertChatPlaceToPlace(p);
            addStop(place);
            show(`${p.name} added to itinerary`, 'success');
        } else {
            setSelectedPlaceIdx(idx);
        }
    };

    return (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1 snap-x">
            {places.map((p, i) => {
                const grad = TYPE_GRADIENT[p.type] ?? TYPE_GRADIENT.destination;
                const badge = TYPE_BG[p.type] ?? TYPE_BG.destination;
                return (
                    <div
                        key={`${p.name}-${i}`}
                        className="relative shrink-0 w-52 snap-start bg-white rounded-2xl overflow-hidden shadow-sm border border-ink-100 flex flex-col"
                        style={{ boxShadow: '0 2px 12px rgba(0,0,0,.07)' }}
                    >
                        {/* Day selector overlay */}
                        {selectedPlaceIdx === i && (
                            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm p-3 flex flex-col justify-between z-10 animate-in fade-in slide-in-from-bottom duration-200">
                                <div>
                                    <div className="flex items-center justify-between border-b border-ink-100 pb-1.5 mb-2">
                                        <span className="text-xs font-bold text-ink-900">Select Day</span>
                                        <button onClick={() => setSelectedPlaceIdx(null)} className="p-0.5 hover:bg-ink-100 rounded-full press">
                                            <X className="w-3.5 h-3.5 text-ink-500" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto no-scrollbar pr-0.5">
                                        {perDayItineraries.map((_, dayIdx) => (
                                            <button
                                                key={dayIdx}
                                                onClick={() => {
                                                    const place = convertChatPlaceToPlace(p);
                                                    addStop(place, dayIdx);
                                                    show(`${p.name} added to Day ${dayIdx + 1}`, 'success');
                                                    setSelectedPlaceIdx(null);
                                                }}
                                                className="bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg py-1.5 text-center text-[10px] font-bold text-brand-700 press"
                                            >
                                                Day {dayIdx + 1}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedPlaceIdx(null)}
                                    className="w-full py-1.5 bg-ink-50 hover:bg-ink-100 text-ink-600 rounded-xl text-[10px] font-semibold press"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        {/* Card image header */}
                        <div className="h-28 relative overflow-hidden flex flex-col justify-end p-3 animate-in fade-in duration-300">
                            <img 
                                src={getPlaceImage(city || activeTrip?.destination?.split(' → ')[0] || '', p.type, p.name)} 
                                alt={p.name} 
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                            />
                            {/* Dark gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-ink-950/40 to-transparent" />
                            
                            <div className="relative z-10 flex flex-col gap-1 w-full">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm bg-white/90 backdrop-blur rounded px-1.5 py-0.5 leading-none shadow-sm">{TYPE_EMOJI[p.type] ?? '📍'}</span>
                                    {showIndex && (
                                        <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center ring-1 ring-white/50 shadow-sm">
                                            {i + 1}
                                        </span>
                                    )}
                                </div>
                                <p className="text-white font-bold text-xs leading-tight line-clamp-2 mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                    {p.name}
                                </p>
                                {p.rating != null && (
                                    <div className="flex items-center gap-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                        {[1,2,3,4,5].map(s => (
                                            <span key={s} className={`text-[8px] ${s <= Math.round(p.rating!) ? 'text-amber-400 font-bold' : 'text-white/40'}`}>★</span>
                                        ))}
                                        <span className="text-white text-[9px] font-bold">{p.rating.toFixed(1)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 px-3 pt-2.5 pb-3 flex flex-col gap-1.5">
                            <span className={`self-start text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge} capitalize`}>
                                {p.category ?? p.type}
                            </span>
                            {p.description && (
                                <p className="text-[11px] text-ink-500 leading-snug line-clamp-3">{p.description}</p>
                            )}
                            {p.address && (
                                <div className="flex items-start gap-1 mt-auto pt-1">
                                    <MapPin className="w-3 h-3 text-ink-400 shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-ink-400 leading-snug line-clamp-2">{p.address}</p>
                                </div>
                            )}
                            
                            <div className="mt-1.5 pt-1.5 border-t border-ink-50 flex items-center justify-between gap-2">
                                {(p.lat != null && p.lon != null) && (
                                    <a
                                        href={p.name ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name}, ${activeTrip?.destination || ''}`)}` : `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-brand-600 text-[10px] font-semibold hover:underline"
                                    >
                                        <ExternalLink className="w-2.5 h-2.5" />
                                        Maps
                                    </a>
                                )}
                                <button
                                    onClick={() => handleAddClick(i, p)}
                                    className="flex items-center gap-0.5 text-brand-600 text-[10px] font-semibold hover:underline"
                                >
                                    <Plus className="w-2.5 h-2.5" />
                                    Add to Itin
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
