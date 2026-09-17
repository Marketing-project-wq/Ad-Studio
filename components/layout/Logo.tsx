'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/app/providers';
import { LOGO_COLOR, LOGO_WHITE } from '@/lib/brand';

/**
 * 20FIT wordmark. Renders the local SVG (light/dark aware, no cross-origin
 * request) and falls back to a Barlow Condensed text wordmark if the image
 * ever fails to load. The colors come from CSS vars so the fallback swaps with
 * the theme automatically.
 */
export default function Logo({ height = 32 }: { height?: number }) {
  const { isDark } = useApp();
  const [errored, setErrored] = useState(false);

  // Retry the image when the theme (and therefore the src) changes.
  useEffect(() => {
    setErrored(false);
  }, [isDark]);

  if (errored) {
    return (
      <span
        aria-label="20FIT"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: Math.round(height * 0.72),
          lineHeight: 1,
          letterSpacing: '-0.5px',
          color: 'var(--ink)',
        }}
      >
        20<span style={{ color: 'var(--red)' }}>FIT</span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={isDark ? LOGO_WHITE : LOGO_COLOR}
      alt="20FIT"
      onError={() => setErrored(true)}
      style={{ height, width: 'auto', objectFit: 'contain', display: 'block' }}
    />
  );
}
