import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, MapPin } from 'lucide-react';
import type { ChatPlace, ItineraryStop } from '../types';

declare global {
    interface Window { L: typeof import('leaflet'); }
}

const TYPE_COLOR: Record<string, string> = {
    destination: '#3B5BFF',
    restaurant:  '#F97316',
    hotel:       '#8B5CF6',
    attraction:  '#10B981',
};

type PlaceItem = ChatPlace | ItineraryStop;

function getCoords(p: PlaceItem): { lat: number; lon: number } | null {
    if ('lat' in p && p.lat != null && p.lon != null) return { lat: p.lat, lon: p.lon };
    return null;
}

export default function MapView({
    places,
    className = '',
}: {
    places: PlaceItem[];
    className?: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef       = useRef<ReturnType<typeof window.L.map> | null>(null);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const withCoords = places.filter(p => getCoords(p) !== null);
        if (withCoords.length === 0) return;

        let poll: ReturnType<typeof setInterval>;
        let dead = false;

        function init() {
            if (dead || !containerRef.current) return;
            try {
                const L = window.L;
                if (mapRef.current) {
                    try { mapRef.current.remove(); } catch { /* ok */ }
                    mapRef.current = null;
                }

                const coords = withCoords.map(p => getCoords(p)!);
                const cLat   = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
                const cLon   = coords.reduce((s, c) => s + c.lon, 0) / coords.length;

                const map = L.map(containerRef.current, {
                    center: [cLat, cLon],
                    zoom:   13,
                    zoomControl: false,
                    scrollWheelZoom: false,
                    attributionControl: false,
                });
                mapRef.current = map;

                // Crisp CartoDB Voyager basemap
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                    attribution: '© OpenStreetMap © CARTO',
                    maxZoom: 19,
                }).addTo(map);

                // Attribution — tiny
                L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

                const lls: [number, number][] = [];

                withCoords.forEach((p, i) => {
                    const c     = getCoords(p)!;
                    const color = TYPE_COLOR[p.type ?? 'destination'] ?? '#3B5BFF';
                    const step  = ('step' in p ? p.step : i + 1);

                    const icon = L.divIcon({
                        html: `
                          <div style="
                            background:${color};
                            color:#fff;
                            width:28px;height:28px;
                            border-radius:50% 50% 50% 0;
                            transform:rotate(-45deg);
                            display:flex;align-items:center;justify-content:center;
                            border:2px solid #fff;
                            box-shadow:0 3px 10px rgba(0,0,0,.3);
                          ">
                            <span style="transform:rotate(45deg);font-size:11px;font-weight:800">${step}</span>
                          </div>`,
                        className: '',
                        iconSize:    [28, 28],
                        iconAnchor:  [14, 28],
                        popupAnchor: [0, -30],
                    });

                    const rating = ('rating' in p && p.rating != null)
                        ? `<div style="font-size:10px;color:#F59E0B;margin-top:2px">★ ${Number(p.rating).toFixed(1)}</div>`
                        : '';

                    L.marker([c.lat, c.lon], { icon })
                        .addTo(map)
                        .bindPopup(`
                          <div style="font-family:system-ui,sans-serif;min-width:140px;max-width:180px">
                            <b style="font-size:12px;color:#0F172A">${p.name}</b>
                            <div style="font-size:10px;color:#64748B;margin-top:2px;text-transform:capitalize">${p.type ?? ''}</div>
                            ${rating}
                          </div>`, { maxWidth: 200 });

                    lls.push([c.lat, c.lon]);
                });

                // Route polyline with animated dash
                if (lls.length > 1) {
                    L.polyline(lls, {
                        color:    '#3B5BFF',
                        weight:   3,
                        opacity:  0.7,
                        dashArray: '8 5',
                    }).addTo(map);
                    map.fitBounds(L.latLngBounds(lls), { padding: [36, 36] });
                }

                // Zoom control — bottom right
                L.control.zoom({ position: 'bottomright' }).addTo(map);

            } catch (e) {
                console.error('[MapView]', e);
            }
        }

        poll = setInterval(() => {
            if (window.L) { clearInterval(poll); init(); }
        }, 80);

        return () => {
            dead = true;
            clearInterval(poll);
            if (mapRef.current) {
                try { mapRef.current.remove(); } catch { /* ok */ }
                mapRef.current = null;
            }
        };
    }, [places]);

    // Invalidate map size when expanded changes
    useEffect(() => {
        setTimeout(() => {
            if (mapRef.current) {
                try { (mapRef.current as any).invalidateSize(); } catch { /* ok */ }
            }
        }, 320);
    }, [expanded]);

    const hasCoords = places.some(p => getCoords(p) !== null);
    if (!hasCoords) return null;

    const height = expanded ? 340 : 200;

    return (
        <div className={`relative rounded-2xl overflow-hidden border border-ink-100 ${className}`}
            style={{ height, transition: 'height 0.3s ease', boxShadow: '0 2px 12px rgba(0,0,0,.08)' }}>

            {/* Map container */}
            <div ref={containerRef} className="absolute inset-0 w-full h-full" style={{ background: '#E6ECF8', zIndex: 0 }} />

            {/* Top overlay — label */}
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm border border-ink-100 pointer-events-none">
                <MapPin className="w-3 h-3 text-brand-500" />
                <span className="text-[10px] font-semibold text-ink-700">
                    {places.filter(p => getCoords(p)).length} location{places.filter(p => getCoords(p)).length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Expand/collapse toggle */}
            <button
                onClick={() => setExpanded(e => !e)}
                className="absolute top-2 right-2 z-10 w-7 h-7 bg-white/90 backdrop-blur-sm border border-ink-100 rounded-full flex items-center justify-center shadow-sm text-ink-600 hover:text-brand-600 transition"
            >
                {expanded
                    ? <Minimize2 className="w-3.5 h-3.5" />
                    : <Maximize2 className="w-3.5 h-3.5" />
                }
            </button>
        </div>
    );
}
