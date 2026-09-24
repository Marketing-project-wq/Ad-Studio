'use client';

export interface DateRange {
  start: string;
  end: string;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const PRESETS = [7, 30, 90];

export default function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  return (
    <div
      className="row"
      style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}
    >
      {PRESETS.map((d) => (
        <button
          key={d}
          className="size-pill"
          onClick={() => onChange({ start: daysAgo(d), end: today() })}
        >
          {d}d
        </button>
      ))}
      <input
        type="date"
        value={value.start}
        max={value.end}
        onChange={(e) => onChange({ ...value, start: e.target.value })}
        style={inputStyle}
      />
      <span style={{ color: 'var(--ink-faint)' }}>→</span>
      <input
        type="date"
        value={value.end}
        min={value.start}
        onChange={(e) => onChange({ ...value, end: e.target.value })}
        style={inputStyle}
      />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--glass-strong)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '7px 10px',
  color: 'var(--ink)',
  fontFamily: 'var(--font-data)',
  fontSize: 12,
};
