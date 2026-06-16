/**
 * MapView.tsx — Leaflet map dengan numbered pin markers
 *
 * Leaflet dimuat via CDN di index.html. Kita poll window.L sebelum init
 * agar tidak crash jika script belum selesai parse.
 */

import { useEffect, useRef } from 'react';
import type { ChatPlace, ItineraryStop } from '../types';

// ─── Type shim for window.L ───────────────────────────────────────────────────
declare global {
    interface Window {
        L: typeof import('leaflet');
    }
}

// ─── Color per type ───────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
    destination: '#3B5BFF',
    restaurant:  '#F97316',
    hotel:       '#8B5CF6',
    attraction:  '#10B981',
};

function markerHtml(index: number, color: string, label: string): string {
    return `
    <div style="
    background:${color};
    color:#fff;
    width:28px;height:28px;
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    display:flex;align-items:center;justify-content:center;
    border:2px solid #fff;
    box-shadow:0 2px 8px rgba(0,0,0,.35);
    ">
    <span style="transform:rotate(45deg);font-size:11px;font-weight:700">${label}</span>
    </div>
    `;
}

// ─── Props ────────────────────────────────────────────────────────────────────

type PlaceItem = ChatPlace | ItineraryStop;

interface MapViewProps {
    places: PlaceItem[];
    className?: string;
}

function getCoords(p: PlaceItem): { lat: number; lon: number } | null {
    if ('lat' in p && p.lat != null && p.lon != null) return { lat: p.lat, lon: p.lon };
    return null;
}

function getName(p: PlaceItem): string {
    return p.name;
}

function getType(p: PlaceItem): string {
    return p.type ?? 'destination';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapView({ places, className = '' }: MapViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef       = useRef<ReturnType<typeof window.L.map> | null>(null);

    useEffect(() => {
        const placesWithCoords = places.filter((p) => getCoords(p) !== null);
        if (placesWithCoords.length === 0) return;

        let pollInterval: ReturnType<typeof setInterval>;
        let cancelled = false;

        function initMap() {
            if (cancelled || !containerRef.current) return;

            try {
                const L = window.L;

                // Destroy previous instance
                if (mapRef.current) {
                    try { mapRef.current.remove(); } catch { /* ignore */ }
                    mapRef.current = null;
                }

                const coords = placesWithCoords.map((p) => getCoords(p)!);
                const centerLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
                const centerLon = coords.reduce((s, c) => s + c.lon, 0) / coords.length;

                const map = L.map(containerRef.current, {
                    center: [centerLat, centerLon],
                    zoom: 13,
                    zoomControl: true,
                    scrollWheelZoom: false,
                });
                mapRef.current = map;

                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                    attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
                    maxZoom: 19,
                }).addTo(map);

                const latlngs: [number, number][] = [];

                placesWithCoords.forEach((p, i) => {
                    const c = getCoords(p)!;
                    const color = TYPE_COLOR[getType(p)] ?? '#3B5BFF';
                    const label = String(i + 1);

                    const icon = L.divIcon({
                        html: markerHtml(i, color, label),
                                           className: '',
                                           iconSize: [28, 28],
                                           iconAnchor: [14, 28],
                                           popupAnchor: [0, -30],
                    });

                    L.marker([c.lat, c.lon], { icon })
                    .addTo(map)
                    .bindPopup(
                        `<div style="font-family:sans-serif;min-width:140px">
                        <div style="font-weight:700;font-size:13px">${getName(p)}</div>
                        <div style="font-size:11px;color:#666;text-transform:capitalize;margin-top:2px">${getType(p)}</div>
                        </div>`,
                    );

                    latlngs.push([c.lat, c.lon]);
                });

                // Draw route polyline
                if (latlngs.length > 1) {
                    L.polyline(latlngs, { color: '#3B5BFF', weight: 2.5, opacity: 0.6, dashArray: '6 4' }).addTo(map);
                }

                // Fit bounds
                if (latlngs.length > 1) {
                    map.fitBounds(L.latLngBounds(latlngs), { padding: [32, 32] });
                }
            } catch (err) {
                console.error('[MapView] init error', err);
            }
        }

        // Poll until window.L is ready (CDN async load)
        pollInterval = setInterval(() => {
            if (window.L) {
                clearInterval(pollInterval);
                initMap();
            }
        }, 100);

        return () => {
            cancelled = true;
            clearInterval(pollInterval);
            if (mapRef.current) {
                try { mapRef.current.remove(); } catch { /* ignore */ }
                mapRef.current = null;
            }
        };
    }, [places]);

    const hasCoords = places.some((p) => getCoords(p) !== null);

    if (!hasCoords) return null;

    return (
        <div
        ref={containerRef}
        className={`rounded-2xl overflow-hidden ${className}`}
        style={{ height: 220, minHeight: 220 }}
        />
    );
}
