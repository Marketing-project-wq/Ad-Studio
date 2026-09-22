import type { Platform } from './types';

// Primary brand marks: the real 20FIT PNGs served from media.20fit.id
// (color = light backgrounds, white = dark backgrounds).
export const LOGO_COLOR =
  'https://media.20fit.id/wp-content/uploads/2026/04/20FITcolor.png';
export const LOGO_WHITE =
  'https://media.20fit.id/wp-content/uploads/2026/05/Copy-of-new-logo-20fit-putih-3.png';

// Committed SVG wordmark fallbacks — shown only if the remote PNG fails to load
// (offline, blocked, or 404). Served locally from /public so they always resolve.
export const LOGO_COLOR_FALLBACK = '/brand/20fit-wordmark-color.svg';
export const LOGO_WHITE_FALLBACK = '/brand/20fit-wordmark-white.svg';

export interface PlatformMeta {
  key: Platform;
  route: string;
  dot: string; // CSS color for the nav / tag dot
  navKey: 'display' | 'sem' | 'pmax' | 'metaAds';
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  google_display: {
    key: 'google_display',
    route: '/google/display',
    dot: '#4285f4',
    navKey: 'display',
  },
  google_sem: {
    key: 'google_sem',
    route: '/google/sem',
    dot: 'var(--green)',
    navKey: 'sem',
  },
  google_pmax: {
    key: 'google_pmax',
    route: '/google/pmax',
    dot: 'var(--amber)',
    navKey: 'pmax',
  },
  meta: {
    key: 'meta',
    route: '/meta',
    dot: 'var(--blue)',
    navKey: 'metaAds',
  },
};

/** Brand gradient options for the banner maker + meta preview. */
export const BRAND_GRADIENTS = [
  { name: 'Red / Blue', value: 'linear-gradient(135deg,#E4002B,#0068C9)' },
  { name: 'Red', value: 'linear-gradient(135deg,#E4002B,#8A0019)' },
  { name: 'Blue', value: 'linear-gradient(135deg,#0068C9,#003a70)' },
  { name: 'Dark', value: 'linear-gradient(135deg,#1D1D1F,#000000)' },
  { name: 'Amber', value: 'linear-gradient(135deg,#C77A00,#E4002B)' },
  { name: 'Green', value: 'linear-gradient(135deg,#1C8A4B,#0068C9)' },
];
