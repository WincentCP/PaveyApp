import { Wind, Droplets, Thermometer, AlertTriangle, TrendingUp } from 'lucide-react';
import type { WeatherData } from '../types';

interface Props {
    data: WeatherData;
    compact?: boolean;
}

function getWeatherGradient(data: WeatherData): string {
    if (data.isExtreme)  return 'from-red-500 to-orange-500';
    if (data.isRainy)    return 'from-blue-500 to-indigo-500';
    if (data.temp >= 30) return 'from-amber-400 to-orange-500';
    if (data.temp <= 15) return 'from-sky-400 to-blue-600';
    return 'from-brand-400 to-teal-500';
}

function getWeatherBg(data: WeatherData): string {
    if (data.isExtreme) return 'bg-red-50 border-red-200';
    if (data.isRainy)   return 'bg-blue-50 border-blue-200';
    return 'bg-ink-50 border-ink-100';
}

export default function WeatherWidget({ data, compact = false }: Props) {
    const iconUrl = `https://openweathermap.org/img/wn/${data.icon}@2x.png`;
    const grad    = getWeatherGradient(data);

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

    return (
        <div className="rounded-2xl border overflow-hidden" style={{ boxShadow: '0 2px 16px rgba(0,0,0,.08)' }}>
            {/* Gradient header */}
            <div className={`bg-gradient-to-br ${grad} px-4 py-4 flex items-center justify-between`}>
                <div>
                    <p className="text-white/70 text-[10px] uppercase tracking-widest font-semibold">Weather Now</p>
                    <p className="text-white font-bold text-lg leading-tight font-display">{data.city}</p>
                    <p className="text-white/80 capitalize text-sm mt-0.5">{data.description}</p>
                </div>
                <div className="text-right flex flex-col items-end">
                    <img src={iconUrl} alt={data.description} className="w-16 h-16 object-contain drop-shadow" />
                    <span className="text-white font-bold text-3xl font-display leading-none">{data.temp}°</span>
                    <span className="text-white/70 text-xs">feels {data.feels_like}°C</span>
                </div>
            </div>

            {/* Stats grid */}
            <div className={`grid grid-cols-3 gap-0 divide-x divide-ink-100 ${getWeatherBg(data)} border-t-0 border`}>
                {[
                    { icon: <Droplets className="w-4 h-4" />, label: 'Humidity', val: `${data.humidity}%`, color: 'text-blue-500' },
                    { icon: <Wind className="w-4 h-4" />,     label: 'Wind',     val: `${data.wind_speed} km/h`, color: 'text-teal-500' },
                    { icon: <TrendingUp className="w-4 h-4" />, label: 'Rain',   val: data.rain ? `${data.rain}mm` : 'None', color: 'text-indigo-500' },
                ].map(s => (
                    <div key={s.label} className="flex flex-col items-center py-3 px-2 bg-white">
                        <span className={s.color}>{s.icon}</span>
                        <p className="text-ink-900 text-sm font-bold mt-1">{s.val}</p>
                        <p className="text-ink-400 text-[10px]">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Alerts */}
            {data.isExtreme && (
                <div className="flex items-center gap-2 bg-red-50 border-t border-red-200 px-4 py-2.5 text-red-700 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Extreme weather — reconsider outdoor plans!</span>
                </div>
            )}
            {data.isRainy && !data.isExtreme && (
                <div className="flex items-center gap-2 bg-blue-50 border-t border-blue-100 px-4 py-2.5 text-blue-700 text-xs">
                    <span>🌧️</span>
                    <span>Rain likely — pack an umbrella!</span>
                </div>
            )}
        </div>
    );
}
