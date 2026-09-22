'use client';

import { useEffect, useState } from 'react';
import {
  LOGO_COLOR,
  LOGO_COLOR_FALLBACK,
  LOGO_WHITE,
  LOGO_WHITE_FALLBACK,
} from '@/lib/brand';

/**
 * 20FIT wordmark. Loads the real brand PNG from media.20fit.id and, if that
 * request fails, falls back to the committed local SVG wordmark so the header
 * is never left with a broken image. Sizing comes from the parent CSS
 * (.sb-logo img / .mobile-bar img).
 */
export default function BrandLogo({
  isDark,
  className,
}: {
  isDark: boolean;
  className?: string;
}) {
  const primary = isDark ? LOGO_WHITE : LOGO_COLOR;
  const fallback = isDark ? LOGO_WHITE_FALLBACK : LOGO_COLOR_FALLBACK;
  const [src, setSrc] = useState(primary);
  const [errored, setErrored] = useState(false);

  // Reset to the real logo whenever the theme (and thus the primary URL) changes.
  useEffect(() => {
    setSrc(primary);
    setErrored(false);
  }, [primary]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="20FIT"
      className={className}
      // The remote PNG needs CORS; the local SVG fallback does not.
      crossOrigin={errored ? undefined : 'anonymous'}
      onError={() => {
        if (!errored) {
          setErrored(true);
          setSrc(fallback);
        }
      }}
    />
  );
}
