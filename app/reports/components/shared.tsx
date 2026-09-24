'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useApp } from '@/app/providers';

export const PLATFORM_SHORT: Record<string, string> = {
  google_display: 'Display',
  google_sem: 'SEM',
  google_pmax: 'PMax',
  meta: 'Meta',
};

// Stacking / slice order chosen so amber (PMax) and green (SEM) are never
// adjacent — that pair is weak under protanopia (validator ΔE 4.9). Combined
// with legends, direct labels and surface gaps, identity is never color-alone.
export const PLATFORM_ORDER = [
  'google_display',
  'google_sem',
  'meta',
  'google_pmax',
] as const;

const LIGHT: Record<string, string> = {
  google_display: '#4285f4',
  google_sem: '#1C8A4B',
  google_pmax: '#C77A00',
  meta: '#E4002B',
};
const DARK: Record<string, string> = {
  google_display: '#4DA8FF',
  google_sem: '#34C77B',
  google_pmax: '#FFB454',
  meta: '#FF3B57',
};

export interface ChartTheme {
  isDark: boolean;
  colors: Record<string, string>;
  surface: string;
  grid: string;
  tick: { fontSize: number; fontFamily: string; fill: string };
  tooltip: CSSProperties;
}

export function useChartTheme(): ChartTheme {
  const { isDark } = useApp();
  return {
    isDark,
    colors: isDark ? DARK : LIGHT,
    surface: isDark ? '#1c1c1e' : '#ffffff',
    grid: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
    tick: {
      fontSize: 11,
      fontFamily: 'var(--font-data)',
      fill: isDark ? '#A1A1A6' : '#6E6E73',
    },
    tooltip: {
      background: isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.96)',
      color: isDark ? '#F5F5F5' : '#1D1D1F',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)'}`,
      borderRadius: 14,
      fontFamily: 'var(--font-body)',
      fontSize: 12,
      boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
    },
  };
}

/** Shared loading / not-configured / empty wrapper for a report tab. */
export function ReportState({
  loading,
  notConfigured,
  error,
  empty,
  children,
}: {
  loading: boolean;
  notConfigured: boolean;
  error: string | null;
  empty: boolean;
  children: ReactNode;
}) {
  const { t } = useApp();
  if (loading) {
    return (
      <div className="ld">
        <div className="sp" />
        {t.common.generating}
      </div>
    );
  }
  if (notConfigured) {
    return <div className="banner-note">{t.reports.supabaseNeeded}</div>;
  }
  if (error) {
    return (
      <div className="es">
        <div className="es-ico">⚠</div>
        <p>
          {t.common.errorPrefix}: {error}
        </p>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="es">
        <div className="es-ico">✦</div>
        <p>{t.reports.noData}</p>
      </div>
    );
  }
  return <>{children}</>;
}
