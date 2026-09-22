'use client';

// Lightweight, dependency-free charts built on inline SVG / flex bars so the
// reporting module adds no bundle weight and inherits the glass design tokens.

import { useState } from 'react';
import { formatNumber } from '@/lib/metrics';
import type { Lang } from '@/lib/types';

export interface ChartItem {
  label: string;
  value: number;
  color?: string;
  sub?: string;
}

/** Horizontal bar list — the workhorse for categorical breakdowns. */
export function BarList({
  items,
  format,
  empty = 'No data',
}: {
  items: ChartItem[];
  format?: (n: number) => string;
  empty?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <div className="muted">{empty}</div>;
  return (
    <div className="barlist">
      {items.map((it) => (
        <div className="barlist-row" key={it.label}>
          <div className="barlist-label" title={it.label}>
            {it.label}
          </div>
          <div className="barlist-track">
            <div
              className="barlist-fill"
              style={{
                width: `${Math.max(2, (it.value / max) * 100)}%`,
                background: it.color || 'var(--red)',
              }}
            />
          </div>
          <div className="barlist-val">
            {format ? format(it.value) : it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Compact area+line trend from a series of values. */
export function MiniTrend({
  points,
  color = 'var(--red)',
  height = 70,
}: {
  points: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  const w = 300;
  const h = height;
  const pad = 6;
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.value));

  if (n === 0) return <div className="muted">No data</div>;

  const x = (i: number) => (n <= 1 ? w / 2 : (i / (n - 1)) * (w - pad * 2) + pad);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${(h - pad).toFixed(1)} L${x(0).toFixed(
    1,
  )},${(h - pad).toFixed(1)} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={h}
        preserveAspectRatio="none"
        role="img"
        aria-label="trend"
      >
        <path d={area} fill={color} opacity={0.12} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={2.5} fill={color} />
        ))}
      </svg>
      <div className="trend-axis">
        {points.map((p, i) => (
          <span key={i} className={i === 0 || i === n - 1 ? '' : 'trend-axis-mid'}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface RankedItem {
  label: string;
  value: number;
  badge?: string;
  badgeTone?: 'good' | 'warn' | 'bad' | 'neutral';
}

/** Ranked horizontal bars with an optional per-row badge (e.g. a ROAS chip). */
export function RankedBars({
  items,
  format,
  empty = 'No data',
}: {
  items: RankedItem[];
  format?: (n: number) => string;
  empty?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <div className="muted">{empty}</div>;
  return (
    <div className="ranked">
      {items.map((it, i) => (
        <div className="ranked-row" key={it.label}>
          <div className="ranked-rank">{i + 1}</div>
          <div className="ranked-main">
            <div className="ranked-head">
              <span className="ranked-label" title={it.label}>
                {it.label}
              </span>
              {it.badge && (
                <span className={`ranked-badge ${it.badgeTone || 'neutral'}`}>
                  {it.badge}
                </span>
              )}
            </div>
            <div className="ranked-track">
              <div
                className="ranked-fill"
                style={{ width: `${Math.max(3, (it.value / max) * 100)}%` }}
              />
            </div>
          </div>
          <div className="ranked-val">{format ? format(it.value) : it.value}</div>
        </div>
      ))}
    </div>
  );
}

// ---- Scatter plot: campaign efficiency (spend × ROAS) ----------------------
export interface ScatterDatum {
  campaign: string;
  spend: number;
  revenue: number;
  roas: number | null; // null = no purchase revenue → plotted on the floor, grey
  conversions: number;
}

export interface ScatterLabels {
  x: string;
  y: string;
  breakEven: string;
  spend: string;
  revenue: string;
  roas: string;
  conversions: string;
}

/** Round an axis maximum up to a tick-friendly value, returning max + step. */
function niceScale(max: number, ticks = 4): { max: number; step: number } {
  if (!(max > 0)) return { max: ticks, step: 1 };
  const rawStep = max / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  const step = niceNorm * mag;
  return { max: step * ticks, step };
}

function trimNum(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

/** Compact currency for axis ticks: id → rb/jt/M, en → k/M/B. */
function axisMoney(n: number, lang: Lang): string {
  const [k, m, b] = lang === 'id' ? [' rb', ' jt', ' M'] : ['k', 'M', 'B'];
  if (n >= 1e9) return `${trimNum(n / 1e9)}${b}`;
  if (n >= 1e6) return `${trimNum(n / 1e6)}${m}`;
  if (n >= 1e3) return `${trimNum(n / 1e3)}${k}`;
  return `${Math.round(n)}`;
}

function roasBand(roas: number | null): 'good' | 'warn' | 'bad' | 'neutral' {
  if (roas === null) return 'neutral';
  if (roas > 3) return 'good';
  if (roas >= 1) return 'warn';
  return 'bad';
}
const BAND_COLOR: Record<string, string> = {
  good: 'var(--green)',
  warn: 'var(--amber)',
  bad: 'var(--red)',
  neutral: 'var(--ink-faint)',
};

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function ScatterPlot({
  points,
  labels,
  lang,
  empty = 'No data',
}: {
  points: ScatterDatum[];
  labels: ScatterLabels;
  lang: Lang;
  empty?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return <div className="muted">{empty}</div>;

  // Compact viewBox; the wrapper caps the rendered height at ~290px.
  const W = 520;
  const H = 270;
  const padL = 44;
  const padR = 14;
  const padT = 12;
  const padB = 34;
  const x0 = padL;
  const x1 = W - padR;
  const y0 = padT;
  const y1 = H - padB;
  const plotW = x1 - x0;
  const plotH = y1 - y0;

  const maxSpend = Math.max(...points.map((p) => p.spend));
  const roasVals = points.map((p) => p.roas).filter((v): v is number => v !== null);
  const maxRoas = roasVals.length ? Math.max(...roasVals) : 0;
  const maxConv = Math.max(1, ...points.map((p) => p.conversions));

  const xs = niceScale(maxSpend, 4);
  const ys = niceScale(Math.max(maxRoas, 1.2), 4); // always show the break-even line

  const sx = (spend: number) => x0 + (spend / xs.max) * plotW;
  const sy = (roas: number) => y1 - (roas / ys.max) * plotH;
  const radius = (conv: number) => 2.5 + Math.sqrt(conv / maxConv) * 6.5; // r 2.5…9 → ⌀ 5…18

  const xTicks = Array.from({ length: 5 }, (_, i) => i * xs.step);
  const yTicks = Array.from({ length: 5 }, (_, i) => i * ys.step);
  const medianX = sx(median(points.map((p) => p.spend)));
  const beY = sy(1); // break-even
  const hoverPt = hover !== null ? points[hover] : null;
  const trunc = (s: string) => (s.length > 15 ? `${s.slice(0, 15)}…` : s);

  return (
    <div className="scatter-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label={labels.y}>
        {/* horizontal gridlines + Y ticks */}
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line x1={x0} y1={sy(v)} x2={x1} y2={sy(v)} className="sc-grid" />
            <text x={x0 - 6} y={sy(v) + 3} textAnchor="end" className="sc-tick">
              {trimNum(v)}x
            </text>
          </g>
        ))}
        {/* X ticks */}
        {xTicks.map((v) => (
          <text key={`x${v}`} x={sx(v)} y={y1 + 13} textAnchor="middle" className="sc-tick">
            {axisMoney(v, lang)}
          </text>
        ))}
        {/* axes */}
        <line x1={x0} y1={y0} x2={x0} y2={y1} className="sc-axis" />
        <line x1={x0} y1={y1} x2={x1} y2={y1} className="sc-axis" />

        {/* subtle median-spend divider + break-even (ROAS = 1) reference lines */}
        <line x1={medianX} y1={y0} x2={medianX} y2={y1} className="sc-ref" />
        <line x1={x0} y1={beY} x2={x1} y2={beY} className="sc-breakeven" />
        <text x={x1 - 3} y={beY - 4} textAnchor="end" className="sc-be-label">
          {labels.breakEven}
        </text>

        {/* dots */}
        {points.map((p, i) => (
          <circle
            key={p.campaign}
            cx={sx(p.spend)}
            cy={sy(p.roas ?? 0)}
            r={radius(p.conversions)}
            fill={BAND_COLOR[roasBand(p.roas)]}
            className={`sc-dot${hover === i ? ' on' : ''}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          >
            <title>{`${p.campaign} — ${labels.roas} ${formatNumber(p.roas, 'multiplier', lang)}`}</title>
          </circle>
        ))}

        {/* per-dot campaign labels (informational; overlap is fine) */}
        {points.map((p) => (
          <text
            key={`l-${p.campaign}`}
            x={sx(p.spend) + radius(p.conversions) + 4}
            y={sy(p.roas ?? 0) + 3}
            className="sc-point-label"
            pointerEvents="none"
          >
            {trunc(p.campaign)}
          </text>
        ))}

        {/* axis titles */}
        <text x={(x0 + x1) / 2} y={H - 4} textAnchor="middle" className="sc-axis-title">
          {labels.x}
        </text>
        <text
          x={11}
          y={(y0 + y1) / 2}
          textAnchor="middle"
          transform={`rotate(-90 11 ${(y0 + y1) / 2})`}
          className="sc-axis-title"
        >
          {labels.y}
        </text>
      </svg>

      {hoverPt && (
        <div
          className="scatter-tip"
          style={{
            left: `${(sx(hoverPt.spend) / W) * 100}%`,
            top: `${(sy(hoverPt.roas ?? 0) / H) * 100}%`,
          }}
        >
          <div className="scatter-tip-title">{hoverPt.campaign}</div>
          <div className="scatter-tip-row">
            <span>{labels.spend}</span>
            <span>{formatNumber(hoverPt.spend, 'currency', lang)}</span>
          </div>
          <div className="scatter-tip-row">
            <span>{labels.revenue}</span>
            <span>{formatNumber(hoverPt.revenue, 'currency', lang)}</span>
          </div>
          <div className="scatter-tip-row">
            <span>{labels.roas}</span>
            <span>{formatNumber(hoverPt.roas, 'multiplier', lang)}</span>
          </div>
          <div className="scatter-tip-row">
            <span>{labels.conversions}</span>
            <span>{formatNumber(hoverPt.conversions, 'int', lang)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Trigger a client-side CSV download. */
export function downloadCsv(filename: string, csv: string): void {
  try {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    /* download unavailable */
  }
}
