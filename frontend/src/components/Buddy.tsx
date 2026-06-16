/**
 * Buddy.tsx — TinTin AI travel companion chat widget
 *
 * Drop-in replacement for the existing Buddy.tsx.
 * Uses useChat hook that handles all intents: weather, places, travel plan, hotels.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Send, X, Compass, Calendar, CloudSun, Hotel } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useChat } from '../chatbot/hooks/useChat';
import WeatherWidget from '../chatbot/components/WeatherWidget';
import PlaceList from '../chatbot/components/PlaceList';
import ItineraryTimeline from '../chatbot/components/ItineraryTimeline';
import MapView from '../chatbot/components/MapView';
import type { ChatMsg } from '../chatbot/types';

const QUICK_PROMPTS = [
  {
    icon: Compass,
    label: 'Explore Places Near Me',
    prompt: 'Recommend historical museums and top local attractions around my current location',
  },
  {
    icon: Calendar,
    label: '1-Day Travel Plan',
    prompt: 'Generate a detailed 1-day itinerary with efficient routing',
  },
  {
    icon: CloudSun,
    label: 'Check Current Weather',
    prompt: 'What is the real-time weather update right now?',
  },
  {
    icon: Hotel,
    label: 'Plan Around My Hotel',
    prompt: 'I am staying at a local hotel, build a Pythagorean proximity route itinerary',
  },
];


// ─── Rich content renderer ────────────────────────────────────────────────────

function RichBlock({ msg }: { msg: ChatMsg }) {
  const r = msg.richContent;
  if (!r) return null;

  return (
    <div className="mt-2 space-y-2">
      {r.type === 'weather' && r.weather && (
        <WeatherWidget data={r.weather} />
      )}

      {(r.type === 'places' || r.type === 'hotels') && r.places && r.places.length > 0 && (
        <>
          <PlaceList places={r.places} showIndex={r.type === 'places'} />
          <MapView
            places={r.places}
            className="mt-2"
          />
        </>
      )}

      {r.type === 'travel_plan' && r.plan && (
        <>
          <ItineraryTimeline plan={r.plan} />
          <MapView
            places={r.plan.stops}
            className="mt-2"
          />
        </>
      )}
    </div>
  );
}

function formatMessageText(text: string): React.ReactNode {
  if (!text) return '';
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|_.*?_|\n)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part === '\n') {
          return <br key={index} />;
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
          return <em key={index} className="italic">{part.slice(1, -1)}</em>;
        }
        return part;
      })}
    </>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MsgBubble({ msg }: { msg: ChatMsg }) {
  const isMe = msg.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] ${isMe ? '' : 'w-full'}`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-snug ${
            isMe
              ? 'bg-brand-500 text-white rounded-br-md'
              : 'bg-ink-50 text-ink-800 rounded-bl-md'
          }`}
        >
          {msg.isStreaming && !msg.text ? (
            /* Typing dots */
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
            formatMessageText(msg.text)
          )}
        </div>

        {/* Rich content outside bubble */}
        {!isMe && <RichBlock msg={msg} />}
      </div>
    </motion.div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function BuddyAvatar() {
  return (
    <div className="w-11 h-11 rounded-full bg-white border border-brand-500 shadow-sm flex items-center justify-center shrink-0">
      <img
        src="/mascot.svg"
        alt="TinTin"
        className="w-7 h-7 object-contain"
        style={{ aspectRatio: '997/1036' }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Buddy({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeTripId, itinerary, destinations } = useApp();

  // Build context string from local itinerary to send to backend
  const buildContext = (): string | undefined => {
    const parts: string[] = [];
    if (destinations.length > 0) {
      parts.push(`Destinasi: ${destinations.map(d => d.name).join(' → ')}`);
    }
    if (itinerary.length > 0) {
      const stopNames = itinerary.slice(0, 8).map(p => p.name).join(', ');
      parts.push(`Rencana kunjungan: ${stopNames}${itinerary.length > 8 ? ` (+${itinerary.length - 8} lagi)` : ''}`);
    }
    return parts.length > 0 ? parts.join('. ') : undefined;
  };

  const itineraryContext = buildContext();
  const { msgs, loading, send } = useChat(activeTripId, itineraryContext);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' });
      }, 80);
    }
  }, [msgs, open]);

  const handleSend = (t: string) => {
    if (!t.trim() || loading) return;
    send(t);
    setText('');
  };

  const handleQuickPromptClick = (promptText: string) => {
    if (loading) return;
    const city = destinations[0]?.name;
    if (city) {
      send(`${promptText} in ${city}`);
    } else {
      send(promptText);
    }
  };

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
            className="absolute inset-x-0 bottom-0 z-50 h-[76%] bg-white rounded-t-3xl shadow-card flex flex-col"
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

            {/* Suggestions — show only at start */}
            {msgs.length === 1 && (
              <div className="px-5 pb-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => handleQuickPromptClick(qp.prompt)}
                    disabled={loading}
                    className="press shrink-0 bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-50"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            )}

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-5 py-3 space-y-3 no-scrollbar"
            >
              {msgs.map((m) => (
                <MsgBubble key={m.id} msg={m} />
              ))}
            </div>

            {/* Quick Chat Shortcut Prompts */}
            <div className="px-5 pt-2 pb-1 flex gap-2 overflow-x-auto no-scrollbar shrink-0 border-t border-ink-50 bg-white">
              {QUICK_PROMPTS.map((qp) => {
                const Icon = qp.icon;
                return (
                  <button
                    key={qp.label}
                    onClick={() => handleQuickPromptClick(qp.prompt)}
                    disabled={loading}
                    className="press shrink-0 flex items-center gap-1.5 bg-brand-50 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-50"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {qp.label}
                  </button>
                );
              })}
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