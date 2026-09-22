import type { Platform } from './types';

// Brand marks, served locally from /public so the app never depends on an
// external host (color = light backgrounds, white = dark backgrounds).
export const LOGO_COLOR = '/brand/20fit-logo-color.svg';
export const LOGO_WHITE = '/brand/20fit-logo-white.svg';

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
