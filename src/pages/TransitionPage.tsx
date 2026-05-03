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

  // Animated dots
  useEffect(() => {
    const id = setInterval(() => setDotCount((d) => (d + 1) % 4), 350);
    return () => clearInterval(id);
  }, []);

  const dots = '.'.repeat(dotCount);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #3B5BFF 0%, #6C3BFF 60%, #A855F7 100%)' }}
    >
      {/* Background decorations */}
      <div className="absolute top-[-100px] right-[-80px] w-72 h-72 rounded-full bg-white/5" />
      <div className="absolute bottom-[-60px] left-[-50px] w-52 h-52 rounded-full bg-white/5" />
      <div className="absolute top-1/3 left-[-40px] w-32 h-32 rounded-full bg-white/5" />

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
          className="absolute -inset-6 rounded-full bg-white/10"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -inset-3 rounded-full bg-white/15"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut', delay: 0.2 }}
        />
        <div className="relative w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-xl">
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
            <h2 className="text-2xl font-extrabold text-white font-display">
              {STEPS[stepIdx].text}
            </h2>
            <p className="text-white/70 text-sm mt-1">{STEPS[stepIdx].sub}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots loader */}
      <div className="mt-8 flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-white/60"
            animate={{
              scale: stepIdx === i ? [1, 1.4, 1] : 1,
              opacity: stepIdx >= i ? 1 : 0.3,
              background: stepIdx === i ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.5)',
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
          className="absolute bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/20"
        >
          {itinerary.slice(0, 4).map((p, i) => (
            <div key={p.id} className="relative">
              <img
                src={p.image} alt={p.name}
                className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/40"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-brand-500/90 text-white text-[9px] font-bold flex items-center justify-center">
                {i + 1}
              </div>
            </div>
          ))}
          {itinerary.length > 4 && (
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white text-xs font-bold">
              +{itinerary.length - 4}
            </div>
          )}
          <div className="text-white text-xs font-semibold">
            {itinerary.length} stop{itinerary.length !== 1 ? 's' : ''} planned{dots}
          </div>
        </motion.div>
      )}
    </div>
  );
}
