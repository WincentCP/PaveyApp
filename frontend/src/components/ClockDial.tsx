import { useRef } from 'react';

export default function ClockDial({
  value,
  onChange,
  warnIfBefore,
}: {
  value: string;
  onChange: (v: string) => void;
  warnIfBefore?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const [rawH, rawM] = value ? value.split(':').map(Number) : [9, 0];
  const amPm = rawH < 12 ? 'AM' : 'PM';
  const displayH = rawH % 12 || 12;

  const SIZE = 148;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 52;

  const hourAngleRad = (displayH / 12) * Math.PI * 2 - Math.PI / 2;
  const thumbX = CX + R * Math.cos(hourAngleRad);
  const thumbY = CY + R * Math.sin(hourAngleRad);

  const calcHour = (clientX: number, clientY: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = SIZE / rect.width;
    const scaleY = SIZE / rect.height;
    const x = (clientX - rect.left) * scaleX - CX;
    const y = (clientY - rect.top) * scaleY - CY;
    const rad = Math.atan2(y, x);
    const normalized = (rad + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    const h12 = Math.round((normalized / (Math.PI * 2)) * 12) % 12 || 12;
    const h24 = amPm === 'AM' ? (h12 === 12 ? 0 : h12) : h12 === 12 ? 12 : h12 + 12;
    onChange(`${String(h24).padStart(2, '0')}:${String(rawM).padStart(2, '0')}`);
  };

  const toggleAmPm = () => {
    const newH = rawH < 12 ? rawH + 12 : rawH - 12;
    onChange(`${String(newH).padStart(2, '0')}:${String(rawM).padStart(2, '0')}`);
  };

  const setMinute = (min: number) => {
    onChange(`${String(rawH).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  };

  const isWarn = warnIfBefore ? value <= warnIfBefore : false;
  const accent = isWarn ? '#F97316' : '#3B5BFF';
  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <div className="flex flex-col items-center w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[148px] touch-none cursor-pointer select-none"
        onMouseDown={(e) => { dragging.current = true; calcHour(e.clientX, e.clientY); }}
        onMouseMove={(e) => { if (dragging.current) calcHour(e.clientX, e.clientY); }}
        onMouseUp={() => { dragging.current = false; }}
        onMouseLeave={() => { dragging.current = false; }}
        onTouchStart={(e) => { dragging.current = true; calcHour(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchMove={(e) => { if (dragging.current) { e.preventDefault(); calcHour(e.touches[0].clientX, e.touches[0].clientY); } }}
        onTouchEnd={() => { dragging.current = false; }}
      >
        <circle cx={CX} cy={CY} r={CX - 2} fill={isWarn ? '#FFF7ED' : '#F4F4F8'} />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={isWarn ? '#FED7AA' : '#E2E2EA'} strokeWidth={1.5} />
        <line x1={CX} y1={CY} x2={thumbX} y2={thumbY} stroke={accent} strokeWidth={2} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={3.5} fill={accent} />
        {hours.map((hr, i) => {
          const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const mx = CX + (R + 10) * Math.cos(ang);
          const my = CY + (R + 10) * Math.sin(ang);
          const active = hr === displayH;
          return (
            <text key={hr} x={mx} y={my} textAnchor="middle" dominantBaseline="central"
              fontSize={active ? 9.5 : 8.5} fontWeight={active ? 700 : 400}
              fill={active ? accent : '#9CA3AF'}>
              {hr}
            </text>
          );
        })}
        <circle cx={thumbX} cy={thumbY} r={11} fill={accent} />
        <text x={thumbX} y={thumbY} textAnchor="middle" dominantBaseline="central" fontSize={7.5} fontWeight={700} fill="white">
          {displayH}
        </text>
        <text x={CX} y={CY - 7} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill={isWarn ? '#F97316' : '#1F2937'}>
          {String(displayH).padStart(2, '0')}:{String(rawM).padStart(2, '0')}
        </text>
        <text x={CX} y={CY + 7} textAnchor="middle" dominantBaseline="central" fontSize={8} fill={isWarn ? '#F97316' : '#6B7280'}>
          {amPm}
        </text>
      </svg>

      <div className="flex gap-1.5 mt-1.5 mb-1.5">
        {(['AM', 'PM'] as const).map((ap) => (
          <button key={ap} onClick={toggleAmPm}
            className={`px-3 py-0.5 rounded-full text-[10px] font-bold press transition-colors ${amPm === ap ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600'}`}>
            {ap}
          </button>
        ))}
      </div>

      <div className="flex gap-1 w-full px-0.5">
        {[0, 15, 30, 45].map((min) => (
          <button key={min} onClick={() => setMinute(min)}
            className={`flex-1 py-1 rounded-lg text-[10px] font-semibold press border transition-colors ${rawM === min ? 'bg-brand-500 text-white border-brand-500' : 'bg-ink-50 text-ink-600 border-ink-100'}`}>
            :{String(min).padStart(2, '0')}
          </button>
        ))}
      </div>
    </div>
  );
}
