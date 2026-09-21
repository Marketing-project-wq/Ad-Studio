'use client';

import { useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import { useApp } from '@/app/providers';
import PerformanceReport from '@/components/reports/PerformanceReport';
import ProductionReport from '@/components/reports/ProductionReport';

type Tab = 'performance' | 'production';

export default function ReportsPage() {
  const { t } = useApp();
  const r = t.reports;
  const [tab, setTab] = useState<Tab>('performance');

  return (
    <>
      <PageHeader title={r.title} sub={r.sub} />

      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 10 }}>
        <Link href="/reports/settings" className="muted" style={{ fontWeight: 700 }}>
          ⚙ {r.settingsLink} →
        </Link>
      </div>

      <div className="sub-nav">
        <button
          className={`sub-btn${tab === 'performance' ? ' act' : ''}`}
          onClick={() => setTab('performance')}
        >
          {r.tabPerformance}
        </button>
        <button
          className={`sub-btn${tab === 'production' ? ' act' : ''}`}
          onClick={() => setTab('production')}
        >
          {r.tabProduction}
        </button>
      </div>

      {tab === 'performance' ? <PerformanceReport /> : <ProductionReport />}
    </>
  );
}
