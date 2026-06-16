/**
 * WeatherWidget.tsx — Weather display card
 * Matches Pavey's color system: brand-500 = #3B5BFF, ink-*, etc.
 */

import { Wind, Droplets, Thermometer, AlertTriangle } from 'lucide-react';
import type { WeatherData } from '../types';

interface Props {
    data: WeatherData;
    compact?: boolean;
}

export default function WeatherWidget({ data, compact = false }: Props) {
    const iconUrl = `https://openweathermap.org/img/wn/${data.icon}@2x.png`;

    if (compact) {
        return (
            <div className="flex items-center gap-3 bg-ink-50 border border-ink-100 rounded-2xl px-3 py-2.5">
            <img src={iconUrl} alt={data.description} className="w-10 h-10 object-contain" />
            <div className="flex-1 min-w-0">
            <p className="text-ink-900 font-bold text-sm leading-tight">
            {data.temp}°C{' '}
            <span className="text-ink-500 font-normal text-xs">feels {data.feels_like}°C</span>
            </p>
            <p className="text-xs text-brand-600 capitalize truncate">
            {data.city} · {data.description}
            </p>
            </div>
            {data.isExtreme && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
            {data.isRainy && !data.isExtreme && <span className="text-lg shrink-0">🌧️</span>}
            </div>
        );
    }

    const bgClass = data.isExtreme
    ? 'bg-red-50 border-red-200'
    : data.isRainy
    ? 'bg-blue-50 border-blue-200'
    : 'bg-ink-50 border-ink-100';

    return (
        <div className={`rounded-2xl border p-4 ${bgClass}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
        <div>
        <p className="text-ink-400 text-[10px] uppercase tracking-widest font-semibold">Weather Now</p>
        <p className="text-ink-900 font-bold text-base font-display leading-tight mt-0.5">{data.city}</p>
        </div>
        <img src={iconUrl} alt={data.description} className="w-14 h-14 object-contain" />
        </div>

        {/* Temp */}
        <div className="flex items-end gap-2 mt-1">
        <span className="text-4xl font-bold text-ink-900 font-display">{data.temp}°</span>
        <span className="text-ink-500 text-sm mb-1">feels like {data.feels_like}°C</span>
        </div>
        <p className="text-brand-600 capitalize text-sm mt-0.5">{data.description}</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-3">
        {[
            { icon: <Droplets className="w-3.5 h-3.5" />, label: 'Humidity', val: `${data.humidity}%` },
            { icon: <Wind className="w-3.5 h-3.5" />,     label: 'Wind',     val: `${data.wind_speed} km/h` },
            { icon: <Thermometer className="w-3.5 h-3.5" />, label: 'Rain',  val: data.rain ? `${data.rain}mm` : 'None' },
        ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-2 text-center">
            <span className="text-brand-500 flex justify-center">{s.icon}</span>
            <p className="text-ink-900 text-xs font-bold mt-1">{s.val}</p>
            <p className="text-ink-400 text-[10px]">{s.label}</p>
            </div>
        ))}
        </div>

        {/* Alerts */}
        {data.isExtreme && (
            <div className="mt-3 flex items-center gap-2 bg-red-100 rounded-xl px-3 py-2 text-red-700 text-xs border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Extreme weather — reconsider outdoor plans!</span>
            </div>
        )}
        {data.isRainy && !data.isExtreme && (
            <div className="mt-3 flex items-center gap-2 bg-blue-100 rounded-xl px-3 py-2 text-blue-700 text-xs border border-blue-200">
            <span>🌧️</span>
            <span>Rain likely — pack an umbrella!</span>
            </div>
        )}
        </div>
    );
}
