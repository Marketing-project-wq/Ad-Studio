'use client';

import { useState, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import { useApp } from '@/app/providers';
import { LOGO_COLOR, LOGO_WHITE } from '@/lib/brand';

export default function AppShell({ children }: { children: ReactNode }) {
  const { isDark } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="shell">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile drawer */}
      <div
        className={`drawer-scrim${drawerOpen ? ' open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      {drawerOpen && <Sidebar drawer onNavigate={() => setDrawerOpen(false)} />}

      <main className="main">
        <div className="mobile-bar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={isDark ? LOGO_WHITE : LOGO_COLOR} alt="20FIT" />
          <button
            className="mode-btn"
            aria-label="Menu"
            onClick={() => setDrawerOpen(true)}
          >
            ☰ Menu
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
