import { useEffect, useRef } from 'react';
import type { ChatPlace, ItineraryStop } from '../types';

declare global {
    interface Window {
        L: typeof import('leaflet');
    }
}

const TYPE_COLOR: Record<string, string> = {
    destination: '#3B5BFF',
    restaurant: '#F97316',
    hotel: '#8B5CF6',
    attraction: '#10B981',
};

type PlaceItem = ChatPlace | ItineraryStop;

function getCoords(p: PlaceItem): { lat: number; lon: number } | null {
    if ('lat' in p && p.lat != null && p.lon != null) return { lat: p.lat, lon: p.lon };
    return null;
}

export default function MapView({ places, className = '' }: { places: PlaceItem[]; className?: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<ReturnType<typeof window.L.map> | null>(null);

    useEffect(() => {
        const withCoords = places.filter((p) => getCoords(p) !== null);
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

                const coords = withCoords.map((p) => getCoords(p)!);
                const cLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
                const cLon = coords.reduce((s, c) => s + c.lon, 0) / coords.length;

                const map = L.map(containerRef.current, {
                    center: [cLat, cLon],
                    zoom: 13,
                    zoomControl: true,
                    scrollWheelZoom: false,
                });
                mapRef.current = map;

                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                    attribution: '© OpenStreetMap © CARTO',
                    maxZoom: 19,
                }).addTo(map);

                const lls: [number, number][] = [];

                withCoords.forEach((p, i) => {
                    const c = getCoords(p)!;
                    const color = TYPE_COLOR[p.type ?? 'destination'] ?? '#3B5BFF';
                const icon = L.divIcon({
                    html: `<div style="background:${color};color:#fff;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"><span style="transform:rotate(45deg);font-size:10px;font-weight:700">${i + 1}</span></div>`,
                                       className: '',
                                       iconSize: [26, 26],
                                       iconAnchor: [13, 26],
                                       popupAnchor: [0, -28],
                });
                L.marker([c.lat, c.lon], { icon })
                .addTo(map)
                .bindPopup(`<div style="font-family:sans-serif;min-width:120px"><b style="font-size:12px">${p.name}</b><div style="font-size:10px;color:#666;margin-top:2px;text-transform:capitalize">${p.type ?? ''}</div></div>`);
                lls.push([c.lat, c.lon]);
                });

                if (lls.length > 1) {
                    L.polyline(lls, { color: '#3B5BFF', weight: 2.5, opacity: 0.55, dashArray: '6 4' }).addTo(map);
                    map.fitBounds(L.latLngBounds(lls), { padding: [28, 28] });
                }
            } catch (e) {
                console.error('[MapView]', e);
            }
        }

        poll = setInterval(() => {
            if (window.L) { clearInterval(poll); init(); }
        }, 100);

        return () => {
            dead = true;
            clearInterval(poll);
            if (mapRef.current) { try { mapRef.current.remove(); } catch { /* ok */ } mapRef.current = null; }
        };
    }, [places]);

    const hasCoords = places.some((p) => getCoords(p) !== null);
    if (!hasCoords) return null;

    return (
        <div
        ref={containerRef}
        className={`rounded-2xl overflow-hidden border border-ink-100 ${className}`}
        style={{ height: 220, minHeight: 220 }}
        />
    );
}
