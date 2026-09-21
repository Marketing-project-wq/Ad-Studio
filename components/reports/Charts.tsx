'use client';

// Lightweight, dependency-free charts built on inline SVG / flex bars so the
// reporting module adds no bundle weight and inherits the glass design tokens.

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
