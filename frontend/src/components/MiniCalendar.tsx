/**
 * Canonical date picker for the app. Originally lived inside OnboardingPage;
 * extracted so HomePage's intent sheet and any future date inputs share the
 * same look and interaction (7-column grid, range fill, today indicator,
 * past dates disabled).
 *
 * First tap selects the start; second tap (after a start exists and the new
 * date is later) selects the end. Caller owns the state.
 */

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface Props {
  startDate: Date | null;
  endDate: Date | null;
  onSelect: (d: Date) => void;
}

export default function MiniCalendar({ startDate, endDate, onSelect }: Props) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [viewYear, setViewYear] = useState(() => (startDate ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (startDate ?? today).getMonth());

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  return (
    <div className="bg-ink-50 rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="w-8 h-8 rounded-full bg-white flex items-center justify-center press shadow-soft">
          <ArrowLeft className="w-4 h-4 text-ink-700" />
        </button>
        <span className="text-sm font-bold text-ink-900">{monthLabel}</span>
        <button onClick={nextMonth} className="w-8 h-8 rounded-full bg-white flex items-center justify-center press shadow-soft">
          <ArrowRight className="w-4 h-4 text-ink-700" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-ink-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const isStart = startDate ? isSameDay(d, startDate) : false;
          const isEnd = endDate ? isSameDay(d, endDate) : false;
          const inRange = startDate && endDate ? d > startDate && d < endDate : false;
          const isPast = d < today;
          const isToday = isSameDay(d, today);
          return (
            <button
              key={i}
              onClick={() => !isPast && onSelect(d)}
              disabled={isPast}
              className={[
                'relative aspect-square flex items-center justify-center text-[11px] font-semibold transition-colors',
                isStart || isEnd ? 'bg-brand-500 text-white rounded-full z-10' : '',
                inRange ? 'bg-brand-100 text-brand-700 rounded-none' : '',
                !isStart && !isEnd && !inRange && !isPast ? `rounded-full hover:bg-ink-200 ${isToday ? 'ring-1 ring-brand-400' : ''}` : '',
                isPast ? 'text-ink-300 cursor-default' : 'text-ink-800',
              ].filter(Boolean).join(' ')}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
