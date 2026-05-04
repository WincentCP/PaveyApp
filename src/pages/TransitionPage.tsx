import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const STEPS = [
  { icon: '🗺️', text: 'Building your journey…', sub: 'Gathering the best stops' },
  { icon: '🔀', text: 'Optimizing route…', sub: 'Minimizing travel time between stops' },
  { icon: '✨', text: 'Almost ready…', sub: 'Your adventure is loading' },
];

export default function TransitionPage() {
  const nav = useNavigate();
  const { itinerary } = useApp();
  const [stepIdx, setStepIdx] = useState(0);
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStepIdx(1), 900);
    const t2 = setTimeout(() => setStepIdx(2), 1900);
    const t3 = setTimeout(() => nav('/map'), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []); // eslint-disable-line

  useEffect(() => {
    const id = setInterval(() => setDotCount((d) => (d + 1) % 4), 350);
    return () => clearInterval(id);
  }, []);

  const dots = '.'.repeat(dotCount);

  return (
    <div className="absolute inset-0 bg-white flex flex-col items-center justify-center overflow-hidden">

      {/* Central icon */}
      <motion.div
        key={stepIdx}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        className="relative mb-8"
      >
        {/* Pulse rings */}
        <motion.div
          className="absolute -inset-6 rounded-full bg-brand-100"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -inset-3 rounded-full bg-brand-50"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut', delay: 0.2 }}
        />
        <div className="relative w-24 h-24 rounded-3xl bg-brand-500 flex items-center justify-center shadow-glow">
          <AnimatePresence mode="wait">
            <motion.span
              key={stepIdx}
              initial={{ y: 12, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -12, opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="text-5xl"
            >
              {STEPS[stepIdx].icon}
            </motion.span>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Step text */}
      <div className="text-center px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIdx}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-2xl font-extrabold text-ink-900 font-display">
              {STEPS[stepIdx].text}
            </h2>
            <p className="text-ink-500 text-sm mt-1">{STEPS[stepIdx].sub}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots loader */}
      <div className="mt-8 flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full"
            animate={{
              scale: stepIdx === i ? [1, 1.4, 1] : 1,
              opacity: stepIdx >= i ? 1 : 0.25,
              backgroundColor: stepIdx >= i ? '#3B5BFF' : '#C7D2FE',
            }}
            transition={{ duration: 0.5, repeat: stepIdx === i ? Infinity : 0 }}
          />
        ))}
      </div>

      {/* Stop count preview */}
      {itinerary.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="absolute bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-ink-50 border border-ink-100 rounded-2xl px-5 py-3"
        >
          {itinerary.slice(0, 4).map((p, i) => (
            <div key={p.id} className="relative">
              <img
                src={p.image} alt={p.name}
                className="w-10 h-10 rounded-xl object-cover ring-2 ring-white"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] font-bold flex items-center justify-center">
                {i + 1}
              </div>
            </div>
          ))}
          {itinerary.length > 4 && (
            <div className="w-10 h-10 rounded-xl bg-ink-100 flex items-center justify-center text-ink-700 text-xs font-bold">
              +{itinerary.length - 4}
            </div>
          )}
          <div className="text-ink-700 text-xs font-semibold">
            {itinerary.length} stop{itinerary.length !== 1 ? 's' : ''} planned{dots}
          </div>
        </motion.div>
      )}
    </div>
  );
}
