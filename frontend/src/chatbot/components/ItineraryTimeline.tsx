import { Clock, Navigation2 } from 'lucide-react';
import type { TravelPlan } from '../types';

const TYPE_EMOJI: Record<string, string> = {
    destination: '🗺️',
    restaurant: '🍽️',
    hotel: '🏨',
    attraction: '🎡',
};

const TYPE_COLOR: Record<string, string> = {
    destination: '#3B5BFF',
    restaurant: '#F97316',
    hotel: '#8B5CF6',
    attraction: '#10B981',
};

export default function ItineraryTimeline({ plan }: { plan: TravelPlan }) {
    if (!plan.stops.length) return null;

    return (
        <div className="bg-ink-50 rounded-2xl p-3">
        {plan.hotel && (
            <div className="flex items-center gap-2 mb-3 px-1">
            <span className="text-sm">🏨</span>
            <div>
            <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Staying at</p>
            <p className="text-xs font-bold text-ink-900">{plan.hotel.name}</p>
            </div>
            </div>
        )}

        {plan.stops.map((stop, i) => {
            const isLast = i === plan.stops.length - 1;
            const color = TYPE_COLOR[stop.type] ?? '#3B5BFF';
        return (
            <div key={i} className="flex gap-2.5">
            <div className="flex flex-col items-center pt-1">
            <div
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold"
            style={{ background: color }}
            >
            {stop.step}
            </div>
            {!isLast && (
                <div className="w-px flex-1 mt-1 mb-1" style={{ background: `${color}40`, minHeight: 24 }} />
            )}
            </div>

            <div className={`flex-1 min-w-0 ${!isLast ? 'pb-3' : ''}`}>
            <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
            <div className="flex items-center gap-1">
            <span className="text-xs">{TYPE_EMOJI[stop.type] ?? '📍'}</span>
            <p className="text-xs font-bold text-ink-900 leading-tight truncate">{stop.name}</p>
            </div>
            {stop.description && (
                <p className="text-[11px] text-ink-500 leading-snug mt-0.5 line-clamp-2">{stop.description}</p>
            )}
            {stop.address && (
                <p className="text-[10px] text-ink-400 mt-0.5 truncate">{stop.address}</p>
            )}
            </div>
            <div className="shrink-0 text-right">
            <span className="flex items-center gap-1 bg-white border border-ink-100 rounded-full px-2 py-0.5 text-[10px] font-bold text-ink-700">
            <Clock className="w-2.5 h-2.5" />
            {stop.arrival_time}
            </span>
            <p className="text-[10px] text-ink-400 mt-1">{stop.duration_minutes} min</p>
            </div>
            </div>
            {!isLast && stop.travel_time_to_next_minutes > 0 && (
                <div className="flex items-center gap-1 mt-1.5">
                <Navigation2 className="w-2.5 h-2.5 text-ink-300" />
                <span className="text-[10px] text-ink-400">{stop.travel_time_to_next_minutes} min to next stop</span>
                </div>
            )}
            </div>
            </div>
        );
        })}
        </div>
    );
}
