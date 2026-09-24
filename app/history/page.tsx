'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { useApp } from '@/app/providers';
import { clearGenerations, deleteGeneration, listGenerations } from '@/lib/history';
import {
  fetchServerHistory,
  toggleFavorite,
  type DbGeneration,
} from '@/lib/db/generations';
import { migrateLocalHistory } from '@/lib/db/migrate-history';
import { PLATFORM_META } from '@/lib/brand';
import { PLATFORM_LABELS, type AdGeneration } from '@/lib/types';

type Row = AdGeneration | DbGeneration;

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
  const { t, toast } = useApp();
  const h = t.history;
  const [gens, setGens] = useState<Row[]>([]);
  const [mode, setMode] = useState<'server' | 'local'>('local');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      // Push any local history to the cloud once (no-op if already done / off).
      const m = await migrateLocalHistory().catch(() => null);
      if (m && m.migrated > 0 && active) {
        toast(`${m.migrated} history → cloud`);
      }
      const server = await fetchServerHistory({ limit: 100 }).catch(() => null);
      if (!active) return;
      if (server) {
        setMode('server');
        setGens(server);
      } else {
        setMode('local');
        setGens(listGenerations());
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeLocal = (id: string) => {
    deleteGeneration(id);
    setGens(listGenerations());
  };
  const clearLocal = () => {
    clearGenerations();
    setGens([]);
  };
  const onToggleFavorite = async (id: string) => {
    try {
      const next = await toggleFavorite(id);
      setGens((prev) =>
        prev.map((g) => (g.id === id ? { ...g, is_favorite: next } : g)),
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <>
      <PageHeader title={h.title} sub={h.sub} />

      <div className="banner-note">
        {mode === 'server' ? h.cloudNote : h.localNote}
      </div>

      {mode === 'local' && gens.length > 0 && (
        <div className="row mt8" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-glass btn-sm" onClick={clearLocal}>
            {t.common.delete} ({gens.length})
          </button>
        </div>
      )}

      <div className="card mt12">
        {loading ? (
          <div className="ld">
            <div className="sp" />
            {t.common.generating}
          </div>
        ) : gens.length === 0 ? (
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
                        style={{ background: 'var(--glass-strong)', color: 'var(--ink)' }}
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
                      {mode === 'server' ? (
                        <button
                          className="cbtn"
                          onClick={() => onToggleFavorite(g.id)}
                          aria-label={h.favorite}
                          title={h.favorite}
                          style={{ color: g.is_favorite ? 'var(--red)' : undefined }}
                        >
                          {g.is_favorite ? '♥' : '♡'}
                        </button>
                      ) : (
                        <button
                          className="cbtn"
                          onClick={() => removeLocal(g.id)}
                          aria-label="delete"
                        >
                          ✕
                        </button>
                      )}
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
