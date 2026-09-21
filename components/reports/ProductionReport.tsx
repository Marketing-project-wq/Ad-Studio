'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/app/providers';
import { listGenerations } from '@/lib/history';
import { summarizeProduction, generationsToCsv } from '@/lib/report';
import { PLATFORM_META } from '@/lib/brand';
import type { AdGeneration } from '@/lib/types';
import { BarList, MiniTrend, downloadCsv } from './Charts';

export default function ProductionReport() {
  const { t } = useApp();
  const r = t.reports;
  const [gens, setGens] = useState<AdGeneration[]>([]);

  useEffect(() => {
    setGens(listGenerations());
  }, []);

  const s = useMemo(() => summarizeProduction(gens), [gens]);

  if (gens.length === 0) {
    return (
      <div className="card">
        <div className="es">
          <div className="es-ico">✦</div>
          <p>{r.prodEmpty}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="kpi-grid">
        <Kpi label={r.prodTotal} value={s.total} />
        <Kpi label={r.prodWeek} value={s.thisWeek} />
        <Kpi label={r.prodMonth} value={s.thisMonth} />
        <Kpi label={r.prodActive} value={s.activeCampaigns} />
      </div>

      <div className="report-grid">
        <div className="card">
          <div className="slbl">{r.prodWeekly}</div>
          <MiniTrend points={s.weekly} color="var(--red)" height={90} />
        </div>
        <div className="card">
          <div className="slbl">{r.prodByPlatform}</div>
          <BarList
            items={s.byPlatform.map((p) => ({
              label: p.label,
              value: p.count,
              color: PLATFORM_META[p.platform].dot,
            }))}
          />
        </div>
      </div>

      <div className="report-grid">
        <div className="card">
          <div className="slbl">{r.prodByLang}</div>
          <BarList
            items={s.byLanguage.map((l) => ({
              label: l.label,
              value: l.value,
              color: 'var(--blue)',
            }))}
          />
        </div>
        <div className="card">
          <div className="slbl">{r.prodTopProducts}</div>
          <BarList
            items={s.topProducts.map((p) => ({
              label: p.label,
              value: p.value,
              color: 'var(--green)',
            }))}
          />
        </div>
      </div>

      <div className="row mt8" style={{ justifyContent: 'flex-end' }}>
        <button
          className="btn btn-glass btn-sm"
          onClick={() =>
            downloadCsv(
              `20fit-produksi-${new Date().toISOString().slice(0, 10)}.csv`,
              generationsToCsv(gens),
            )
          }
        >
          {r.exportCsv}
        </button>
      </div>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}
