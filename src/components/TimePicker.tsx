import { useEffect, useRef } from 'react';

const ITEM_H = 48;
const VISIBLE = 5;
const PAD = 2;

function DrumWheel({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const currentIdx = Math.max(0, items.indexOf(value));

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = currentIdx * ITEM_H;
  }, []); // eslint-disable-line

  const handleScroll = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(ref.current.scrollTop / ITEM_H)));
      ref.current.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' });
      onChange(items[idx]);
    }, 100);
  };

  return (
    <div className="relative overflow-hidden rounded-xl" style={{ width: 80, height: VISIBLE * ITEM_H }}>
      <div className="absolute inset-x-0 top-0 pointer-events-none z-10" style={{ height: PAD * ITEM_H, background: 'linear-gradient(to bottom, white 30%, transparent)' }} />
      <div className="absolute inset-x-0 bottom-0 pointer-events-none z-10" style={{ height: PAD * ITEM_H, background: 'linear-gradient(to top, white 30%, transparent)' }} />
      <div className="absolute inset-x-2 rounded-xl bg-brand-50 border border-brand-200 pointer-events-none" style={{ top: PAD * ITEM_H, height: ITEM_H, zIndex: 5 }} />
      <div
        ref={ref}
        className="absolute inset-0 overflow-y-scroll no-scrollbar"
        style={{ scrollSnapType: 'y mandatory' }}
        onScroll={handleScroll}
      >
        {Array.from({ length: PAD }).map((_, i) => (
          <div key={`pt${i}`} style={{ height: ITEM_H, scrollSnapAlign: 'center' }} />
        ))}
        {items.map((item, i) => {
          const diff = Math.abs(i - currentIdx);
          return (
            <div
              key={item}
              style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
              className={`flex items-center justify-center select-none font-bold transition-all ${
                diff === 0 ? 'text-brand-600 text-2xl' :
                diff === 1 ? 'text-ink-400 text-lg' :
                'text-ink-200 text-base'
              }`}
            >
              {item}
            </div>
          );
        })}
        {Array.from({ length: PAD }).map((_, i) => (
          <div key={`pb${i}`} style={{ height: ITEM_H, scrollSnapAlign: 'center' }} />
        ))}
      </div>
    </div>
  );
}

export default function TimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [hStr = '09', mStr = '00'] = value.split(':');
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  return (
    <div className="flex flex-col items-center gap-2">
      {label && <div className="text-xs font-bold tracking-widest text-ink-500 mb-1">{label}</div>}
      <div className="flex items-center gap-3">
        <DrumWheel items={hours} value={hStr} onChange={(h) => onChange(`${h}:${mStr}`)} />
        <span className="text-3xl font-extrabold text-ink-700 mb-1">:</span>
        <DrumWheel items={minutes} value={mStr} onChange={(m) => onChange(`${hStr}:${m}`)} />
      </div>
      <div className="text-sm font-bold text-ink-500 mt-1">{value}</div>
    </div>
  );
}
