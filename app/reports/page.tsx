'use client';

import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { useApp } from '@/app/providers';
import DateRangeFilter, { type DateRange } from './components/DateRangeFilter';
import ProductivityTab from './components/ProductivityTab';
import QualityTab from './components/QualityTab';
import ContentTab from './components/ContentTab';

type Tab = 'productivity' | 'quality' | 'content';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const { t } = useApp();
  const r = t.reports;
  const [tab, setTab] = useState<Tab>('productivity');
  const [range, setRange] = useState<DateRange>({
    start: daysAgo(30),
    end: today(),
  });

  return (
    <>
      <PageHeader title={r.title} sub={r.subtitle} />

      <div style={{ marginBottom: 12 }}>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      <div className="sub-nav">
        <button
          className={`sub-btn${tab === 'productivity' ? ' act' : ''}`}
          onClick={() => setTab('productivity')}
        >
          {r.tabProductivity}
        </button>
        <button
          className={`sub-btn${tab === 'quality' ? ' act' : ''}`}
          onClick={() => setTab('quality')}
        >
          {r.tabQuality}
        </button>
        <button
          className={`sub-btn${tab === 'content' ? ' act' : ''}`}
          onClick={() => setTab('content')}
        >
          {r.tabContent}
        </button>
      </div>

      {tab === 'productivity' && (
        <ProductivityTab startDate={range.start} endDate={range.end} />
      )}
      {tab === 'quality' && (
        <QualityTab startDate={range.start} endDate={range.end} />
      )}
      {tab === 'content' && (
        <ContentTab startDate={range.start} endDate={range.end} />
      )}
    </>
  );
}
