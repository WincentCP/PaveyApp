import { AnimatePresence, motion } from 'framer-motion';
import { Send, X, Cloud, Coffee, MapPinned } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { apiChat } from '../lib/api';
import { useApp } from '../context/AppContext';


interface Msg { from: 'buddy' | 'me'; text: string }

const QUICK: { icon: React.ElementType | null; imgSrc?: string; label: string }[] = [
  { icon: Cloud, label: 'Indoor cafes nearby' },
  { icon: Coffee, label: 'Best coffee in Ubud' },
  { icon: MapPinned, label: 'Less walking route' },
  { icon: null, imgSrc: '/mascot.svg', label: 'Hidden gems' },
];

const SUGGESTIONS = ['What to eat here?', 'How long should I stay?', 'Is it safe to visit?'];

export default function Buddy({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeTripId, itinerary, destinations } = useApp();
  const [text, setText] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: 'buddy', text: "Hey! 👋 I'm TinTin, your travel companion. Ask me anything about your trip!" },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' });
  }, [msgs, open]);

  // Build context string dari itinerary lokal untuk dikirim ke backend
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

  const send = async (t: string) => {
    if (!t.trim() || loading) return;
    setMsgs((m) => [...m, { from: 'me', text: t }]);
    setText('');
    setLoading(true);

    try {
      // Hanya kirim trip_id kalau UUID backend (bukan ID lokal)
      const tripId = activeTripId && /^[0-9a-f-]{36}$/.test(activeTripId)
        ? activeTripId
        : undefined;
      const context = buildContext();
      const res = await apiChat(t, tripId, context);
      setMsgs((m) => [...m, { from: 'buddy', text: res.reply }]);
    } catch (err: any) {
      const errMsg = err?.message?.includes('Session expired')
        ? 'Sesi habis, silakan login ulang 🔑'
        : 'Maaf, ada gangguan koneksi. Coba lagi ya! 🙏';
      setMsgs((m) => [...m, { from: 'buddy', text: errMsg }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-40 bg-ink-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute inset-x-0 bottom-0 z-50 h-[72%] bg-white rounded-t-3xl shadow-card flex flex-col"
          >
            <div className="px-5 pt-3 pb-2 flex items-center justify-between">
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
              <div className="flex items-center gap-3 mt-3">
                <BuddyAvatar />
                <div>
                  <div className="text-ink-900 font-bold leading-tight">TinTin</div>
                  <div className="text-[11px] text-ink-500 leading-tight">Your AI travel companion</div>
                </div>
              </div>
              <button onClick={onClose} className="mt-3 w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center text-ink-600 press">
                <X className="w-4 h-4" />
              </button>
            </div>

            {msgs.length === 1 && (
              <div className="px-5 pt-2 pb-1 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="press shrink-0 bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-3 space-y-3 no-scrollbar">
              {msgs.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-snug ${
                      m.from === 'me'
                        ? 'bg-brand-500 text-white rounded-br-md'
                        : 'bg-ink-50 text-ink-800 rounded-bl-md'
                    }`}
                  >
                    {m.text}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-ink-50 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-ink-400"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 pt-2 pb-1 flex gap-2 overflow-x-auto no-scrollbar">
              {QUICK.map(({ icon: Icon, imgSrc, label }) => (
                <button
                  key={label}
                  onClick={() => send(label)}
                  disabled={loading}
                  className="press shrink-0 flex items-center gap-1.5 bg-brand-50 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-50"
                >
                  {imgSrc
                    ? <img src={imgSrc} alt="" className="w-3.5 h-3.5 object-contain" />
                    : Icon && <Icon className="w-3.5 h-3.5" />}
                  {label}
                </button>
              ))}
            </div>

            <form
              className="px-4 pb-5 pt-2 flex items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); send(text); }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ask TinTin anything…"
                disabled={loading}
                className="flex-1 bg-ink-50 rounded-full px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50"
              />
              <motion.button
                type="submit"
                disabled={loading || !text.trim()}
                whileTap={{ scale: 0.92 }}
                className="w-11 h-11 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-glow disabled:bg-ink-300"
              >
                <Send className="w-4 h-4" />
              </motion.button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function BuddyAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const containerCls = size === 'sm' ? 'w-9 h-9' : 'w-11 h-11';
  const imgCls = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  return (
    <div className={`${containerCls} rounded-full bg-white border border-brand-500 shadow-sm flex items-center justify-center shrink-0`}>
      <img
        src="/mascot.svg"
        alt="TinTin"
        className={`${imgCls} object-contain`}
        style={{ aspectRatio: '997/1036' }}
      />
    </div>
  );
}