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
        {/* Value arc: one flat amber, like the bars below (no glow) */}
        {p > 0.001 && (
          <path
            d={arcPath(START, end)}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={16}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        )}
        {/* Value knob: a white disc riding on the track (no crossbar). */}
        <circle
          cx={polar(end).x}
          cy={polar(end).y}
          r={9}
          fill="#ffffff"
          stroke="var(--color-surface)"
          strokeWidth={2}
        />
        <circle
          cx={polar(end).x}
          cy={polar(end).y}
          r={3.5}
          fill="var(--color-accent)"
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
