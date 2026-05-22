/**
 * Friendly modal shown when a user picks dates that exceed the 30-day cap.
 *
 * Tone is intentionally guiding, not rejecting — no red, no warning icons,
 * always offers at least one concrete next step.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { MAX_TRIP_DAYS } from '../lib/planValidation';
import { COPY } from '../lib/copy';

interface Props {
  open: boolean;
  days: number;
  regionsCount: number;
  onClose: () => void;
  onFocusDates: () => void;
  onFocusDestinations: () => void;
}

export default function TripTooLongModal({
  open, days, regionsCount, onClose, onFocusDates, onFocusDestinations,
}: Props) {
  const [whyOpen, setWhyOpen] = useState(false);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-[60] bg-ink-900/50"
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-[61] bg-white rounded-3xl shadow-card p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 pr-3">
                <div className="font-bold text-ink-900 font-display text-base leading-tight">
                  {COPY.tripTooLong.headline}
                </div>
                <div className="text-xs text-ink-500 mt-1 leading-snug">
                  {COPY.tripTooLong.body(days, MAX_TRIP_DAYS)}
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mt-2">
              <SuggestionRow
                title="Split into multiple plans"
                subtitle="Plan one trip now, link another later."
                onClick={() => { onClose(); onFocusDates(); }}
              />
              <SuggestionRow
                title="Pick fewer destinations"
                subtitle="A focused itinerary feels more like a real trip."
                onClick={() => { onClose(); onFocusDestinations(); }}
              />
              {regionsCount >= 2 && (
                <SuggestionRow
                  title="Narrow to one region"
                  subtitle="One area means less transit, more discovery."
                  onClick={() => { onClose(); onFocusDestinations(); }}
                />
              )}
            </div>

            <button
              onClick={() => setWhyOpen((v) => !v)}
              className="mt-3 text-[11px] text-brand-600 font-semibold press"
            >
              {whyOpen ? 'Hide' : 'Why?'}
            </button>
            {whyOpen && (
              <div className="mt-1 text-[11px] text-ink-500 leading-relaxed">
                {COPY.tripTooLong.why}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SuggestionRow({ title, subtitle, onClick }: { title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-brand-50/60 hover:bg-brand-50 border border-brand-100 rounded-2xl px-3 py-3 press text-left transition-colors"
    >
      <div className="flex-1">
        <div className="text-sm font-bold text-ink-900">{title}</div>
        <div className="text-[11px] text-ink-500 mt-0.5">{subtitle}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-brand-600 shrink-0" />
    </button>
  );
}
