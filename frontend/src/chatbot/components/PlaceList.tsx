/**
 * PlaceList.tsx — Horizontal scrollable cards untuk recommend_places & hotels
 */

import { MapPin, Star, ExternalLink } from 'lucide-react';
import type { ChatPlace } from '../types';

const TYPE_EMOJI: Record<string, string> = {
    destination: '🗺️',
    restaurant:  '🍽️',
    hotel:       '🏨',
    attraction:  '🎡',
};

const TYPE_COLOR: Record<string, string> = {
    destination: 'bg-brand-50 text-brand-700 border-brand-200',
    restaurant:  'bg-orange-50 text-orange-700 border-orange-200',
    hotel:       'bg-violet-50 text-violet-700 border-violet-200',
    attraction:  'bg-emerald-50 text-emerald-700 border-emerald-200',
};

interface Props {
    places: ChatPlace[];
    showIndex?: boolean;
}

export default function PlaceList({ places, showIndex = false }: Props) {
    if (!places.length) return null;

    return (
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {places.map((p, i) => {
            const colorCls = TYPE_COLOR[p.type] ?? TYPE_COLOR.destination;
            const emoji    = TYPE_EMOJI[p.type] ?? '📍';

        return (
            <div
            key={`${p.name}-${i}`}
            className="shrink-0 w-44 bg-white border border-ink-100 rounded-2xl p-3 shadow-sm flex flex-col gap-1.5"
            >
            {/* Header */}
            <div className="flex items-start justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
            {showIndex && (
                <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {i + 1}
                </span>
            )}
            <span className="text-sm">{emoji}</span>
            </div>
            {p.rating != null && (
                <span className="flex items-center gap-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                {p.rating.toFixed(1)}
                </span>
            )}
            </div>

            {/* Name */}
            <p className="text-xs font-bold text-ink-900 leading-snug line-clamp-2">{p.name}</p>

            {/* Category badge */}
            <span className={`self-start text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colorCls} capitalize`}>
            {p.category ?? p.type}
            </span>

            {/* Description */}
            {p.description && (
                <p className="text-[11px] text-ink-500 leading-snug line-clamp-2">{p.description}</p>
            )}

            {/* Address */}
            {p.address && (
                <div className="flex items-start gap-1 mt-auto pt-1">
                <MapPin className="w-3 h-3 text-ink-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-ink-400 leading-snug line-clamp-2">{p.address}</p>
                </div>
            )}

            {/* Price */}
            {p.priceRange && (
                <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">{p.priceRange}</p>
            )}
            </div>
        );
        })}
        </div>
    );
}
