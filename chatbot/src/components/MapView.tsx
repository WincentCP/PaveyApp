import { useEffect, useRef, useState } from 'react'
import type { Place, LatLng } from '../types'

declare const L: any

const TYPE_COLORS: Record<string, string> = {
    destination: '#38bdf8',
    restaurant: '#fb923c',
    hotel: '#a78bfa',
    attraction: '#34d399',
}

interface MapViewProps {
    places: Place[]
    center: LatLng
    zoom?: number
    hotel?: Place
    className?: string
}

export function MapView({ places, center, zoom = 14, hotel, className = '' }: MapViewProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<any>(null)
    const [leafletReady, setLeafletReady] = useState(typeof window !== 'undefined' && typeof (window as any).L !== 'undefined')

    useEffect(() => {
        if (leafletReady) return
            let attempts = 0
            const interval = setInterval(() => {
                attempts++
                if (typeof (window as any).L !== 'undefined') {
                    setLeafletReady(true)
                    clearInterval(interval)
                }
                if (attempts > 30) clearInterval(interval)
            }, 100)
            return () => clearInterval(interval)
    }, [leafletReady])

    useEffect(() => {
        if (!leafletReady || !containerRef.current) return

            // Hancurkan peta lama jika sudah terpasang agar tidak terjadi initialization conflict error
            if (mapRef.current) {
                mapRef.current.remove()
                mapRef.current = null
            }

            // Inisialisasi Peta Leaflet
            const map = L.map(containerRef.current).setView([center.lat, center.lng], zoom)
            mapRef.current = map

            // Tambahkan skin peta gelap premium (CartoDB DarkMatter) cocok dengan UI terminal hitam kamu
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
            }).addTo(map)

            const allCoords: [number, number][] = []

            // ── RENDERING AKTIF PIN DI DALAM APLIKASI ──
            places.forEach((place) => {
                if (!place.lat || !place.lng) return
                    allCoords.push([place.lat, place.lng])

                    // Custom sirkular HTML pin marker berwarna cerah sesuai tipe tempatnya
                    const color = TYPE_COLORS[place.type] || '#38bdf8'
            const customIcon = L.divIcon({
                className: 'custom-leaflet-pin',
                html: `<div style="background-color: ${color}; width: 12px; height: 12px; border: 2px solid #fff; rounded: 50%; box-shadow: 0 0 8px ${color}; border-radius: 50%;"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            })

            L.marker([place.lat, place.lng], { icon: customIcon })
            .addTo(map)
            .bindPopup(`<strong style="color: #000">${place.name}</strong><br/><span style="color: #666; font-size:11px;">${place.category || place.type}</span>`)
            })

            // Jika ada koordinat hotel anchor, pasang marker bintang khusus
            if (hotel && hotel.lat && hotel.lng) {
                allCoords.push([hotel.lat, hotel.hotel ? hotel.lng : hotel.lng])
                const hotelIcon = L.divIcon({
                    className: 'custom-hotel-pin',
                    html: `<div style="background-color: #a78bfa; width: 16px; height: 16px; border: 2px solid #fff; box-shadow: 0 0 10px #a78bfa; transform: rotate(45deg); border-radius: 2px;"></div>`,
                                            iconSize: [16, 16],
                                            iconAnchor: [8, 8]
                })

                L.marker([hotel.lat, hotel.lng], { icon: hotelIcon })
                .addTo(map)
                .bindPopup(`<strong style="color: #000">🏨 Base Hotel: ${hotel.name}</strong>`)
                .openPopup()
            }

            // Fit bounds secara dinamis agar seluruh pin muat di layar view aplikasi
            if (allCoords.length > 1) {
                try { map.fitBounds(allCoords, { padding: [24, 24], maxZoom: 15 }) } catch { /* ignore */ }
            } else {
                map.setView([center.lat, center.lng], zoom)
            }

    }, [places, hotel, center, zoom, leafletReady])

    if (!leafletReady) {
        return (
            <div className={`rounded-xl border border-white/5 bg-zinc-900 flex items-center justify-center ${className}`} style={{ height: 260 }}>
            <p className="text-zinc-500 text-xs animate-pulse">Loading core engine maps...</p>
            </div>
        )
    }

    return (
        <div className={`rounded-xl overflow-hidden border border-white/5 bg-zinc-900/50 ${className}`}>
        <div ref={containerRef} style={{ height: 260, width: '100%' }} className="z-10" />
        <div className="bg-zinc-900/80 px-3 py-2 flex gap-3 text-[10px] text-zinc-400 border-t border-white/5 flex-wrap">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1.5 capitalize">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
            <span>{type}</span>
            </span>
        ))}
        </div>
        </div>
    )
}
