'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/app/providers';
import { LOGO_COLOR, LOGO_WHITE } from '@/lib/brand';

interface NavItem {
  href: string;
  labelKey: keyof ReturnType<typeof navLabels>;
  dot: string;
}
interface NavSection {
  sectionKey: 'googleAds' | 'meta' | 'tools' | 'library' | 'insights' | null;
  items: NavItem[];
}

function navLabels(t: ReturnType<typeof useApp>['t']) {
  return t.nav;
}

const SECTIONS: NavSection[] = [
  {
    sectionKey: null,
    items: [{ href: '/', labelKey: 'dashboard', dot: 'var(--red)' }],
  },
  {
    sectionKey: 'insights',
    items: [{ href: '/reports', labelKey: 'reports', dot: 'var(--red)' }],
  },
  {
    sectionKey: 'googleAds',
    items: [
      { href: '/google/display', labelKey: 'display', dot: '#4285f4' },
      { href: '/google/sem', labelKey: 'sem', dot: 'var(--green)' },
      { href: '/google/pmax', labelKey: 'pmax', dot: 'var(--amber)' },
    ],
  },
  {
    sectionKey: 'meta',
    items: [{ href: '/meta', labelKey: 'metaAds', dot: 'var(--blue)' }],
  },
  {
    sectionKey: 'tools',
    items: [
      { href: '/utm', labelKey: 'utm', dot: 'var(--red)' },
      { href: '/banner', labelKey: 'banner', dot: 'var(--amber)' },
    ],
  },
  {
    sectionKey: 'library',
    items: [
      { href: '/assets', labelKey: 'assets', dot: 'var(--green)' },
      { href: '/history', labelKey: 'history', dot: 'var(--ink-faint)' },
      { href: '/settings', labelKey: 'settings', dot: 'var(--ink-faint)' },
    ],
  },
];

const TEAM_EMAIL = process.env.NEXT_PUBLIC_TEAM_EMAIL || 'digital@20fit.id';

export default function Sidebar({
  drawer = false,
  onNavigate,
}: {
  drawer?: boolean;
  onNavigate?: () => void;
}) {
  const { t, isDark } = useApp();
  const pathname = usePathname();
  const labels = navLabels(t);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside className={`sidebar${drawer ? ' drawer open' : ''}`}>
      <div className="sb-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={isDark ? LOGO_WHITE : LOGO_COLOR}
          alt="20FIT"
          crossOrigin="anonymous"
        />
      </div>

      {SECTIONS.map((section, i) => (
        <div key={i}>
          {section.sectionKey && (
            <div className="nav-section">{labels[section.sectionKey]}</div>
          )}
          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`nav-item${isActive(item.href) ? ' act' : ''}`}
            >
              <span className="dot" style={{ background: item.dot }} />
              {labels[item.labelKey]}
            </Link>
          ))}
        </div>
      ))}

      <div className="sb-footer">
        <div className="sb-email">{TEAM_EMAIL}</div>
      </div>
    </aside>
  );
}
