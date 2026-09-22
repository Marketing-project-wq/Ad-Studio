'use client';

import { LOGO_COLOR, LOGO_WHITE } from '@/lib/brand';

/**
 * 20FIT wordmark. Served from local /public assets (color for light mode, white
 * for dark mode) so the header never depends on an external host. Sizing comes
 * from the parent CSS (.sb-logo img / .mobile-bar img).
 */
export default function BrandLogo({
  isDark,
  className,
}: {
  isDark: boolean;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={isDark ? LOGO_WHITE : LOGO_COLOR} alt="20FIT" className={className} />
  );
}
