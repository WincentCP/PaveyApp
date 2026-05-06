export default function TimePicker({
  value,
  onChange,
  label,
  warnIfBefore,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  warnIfBefore?: string;
}) {
  const [rawH, rawM] = value ? value.split(':').map(Number) : [9, 0];
  const amPm = rawH < 12 ? 'AM' : 'PM';
  const h12 = rawH % 12 || 12;

  const isWarn = warnIfBefore !== undefined ? value <= warnIfBefore : false;
  const fill = isWarn ? '#F97316' : '#3B5BFF';

  const update = (newH12: number, newAmPm: 'AM' | 'PM', newM: number) => {
    const h24 = newAmPm === 'AM'
      ? (newH12 === 12 ? 0 : newH12)
      : (newH12 === 12 ? 12 : newH12 + 12);
    onChange(`${String(h24).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
  };

  const hourPct = `${((h12 - 1) / 11) * 100}%`;
  const minPct = `${(rawM / 55) * 100}%`;

  return (
    <div className={`rounded-2xl p-4 ${isWarn ? 'bg-amber-50 border border-amber-200' : 'bg-ink-50'}`}>
      {label && (
        <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-3">{label}</div>
      )}

      {/* Large time display */}
      <div className="text-center mb-5">
        <span
          className="text-4xl font-bold tabular-nums font-display"
          style={{ color: isWarn ? '#F97316' : '#111827' }}
        >
          {String(h12).padStart(2, '0')}:{String(rawM).padStart(2, '0')}
        </span>
        <span className="text-lg font-semibold ml-2" style={{ color: isWarn ? '#F97316' : '#9CA3AF' }}>
          {amPm}
        </span>
      </div>

      {/* AM / PM */}
      <div className="flex gap-2 mb-4">
        {(['AM', 'PM'] as const).map((ap) => (
          <button
            key={ap}
            onClick={() => update(h12, ap, rawM)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold press transition-colors ${
              amPm === ap
                ? 'text-white shadow-sm'
                : 'bg-white text-ink-500 border border-ink-200'
            }`}
            style={amPm === ap ? { background: fill } : undefined}
          >
            {ap}
          </button>
        ))}
      </div>

      {/* Hour slider */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Hour</span>
          <span className="text-xs font-bold" style={{ color: fill }}>{h12}</span>
        </div>
        <input
          type="range" min={1} max={12} step={1}
          value={h12}
          onChange={(e) => update(Number(e.target.value), amPm, rawM)}
          className="time-slider w-full"
          style={{ '--val': hourPct, '--fill': fill } as React.CSSProperties}
        />
        <div className="flex justify-between mt-1.5 px-0.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
            <button
              key={h}
              onClick={() => update(h, amPm, rawM)}
              className="text-[8.5px] font-medium leading-none transition-colors press"
              style={{ color: h === h12 ? fill : '#D1D5DB', fontWeight: h === h12 ? 700 : 400 }}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      {/* Minute slider */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Minute</span>
          <span className="text-xs font-bold" style={{ color: fill }}>:{String(rawM).padStart(2, '0')}</span>
        </div>
        <input
          type="range" min={0} max={55} step={5}
          value={rawM}
          onChange={(e) => update(h12, amPm, Number(e.target.value))}
          className="time-slider w-full"
          style={{ '--val': minPct, '--fill': fill } as React.CSSProperties}
        />
        <div className="flex justify-between mt-1.5 px-0.5">
          {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
            <button
              key={m}
              onClick={() => update(h12, amPm, m)}
              className="text-[7px] font-medium leading-none press"
              style={{ color: rawM === m ? fill : '#D1D5DB', fontWeight: rawM === m ? 700 : 400 }}
            >
              {m === 0 ? ':00' : m % 15 === 0 ? `:${m}` : '·'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
