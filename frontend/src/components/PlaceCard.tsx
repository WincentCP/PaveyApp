import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Clock, DollarSign, MapPin, Navigation, Star, X } from 'lucide-react';
import { useState } from 'react';
import type { Place } from '../data/places';
import type { Currency } from '../data/wallet';
import { formatCost } from '../lib/format';


function nineColon(i: number, addMin = 0) {
  const start = 10 * 60 + 30 + i * 150 + addMin;
  const h = Math.floor(start / 60) % 24;
  const m = start % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function InfoBlock({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-ink-50 rounded-xl p-2.5">
      <div className="flex items-center gap-1 mb-1">{icon}<span className="text-[10px] text-ink-500 font-medium">{label}</span></div>
      <div className="text-xs font-bold text-ink-900 leading-snug">{value}</div>
      {sub && <div className="text-[10px] text-ink-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function PlaceCard({ place, index, prevPlace, onClose, onNavigate, isSaved, onSave, currency, onBuddy }: {
  place: Place; index: number; prevPlace?: Place; onClose: () => void; onNavigate: () => void;
  isSaved: boolean; onSave: () => void; currency: Currency; onBuddy: () => void;
}) {


  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 z-35 bg-ink-900/30" />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="absolute inset-x-0 bottom-0 z-40 bg-white rounded-t-3xl shadow-card overflow-y-auto max-h-[80%]"
      >
        <div className="w-12 h-1.5 bg-ink-200 rounded-full mx-auto mt-3" />

        <div className="relative h-40 mt-2">
          <img src={place.image} alt={place.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center press">
            <X className="w-4 h-4 text-white" />
          </button>
          {index >= 0 && (
            <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-brand-500 text-white text-sm font-bold flex items-center justify-center ring-2 ring-white">
              {index + 1}
            </div>
          )}
          <div className="absolute bottom-3 left-4 right-4">
            <div className="font-bold text-white text-lg font-display leading-tight">{place.name}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-white/80 text-xs">{place.category}</span>
              <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs text-white">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {place.rating}
              </span>
              {index >= 0 && (
                <span className="flex items-center gap-1 bg-brand-500/80 rounded-full px-2 py-0.5 text-xs text-white font-semibold">
                  <Clock className="w-3 h-3" /> {nineColon(index)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <InfoBlock icon={<Clock className="w-3.5 h-3.5 text-brand-500" />} label="Hours" value={place.openingHours} />
            <InfoBlock
              icon={<DollarSign className="w-3.5 h-3.5 text-emerald-500" />} label="Price"
              value={place.priceRange.min === place.priceRange.max ? formatCost(place.priceRange.min, currency) : `${formatCost(place.priceRange.min, currency)}+`}
            />
            <InfoBlock
              icon={<MapPin className="w-3.5 h-3.5 text-orange-500" />}
              label={prevPlace ? 'From prev' : 'Distance'}
              value={prevPlace ? (prevPlace.distanceKm > 0.01 ? `${prevPlace.distanceKm.toFixed(2)} km` : '< 0.1 km') : (place.distanceKm > 0.01 ? `${place.distanceKm.toFixed(2)} km` : '< 0.1 km')}
              sub={prevPlace ? `from ${prevPlace.name.split(' ')[0]}` : undefined}
            />
          </div>

          <p className="text-sm text-ink-600 mb-3 leading-relaxed">{place.description}</p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {place.tags.map((tag) => (
              <span key={tag} className="px-2.5 py-1 rounded-full bg-ink-50 text-ink-600 text-xs font-medium">{tag}</span>
            ))}
            <span className="px-2.5 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-medium">{place.durationMin} min visit</span>
          </div>



          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onSave}
              className={`h-11 rounded-2xl font-semibold press inline-flex items-center justify-center gap-2 transition-colors ${isSaved ? 'bg-brand-50 text-brand-600 border border-brand-200' : 'bg-ink-50 text-ink-800'}`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-brand-500 text-brand-500' : ''}`} />
              {isSaved ? 'Saved' : 'Save'}
            </button>
            <button onClick={onNavigate} className="h-11 rounded-2xl bg-brand-500 text-white font-semibold shadow-glow press inline-flex items-center justify-center gap-2">
              <Navigation className="w-4 h-4" /> Navigate
            </button>
          </div>
          <button onClick={onBuddy} className="mt-2.5 w-full h-10 rounded-2xl bg-brand-50 text-brand-700 font-semibold inline-flex items-center justify-center gap-2 press">
            <img src="/curious.svg" className="w-5 h-5 object-contain" alt="" /> Ask TinTin about this
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ChevronDown component inline
function ChevronDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
