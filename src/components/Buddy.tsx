import { AnimatePresence, motion } from 'framer-motion';
import { Send, Sparkles, X, Cloud, Coffee, MapPinned } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Msg { from: 'buddy' | 'me'; text: string }

const QUICK = [
  { icon: Cloud, label: 'Indoor cafes nearby' },
  { icon: Coffee, label: 'Best coffee in Ubud' },
  { icon: MapPinned, label: 'Less walking route' },
  { icon: Sparkles, label: 'Hidden gems' },
];

export default function Buddy({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: 'buddy', text: "Hey Aria! 👋 I planned a chill route with 3 spots nearby. Want me to optimize for less walking?" },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' });
  }, [msgs, open]);

  const send = (t: string) => {
    if (!t.trim()) return;
    setMsgs((m) => [...m, { from: 'me', text: t }]);
    setText('');
    setTimeout(() => {
      const reply = generateReply(t);
      setMsgs((m) => [...m, { from: 'buddy', text: reply }]);
    }, 600);
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
              <div className="flex items-center gap-2 mt-3">
                <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-white">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-ink-900 font-bold leading-tight">Buddy</div>
                  <div className="text-[11px] text-ink-500 leading-tight">Your AI travel companion</div>
                </div>
              </div>
              <button onClick={onClose} className="mt-3 w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center text-ink-600 press">
                <X className="w-4 h-4" />
              </button>
            </div>

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
            </div>

            <div className="px-5 pt-2 pb-1 flex gap-2 overflow-x-auto no-scrollbar">
              {QUICK.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => send(label)}
                  className="press shrink-0 flex items-center gap-1.5 bg-brand-50 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full"
                >
                  <Icon className="w-3.5 h-3.5" />
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
                placeholder="Ask Buddy anything…"
                className="flex-1 bg-ink-50 rounded-full px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-300"
              />
              <motion.button
                type="submit"
                whileTap={{ scale: 0.92 }}
                className="w-11 h-11 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-glow"
              >
                <Send className="w-4.5 h-4.5" />
              </motion.button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function generateReply(t: string) {
  const lower = t.toLowerCase();
  if (lower.includes('rain') || lower.includes('indoor')) {
    return 'I found 3 cozy indoor cafes within 800m: Seniman Coffee, Locavore To Go, and Anomali. Want me to swap them in?';
  }
  if (lower.includes('walking') || lower.includes('less')) {
    return "Optimized! Your new route saves ~1.4 km of walking and shaves 18 mins. I'll update your itinerary.";
  }
  if (lower.includes('hidden') || lower.includes('gem')) {
    return "Goa Gajah cave is 12 mins away — quiet at this hour and only Rp 30K entry. Add it?";
  }
  if (lower.includes('budget') || lower.includes('cheap')) {
    return "You have Rp 1.76M left. I can plan a Rp 250K afternoon — interested?";
  }
  if (lower.includes('coffee')) {
    return "Seniman Coffee Studio (4.7★) is 6 mins away. Their Sumatra pour-over is unreal.";
  }
  return "Got it — I'll keep that in mind for your trip ✨";
}
