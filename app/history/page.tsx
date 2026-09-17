'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { useApp } from '@/app/providers';
import {
  clearGenerations,
  deleteGeneration,
  listGenerations,
} from '@/lib/history';
import { PLATFORM_META } from '@/lib/brand';
import { PLATFORM_LABELS, type AdGeneration } from '@/lib/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryPage() {
  const { t } = useApp();
  const [gens, setGens] = useState<AdGeneration[]>([]);

  useEffect(() => {
    setGens(listGenerations());
  }, []);

  const remove = (id: string) => {
    deleteGeneration(id);
    setGens(listGenerations());
  };
  const clearAll = () => {
    clearGenerations();
    setGens([]);
  };

  const h = t.history;

  return (
    <>
      <PageHeader title={h.title} sub={h.sub} />

      <div className="banner-note">{h.localNote}</div>

      {gens.length > 0 && (
        <div className="row mt8" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-glass btn-sm" onClick={clearAll}>
            {t.common.delete} ({gens.length})
          </button>
        </div>
      )}

      <div className="card mt12">
        {gens.length === 0 ? (
          <div className="es">
            <div className="es-ico">🗂</div>
            <p>{h.empty}</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>{h.colCampaign}</th>
                <th>{h.colPlatform}</th>
                <th>{h.colLang}</th>
                <th>{h.colDate}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {gens.map((g) => {
                const meta = PLATFORM_META[g.platform];
                const brief = g.input_brief as { product?: string };
                return (
                  <tr key={g.id}>
                    <td>{brief.product || '—'}</td>
                    <td>
                      <span
                        className="plat-tag"
                        style={{
                          background: 'var(--glass-strong)',
                          color: 'var(--ink)',
                        }}
                      >
                        <span
                          className="plat-dot"
                          style={{ background: meta.dot, width: 7, height: 7 }}
                        />
                        {PLATFORM_LABELS[g.platform]}
                      </span>
                    </td>
                    <td className="mono">{g.language.toUpperCase()}</td>
                    <td className="mono">{formatDate(g.created_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="cbtn"
                        onClick={() => remove(g.id)}
                        aria-label="delete"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
