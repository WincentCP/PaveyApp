interface PaveyLogoMarkProps {
  size?: number;
  color?: string;
}

interface PaveyLogoFullProps {
  variant?: 'horizontal' | 'vertical' | 'mark-only';
  color?: string;
  size?: number;
  className?: string;
}

export function PaveyLogoMark({ size = 80, color = '#3B5BFF' }: PaveyLogoMarkProps) {
  return (
    <svg
      width={size}
      height={size * 1.25}
      viewBox="0 0 100 125"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shadow ellipse */}
      <ellipse cx="50" cy="118" rx="16" ry="5" fill={color} opacity="0.35" />

      {/* Map pin body — teardrop shape */}
      <path
        d="M50 8 C27 8 12 24 12 44 C12 68 50 112 50 112 C50 112 88 68 88 44 C88 24 73 8 50 8Z"
        fill={color}
      />

      {/* Inner white circle for face */}
      <circle cx="50" cy="43" r="29" fill="white" />

      {/* Bear outer head — slightly wider than circle */}
      <ellipse cx="50" cy="45" rx="23" ry="21" fill={color} />

      {/* Inner face — white area */}
      <ellipse cx="50" cy="46" rx="19" ry="17" fill="white" />

      {/* Bear ears */}
      <circle cx="30" cy="29" r="7" fill={color} />
      <circle cx="70" cy="29" r="7" fill={color} />
      <circle cx="30" cy="29" r="4" fill="white" />
      <circle cx="70" cy="29" r="4" fill="white" />

      {/* Left eye — normal round */}
      <circle cx="43" cy="43" r="3.5" fill={color} />
      <circle cx="43" cy="43" r="1.5" fill="white" />

      {/* Right eye — winking (closed, crescent) */}
      <path
        d="M55 40 Q58.5 43.5 62 40"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Nose */}
      <ellipse cx="50" cy="50" rx="3" ry="2" fill={color} />

      {/* Mouth — happy curve */}
      <path
        d="M45 54 Q50 58 55 54"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Star/flower on top of head */}
      <g transform="translate(50, 18)">
        {[0, 60, 120, 180, 240, 300].map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const x = Math.cos(rad) * 6;
          const y = Math.sin(rad) * 6;
          return <circle key={i} cx={x} cy={y} r="3.5" fill="white" />;
        })}
        <circle cx="0" cy="0" r="4" fill="white" />
      </g>
    </svg>
  );
}

export function PaveyLogoText({ color = '#3B5BFF', size = 48 }: { color?: string; size?: number }) {
  const scale = size / 48;
  return (
    <svg
      width={120 * scale}
      height={size}
      viewBox="0 0 120 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* "pavey" wordmark — approximated with SVG text */}
      <text
        x="0"
        y="38"
        fontFamily="'Nunito', 'Poppins', system-ui, sans-serif"
        fontWeight="900"
        fontSize="42"
        fill={color}
        letterSpacing="-1"
      >
        pavey
      </text>
      {/* Underline accent (the swoosh under the 'y') */}
      <path
        d="M86 44 L120 44"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function PaveyLogo({
  variant = 'horizontal',
  color = '#3B5BFF',
  size = 48,
  className = '',
}: PaveyLogoFullProps) {
  if (variant === 'mark-only') {
    return <PaveyLogoMark size={size} color={color} />;
  }

  if (variant === 'vertical') {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <PaveyLogoMark size={size * 1.6} color={color} />
        <div style={{ marginTop: 8 }}>
          <svg
            width={size * 2.6}
            viewBox="0 0 130 50"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <text
              x="65"
              y="38"
              textAnchor="middle"
              fontFamily="'Nunito', 'Poppins', system-ui, sans-serif"
              fontWeight="900"
              fontSize="42"
              fill={color}
              letterSpacing="-1"
            >
              pavey
            </text>
          </svg>
        </div>
        <div
          style={{
            fontSize: size * 0.27,
            color,
            fontWeight: 600,
            marginTop: 4,
            letterSpacing: 0,
          }}
        >
          Your go-to travel companion.
        </div>
      </div>
    );
  }

  // horizontal
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <PaveyLogoMark size={size} color={color} />
      <div className="flex flex-col">
        <svg
          width={size * 2.6}
          height={size * 0.75}
          viewBox="0 0 130 38"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <text
            x="0"
            y="32"
            fontFamily="'Nunito', 'Poppins', system-ui, sans-serif"
            fontWeight="900"
            fontSize="34"
            fill={color}
            letterSpacing="-0.5"
          >
            pavey
          </text>
          <path d="M96 36 L128 36" stroke={color} strokeWidth="3" strokeLinecap="round" />
        </svg>
        <div style={{ fontSize: size * 0.22, color, fontWeight: 600, marginTop: -2 }}>
          Your go-to travel companion.
        </div>
      </div>
    </div>
  );
}
