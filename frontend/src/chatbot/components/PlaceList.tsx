import { MapPin, Star, Clock, ExternalLink } from 'lucide-react';
import type { ChatPlace } from '../types';

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
}: {
    places: ChatPlace[];
    showIndex?: boolean;
}) {
    if (!places.length) return null;

    return (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1 snap-x">
            {places.map((p, i) => {
                const grad = TYPE_GRADIENT[p.type] ?? TYPE_GRADIENT.destination;
                const badge = TYPE_BG[p.type] ?? TYPE_BG.destination;
                return (
                    <div
                        key={`${p.name}-${i}`}
                        className="shrink-0 w-52 snap-start bg-white rounded-2xl overflow-hidden shadow-sm border border-ink-100 flex flex-col"
                        style={{ boxShadow: '0 2px 12px rgba(0,0,0,.07)' }}
                    >
                        {/* Coloured header strip */}
                        <div className={`bg-gradient-to-br ${grad} px-3 pt-3 pb-4 relative`}>
                            <div className="flex items-center justify-between">
                                <span className="text-2xl">{TYPE_EMOJI[p.type] ?? '📍'}</span>
                                {showIndex && (
                                    <span className="w-6 h-6 rounded-full bg-white/20 backdrop-blur text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white/30">
                                        {i + 1}
                                    </span>
                                )}
                            </div>
                            <p className="text-white font-bold text-sm leading-tight mt-2 line-clamp-2">
                                {p.name}
                            </p>
                            {p.rating != null && (
                                <div className="flex items-center gap-1 mt-1">
                                    {[1,2,3,4,5].map(s => (
                                        <span key={s} className={`text-[8px] ${s <= Math.round(p.rating!) ? 'text-amber-300' : 'text-white/30'}`}>★</span>
                                    ))}
                                    <span className="text-white/90 text-[10px] font-semibold">{p.rating.toFixed(1)}</span>
                                </div>
                            )}
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
                            {(p.lat != null && p.lon != null) && (
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1.5 flex items-center gap-1 text-brand-600 text-[10px] font-semibold hover:underline"
                                >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                    Open in Maps
                                </a>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
