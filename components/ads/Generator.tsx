'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useApp } from '@/app/providers';
import { useGenerate } from './useGenerate';
import type { Brief, GenerationOutput, Platform } from '@/lib/types';

export interface GenField {
  id: string;
  label: string;
  type?: 'input' | 'textarea' | 'select';
  placeholder?: string;
  options?: { value: string; label: string }[];
  full?: boolean;
  defaultValue?: string;
}

export default function Generator({
  platform,
  fields,
  buttonLabel,
  tips,
  tipsTitle,
  renderResult,
}: {
  platform: Platform;
  fields: GenField[];
  buttonLabel: string;
  tips: string;
  tipsTitle?: string;
  renderResult: (data: GenerationOutput, brief: Record<string, string>) => ReactNode;
}) {
  const { t } = useApp();
  const initial = useMemo(() => {
    const obj: Record<string, string> = {};
    for (const f of fields) {
      obj[f.id] =
        f.defaultValue ?? (f.type === 'select' ? f.options?.[0]?.value ?? '' : '');
    }
    return obj;
  }, [fields]);

  const [brief, setBrief] = useState<Record<string, string>>(initial);
  const { loading, error, data, run } = useGenerate(platform);

  const setField = (id: string, value: string) =>
    setBrief((prev) => ({ ...prev, [id]: value }));

  return (
    <div>
      <div className="fg">
        {fields.map((f) => (
          <div className={`fi${f.full ? ' full' : ''}`} key={f.id}>
            <label>{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea
                rows={2}
                placeholder={f.placeholder}
                value={brief[f.id]}
                onChange={(e) => setField(f.id, e.target.value)}
              />
            ) : f.type === 'select' ? (
              <select
                value={brief[f.id]}
                onChange={(e) => setField(f.id, e.target.value)}
              >
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                placeholder={f.placeholder}
                value={brief[f.id]}
                onChange={(e) => setField(f.id, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      <button
        className="btn btn-red"
        disabled={loading}
        onClick={() => run(brief as unknown as Brief)}
      >
        {loading ? (
          <>
            <span className="sp" /> {t.common.generating}
          </>
        ) : (
          <>✦ {buttonLabel}</>
        )}
      </button>

      <div style={{ marginTop: 16 }}>
        {loading && (
          <div className="ld">
            <div className="sp" />
            {t.common.loadingAi}
          </div>
        )}
        {!loading && error && (
          <div className="es">
            <div className="es-ico">⚠</div>
            <p>
              {t.common.errorPrefix}: {error}
            </p>
          </div>
        )}
        {!loading && !error && data && (renderResult(data, brief) as ReactNode)}
        {!loading && !error && !data && (
          <div className="es">
            <div className="es-ico">✦</div>
            <p>{t.common.emptyHint}</p>
          </div>
        )}
      </div>

      <div className="tips">
        <strong>{tipsTitle ?? 'Tips'}:</strong> {tips}
      </div>
    </div>
  );
}
