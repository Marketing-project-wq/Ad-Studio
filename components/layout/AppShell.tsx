'use client';

import { useState, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import Logo from './Logo';

export default function AppShell({ children }: { children: ReactNode }) {
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
          <Logo height={26} />
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
