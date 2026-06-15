import type { WeatherData } from '../types'
import { Wind, Droplets, Thermometer, AlertTriangle } from 'lucide-react'

interface WeatherWidgetProps {
    data: WeatherData
    compact?: boolean
}

export function WeatherWidget({ data, compact = false }: WeatherWidgetProps) {
    const iconUrl = `https://openweathermap.org/img/wn/${data.icon}@2x.png`

    if (compact) {
        return (
            <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2">
            <img src={iconUrl} alt={data.description} className="w-10 h-10 object-contain" />
            <div>
            <p className="text-white font-semibold text-sm">
            {data.temp}°C{' '}
            <span className="text-muted font-normal text-xs">feels like {data.feels_like}°C</span>
            </p>
            <p className="text-xs text-accent capitalize">{data.city} · {data.description}</p>
            </div>
            {data.isExtreme && <AlertTriangle size={16} className="text-red-400 ml-auto" />}
            {data.isRainy && !data.isExtreme && <span className="text-lg ml-auto">🌧️</span>}
            </div>
        )
    }

    return (
        <div className={`rounded-2xl border p-4 transition-colors duration-200 ${
            data.isExtreme
            ? 'border-red-500/40 bg-red-900/10'
    : data.isRainy
    ? 'border-blue-500/30 bg-blue-900/10'
    : 'border-border bg-card'
        }`}>
        {/* Header */}
        <div className="flex items-center justify-between">
        <div>
        <p className="text-muted text-xs uppercase tracking-wider font-mono">Current Weather</p>
        <p className="text-white font-display font-semibold text-lg">{data.city}</p>
        </div>
        <img src={iconUrl} alt={data.description} className="w-16 h-16 object-contain" />
        </div>

        {/* Temp */}
        <div className="flex items-end gap-2 mt-1">
        <span className="text-4xl font-display font-bold text-white">{data.temp}°</span>
        <span className="text-muted text-sm mb-1">feels like {data.feels_like}°C</span>
        </div>
        <p className="text-accent capitalize text-sm">{data.description}</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
        {[
            { icon: <Droplets size={14} />, label: 'Humidity',   val: `${data.humidity}%` },
            { icon: <Wind size={14} />,     label: 'Wind',       val: `${data.wind_speed} km/h` },
            { icon: <Thermometer size={14} />, label: 'Rain',    val: data.rain ? `${data.rain}mm` : 'None' },
        ].map((s) => (
            <div key={s.label} className="bg-white/5 rounded-xl p-2 text-center hover:bg-white/10 transition-colors">
            <span className="text-accent flex justify-center">{s.icon}</span>
            <p className="text-white text-sm font-medium mt-1">{s.val}</p>
            <p className="text-muted text-xs">{s.label}</p>
            </div>
        ))}
        </div>

        {/* Alerts */}
        {data.isExtreme && (
            <div className="mt-3 flex items-center gap-2 bg-red-500/20 rounded-xl px-3 py-2 text-red-300 text-sm border border-red-500/20">
            <AlertTriangle size={14} />
            <span>Extreme weather — consider rescheduling outdoor activities.</span>
            </div>
        )}
        {data.isRainy && !data.isExtreme && (
            <div className="mt-3 flex items-center gap-2 bg-blue-500/20 rounded-xl px-3 py-2 text-blue-300 text-sm border border-blue-500/20">
            <span>🌧️</span>
            <span>Rain expected — bring an umbrella!</span>
            </div>
        )}
        </div>
    )
}
