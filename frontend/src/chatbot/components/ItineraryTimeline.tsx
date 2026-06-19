import { Clock, Navigation2, Star, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { TravelPlan } from '../types';

const TYPE_EMOJI: Record<string, string> = {
    destination: '🗺️',
    restaurant:  '🍽️',
    hotel:       '🏨',
    attraction:  '🎡',
};

const TYPE_COLORS: Record<string, { dot: string; line: string; badge: string; text: string }> = {
    destination: { dot: '#3B5BFF', line: '#3B5BFF33', badge: 'bg-brand-50 border-brand-200 text-brand-700',   text: 'text-brand-600' },
    restaurant:  { dot: '#F97316', line: '#F9731633', badge: 'bg-orange-50 border-orange-200 text-orange-700', text: 'text-orange-600' },
    hotel:       { dot: '#8B5CF6', line: '#8B5CF633', badge: 'bg-violet-50 border-violet-200 text-violet-700', text: 'text-violet-600' },
    attraction:  { dot: '#10B981', line: '#10B98133', badge: 'bg-emerald-50 border-emerald-200 text-emerald-700', text: 'text-emerald-600' },
};

const DEFAULT_COLORS = TYPE_COLORS.destination;

export default function ItineraryTimeline({ plan }: { plan: TravelPlan }) {
    const [expanded, setExpanded] = useState<number | null>(null);
    if (!plan.stops.length) return null;

    const totalMins = plan.stops.reduce(
        (s, st) => s + (st.duration_minutes ?? 0) + (st.travel_time_to_next_minutes ?? 0), 0
    );
    const hours = Math.floor(totalMins / 60);
    const mins  = totalMins % 60;

    return (
        <div className="bg-white rounded-2xl border border-ink-100 overflow-hidden" style={{ boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-ink-50 flex items-center justify-between bg-ink-50">
                <div>
                    <p className="text-[10px] uppercase tracking-widest text-ink-400 font-semibold">Day Plan</p>
                    <p className="text-sm font-bold text-ink-900">{plan.city}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-brand-500 text-white rounded-full px-3 py-1 text-[11px] font-semibold">
                    <Clock className="w-3 h-3" />
                    {hours > 0 ? `${hours}h ` : ''}{mins > 0 ? `${mins}m` : ''}
                </div>
            </div>

            {/* Hotel badge */}
            {plan.hotel && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 border-b border-violet-100">
                    <span className="text-base">🏨</span>
                    <div>
                        <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">Staying at</p>
                        <p className="text-xs font-bold text-violet-800">{plan.hotel.name}</p>
                    </div>
                </div>
            )}

            {/* Steps */}
            <div className="px-4 py-3 space-y-0">
                {plan.stops.map((stop, i) => {
                    const isLast    = i === plan.stops.length - 1;
                    const colors    = TYPE_COLORS[stop.type] ?? DEFAULT_COLORS;
                    const isOpen    = expanded === i;

                    return (
                        <div key={i}>
                            <button
                                className="w-full flex gap-3 text-left focus:outline-none group"
                                onClick={() => setExpanded(isOpen ? null : i)}
                            >
                                {/* Timeline dot + line */}
                                <div className="flex flex-col items-center pt-1 shrink-0">
                                    <div
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-offset-2 transition-transform group-hover:scale-110"
                                        style={{ 
                                        background: colors.dot, 
                                        boxShadow: `0 0 0 2px #white, 0 0 0 4px ${colors.dot}40` 
                                        }}
                                    >
                                        {stop.step ?? i + 1}
                                    </div>
                                    {!isLast && (
                                        <div className="w-0.5 flex-1 mt-1.5 mb-0.5" style={{ background: colors.line, minHeight: 32 }} />
                                    )}
                                </div>

                                {/* Content */}
                                <div className={`flex-1 min-w-0 ${!isLast ? 'pb-3' : ''}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm">{TYPE_EMOJI[stop.type] ?? '📍'}</span>
                                                <p className="text-xs font-bold text-ink-900 leading-tight truncate">{stop.name}</p>
                                            </div>
                                            <span className={`mt-0.5 inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${colors.badge} capitalize`}>
                                                {stop.type}
                                            </span>
                                        </div>
                                        <div className="shrink-0 text-right flex flex-col items-end gap-1">
                                            <span className="flex items-center gap-1 bg-ink-50 border border-ink-100 rounded-full px-2 py-0.5 text-[10px] font-bold text-ink-700">
                                                <Clock className="w-2.5 h-2.5" />
                                                {stop.arrival_time}
                                            </span>
                                            <p className="text-[10px] text-ink-400">{stop.duration_minutes} min</p>
                                            {isOpen
                                                ? <ChevronUp className={`w-3 h-3 ${colors.text}`} />
                                                : <ChevronDown className="w-3 h-3 text-ink-300" />
                                            }
                                        </div>
                                    </div>

                                    {/* Expandable details */}
                                    {isOpen && (
                                        <div className="mt-2 space-y-1.5 animate-in fade-in duration-200">
                                            {stop.description && (
                                                <p className="text-[11px] text-ink-500 leading-snug">{stop.description}</p>
                                            )}
                                            {(stop.lat != null && stop.lon != null) && (
                                                <a
                                                    href={stop.name ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stop.name}, ${plan.city || ''}`)}` : `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lon}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={e => e.stopPropagation()}
                                                    className="flex items-center gap-1 text-[10px] font-semibold text-brand-600 hover:underline"
                                                >
                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                    Open in Google Maps
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {/* Transit arrow */}
                                    {!isLast && stop.travel_time_to_next_minutes > 0 && (
                                        <div className="flex items-center gap-1 mt-1.5">
                                            <Navigation2 className="w-2.5 h-2.5 text-ink-300" />
                                            <span className="text-[10px] text-ink-400">{stop.travel_time_to_next_minutes} min to next stop</span>
                                        </div>
                                    )}
                                </div>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
