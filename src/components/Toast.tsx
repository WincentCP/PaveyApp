import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

type ToastTone = 'success' | 'info' | 'warn';
interface ToastItem { id: number; msg: string; tone: ToastTone }
interface ToastCtx { show: (msg: string, tone?: ToastTone) => void }
const C = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => {
    setItems((s) => s.filter((x) => x.id !== id));
  }, []);
  const show = useCallback((msg: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, tone }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 2400);
  }, []);
  return (
    <C.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center gap-2 pt-20 px-4">
        <AnimatePresence>
          {items.map((t) => {
            const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'warn' ? AlertTriangle : Info;
            const tones =
              t.tone === 'success' ? 'bg-ink-900 text-white'
                : t.tone === 'warn' ? 'bg-amber-500 text-white'
                : 'bg-brand-500 text-white';
            return (
              <motion.div
                key={t.id}
                initial={{ y: -16, opacity: 0, scale: 0.96 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                className={`pointer-events-auto flex items-center gap-2 ${tones} rounded-full pl-4 pr-2 py-2 shadow-card text-sm font-medium`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{t.msg}</span>
                <button
                  onClick={() => dismiss(t.id)}
                  className="ml-1 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/15 press shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </C.Provider>
  );
}

export function useToast() {
  const v = useContext(C);
  if (!v) throw new Error('useToast outside ToastProvider');
  return v;
}
