/**
 * Buddy.tsx — TinTin AI travel companion (drop-in replacement)
 *
 * Quick prompts:
 *   1. Places Near Me    → GPS only (no IP fallback), weather-first
 *   2. Plan My Day       → ask city in chat
 *   3. Check Weather     → ask city in chat
 *   4. Find Hotels       → normal send → LLM intent
 *   5. Plan Around Hotel → ask hotel + city in chat
 *   6. Edit My Plan      → ask edit instruction in chat
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Send, X, Map, Calendar, CloudSun, Hotel, Navigation, PenLine, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useChat } from '../chatbot/hooks/useChat';
import { useApp } from '../context/AppContext';
import WeatherWidget from '../chatbot/components/WeatherWidget';
import PlaceList from '../chatbot/components/PlaceList';
import ItineraryTimeline from '../chatbot/components/ItineraryTimeline';
import MapView from '../chatbot/components/MapView';
import type { ChatMsg } from '../chatbot/types';

// ─── Location permission popup ────────────────────────────────────────────────

function LocationPopup({ onAllow, onDismiss }: { onAllow: () => void; onDismiss: () => void }) {
  return (
    <motion.div
    initial={{ opacity: 0, y: 8, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 8, scale: 0.95 }}
    className="absolute inset-x-4 top-20 z-[2000] bg-white rounded-2xl shadow-card border border-ink-100 p-4"
    >
    <div className="flex items-start gap-3">
    <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center shrink-0">
    <MapPin className="w-5 h-5 text-brand-600" />
    </div>
    <div className="flex-1 min-w-0">
    <p className="text-sm font-bold text-ink-900">Allow location access?</p>
    <p className="text-xs text-ink-500 mt-0.5 leading-snug">
    TinTin needs your location to find nearby places. If your browser blocks GPS,
    we'll use your IP address instead — no exact address is stored.
    </p>
    </div>
    </div>
    <div className="flex gap-2 mt-3">
    <button
    onClick={onAllow}
    className="flex-1 h-9 rounded-xl bg-brand-500 text-white text-xs font-bold press"
    >
    Allow
    </button>
    <button
    onClick={onDismiss}
    className="flex-1 h-9 rounded-xl bg-ink-50 text-ink-600 text-xs font-semibold press"
    >
    Not now
    </button>
    </div>
    </motion.div>
  );
}

// ─── Rich content block ───────────────────────────────────────────────────────

function RichBlock({ msg }: { msg: ChatMsg }) {
  const r = msg.richContent;
  if (!r) return null;

  return (
    <div className="mt-2 space-y-2">
    {r.type === 'weather' && r.weather && <WeatherWidget data={r.weather} />}

    {(r.type === 'places' || r.type === 'hotels') && r.places && r.places.length > 0 && (
      <>
      {/* Map on TOP of the list */}
      <MapView places={r.places} className="mb-2" />
      <PlaceList places={r.places} showIndex={r.type === 'places'} />
      </>
    )}

    {r.type === 'travel_plan' && r.plan && (
      <>
      <ItineraryTimeline plan={r.plan} />
      <MapView places={r.plan.stops} className="mt-2" />
      </>
    )}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MsgBubble({ msg }: { msg: ChatMsg }) {
  const isMe = msg.role === 'user';
  return (
    <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
    >
    <div className={`max-w-[86%] ${isMe ? '' : 'w-full'}`}>
    <div
    className={`px-4 py-2.5 rounded-2xl text-sm leading-snug whitespace-pre-wrap ${
      isMe
      ? 'bg-brand-500 text-white rounded-br-md'
      : 'bg-ink-50 text-ink-800 rounded-bl-md'
    }`}
    >
    {msg.isStreaming && !msg.text ? (
      <div className="flex gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <motion.div
        key={i}
        className="w-2 h-2 rounded-full bg-ink-400"
        animate={{ y: [0, -4, 0] }}
        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
        />
      ))}
      </div>
    ) : (
      msg.text
    )}
    </div>
    {!isMe && <RichBlock msg={msg} />}
    </div>
    </motion.div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function BuddyAvatar() {
  return (
    <div className="w-11 h-11 rounded-full bg-white border border-brand-500 shadow-sm flex items-center justify-center shrink-0">
    <img src="/mascot.svg" alt="TinTin" className="w-7 h-7 object-contain" style={{ aspectRatio: '997/1036' }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Buddy({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeTripId } = useApp();
  const tripId =
  activeTripId && activeTripId !== 'trip-default' && activeTripId !== 'default-trip'
  ? activeTripId
  : undefined;

  const {
    msgs,
    loading,
    send,
    triggerPlacesNearMe,
    triggerPlanMyDay,
    triggerPlanAroundHotel,
    triggerEditPlan,
    triggerCheckWeather,
  } = useChat(tripId);

  const [text, setText] = useState('');
  const [showLocPopup, setShowLocPopup] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 80);
    }
  }, [msgs, open]);

  const handleSend = (t: string) => {
    const trimmed = t.trim();
    if (!trimmed || loading) return;
    send(trimmed);
    setText('');
  };

  // Quick prompts
  const QUICK_PROMPTS = [
    {
      icon: <Map className="w-3.5 h-3.5" />,
      label: 'Places Near Me',
      action: () => {
        setShowLocPopup(true);
      },
    },
    {
      icon: <Calendar className="w-3.5 h-3.5" />,
      label: 'Plan My Day',
      action: () => triggerPlanMyDay(),
    },
    {
      icon: <CloudSun className="w-3.5 h-3.5" />,
      label: 'Check Weather',
      action: () => triggerCheckWeather(),
    },
    {
      icon: <Hotel className="w-3.5 h-3.5" />,
      label: 'Find Hotels',
      action: () => send('Find me hotels nearby'),
    },
    {
      icon: <Navigation className="w-3.5 h-3.5" />,
      label: 'Plan Around Hotel',
      action: () => triggerPlanAroundHotel(),
    },
    {
      icon: <PenLine className="w-3.5 h-3.5" />,
      label: 'Edit My Plan',
      action: () => triggerEditPlan(),
    },
  ];

  return (
    <AnimatePresence>
    {open && (
      <>
      {/* Backdrop */}
      <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 z-40 bg-ink-900/40 backdrop-blur-sm"
      />

      {/* Sheet */}
      <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="absolute inset-x-0 bottom-0 z-50 h-[78%] bg-white rounded-t-3xl shadow-card flex flex-col"
      >
      {/* Handle */}
      <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3 shrink-0" />

      {/* Header */}
      <div className="px-5 pt-3 pb-2 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
      <BuddyAvatar />
      <div>
      <div className="text-ink-900 font-bold leading-tight">TinTin</div>
      <div className="text-[11px] text-ink-500 leading-tight">Your AI travel companion</div>
      </div>
      </div>
      <button
      onClick={onClose}
      className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center text-ink-600 press"
      >
      <X className="w-4 h-4" />
      </button>
      </div>

      {/* Location permission popup */}
      <AnimatePresence>
      {showLocPopup && (
        <LocationPopup
        onAllow={() => {
          setShowLocPopup(false);
          triggerPlacesNearMe();
        }}
        onDismiss={() => setShowLocPopup(false)}
        />
      )}
      </AnimatePresence>

      {/* Quick prompts — show always */}
      <div className="px-5 pb-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
      {QUICK_PROMPTS.map(({ icon, label, action }) => (
        <button
        key={label}
        onClick={action}
        disabled={loading}
        className="press shrink-0 flex items-center gap-1.5 bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-50"
        >
        {icon}
        {label}
        </button>
      ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-3 space-y-3 no-scrollbar">
      {msgs.map((m) => (
        <MsgBubble key={m.id} msg={m} />
      ))}
      </div>

      {/* Input */}
      <div className="px-4 pb-5 pt-2 flex items-center gap-2 shrink-0 border-t border-ink-50">
      <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(text)}
      placeholder="Ask TinTin anything…"
      disabled={loading}
      className="flex-1 bg-ink-50 rounded-full px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50"
      />
      <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={() => handleSend(text)}
      disabled={loading || !text.trim()}
      className="w-11 h-11 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-glow disabled:bg-ink-300"
      >
      <Send className="w-4 h-4" />
      </motion.button>
      </div>
      </motion.div>
      </>
    )}
    </AnimatePresence>
  );
}
