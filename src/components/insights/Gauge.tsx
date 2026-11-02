import React from "react";

interface GaugeProps {
  /** 0–1 */
  progress: number;
  /** Tick labels placed evenly along the arc, start to end. */
  ticks: string[];
  children?: React.ReactNode;
  ariaLabel: string;
}

// A 240° speedometer arc, opening at the bottom (Profound-style).
const SIZE = 260;
const R = 104;
const C = SIZE / 2;
const START = 150; // degrees, 0 = 3 o'clock, clockwise
const SWEEP = 240;

const polar = (deg: number, r = R) => {
  const rad = (deg * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
};

const arcPath = (from: number, to: number, r = R) => {
  const a = polar(from, r);
  const b = polar(to, r);
  const large = to - from > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
};

export const Gauge: React.FC<GaugeProps> = ({
  progress,
  ticks,
  children,
  ariaLabel,
}) => {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const end = START + SWEEP * p;

  return (
    <div
      className="relative mx-auto"
      style={{ width: SIZE, height: SIZE - 34 }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0 overflow-visible"
      >
        <defs>
          <linearGradient id="gauge-fill" x1="0" y1="1" x2="1" y2="0">
            <stop
              offset="0%"
              stopColor="var(--color-accent)"
              stopOpacity="0.55"
            />
            <stop offset="100%" stopColor="var(--color-accent)" />
          </linearGradient>
          <filter id="gauge-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        {/* Track */}
        <path
          d={arcPath(START, START + SWEEP)}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={16}
          strokeLinecap="round"
        />
        {/* Ticks outside the track, between the arc and the labels */}
        {Array.from({ length: 25 }, (_, i) => {
          const deg = START + (SWEEP * i) / 24;
          const a = polar(deg, R + 11);
          const b = polar(deg, R + (i % 6 === 0 ? 17 : 14));
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--color-line-strong)"
              strokeWidth={i % 6 === 0 ? 1.5 : 1}
            />
          );
        })}
        {p > 0.001 && (
          <>
            {/* Soft glow under the value arc */}
            <path
              d={arcPath(START, end)}
              fill="none"
              stroke="var(--color-accent)"
              strokeOpacity={0.45}
              strokeWidth={16}
              strokeLinecap="round"
              filter="url(#gauge-glow)"
            />
            <path
              d={arcPath(START, end)}
              fill="none"
              stroke="url(#gauge-fill)"
              strokeWidth={16}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </>
        )}
        {/* Needle knob: a white bar across the arc at the value */}
        <line
          x1={polar(end, R - 12).x}
          y1={polar(end, R - 12).y}
          x2={polar(end, R + 12).x}
          y2={polar(end, R + 12).y}
          stroke="#ffffff"
          strokeWidth={5}
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}
        />
        {/* Tick labels outside the arc */}
        {ticks.map((label, i) => {
          const deg = START + (SWEEP * i) / Math.max(1, ticks.length - 1);
          const pt = polar(deg, R + 30);
          return (
            <text
              key={i}
              x={pt.x}
              y={pt.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fill="var(--color-ink-3)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {label}
            </text>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
        {children}
      </div>
    </div>
  );
};
