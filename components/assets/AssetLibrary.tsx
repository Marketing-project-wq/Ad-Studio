'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/app/providers';
import type { AdAsset, AssetType } from '@/lib/types';

const FILTERS: { key: AssetType | 'all'; labelKey: string }[] = [
  { key: 'all', labelKey: 'filterAll' },
  { key: 'logo', labelKey: 'filterLogo' },
  { key: 'product', labelKey: 'filterProduct' },
  { key: 'lifestyle', labelKey: 'filterLifestyle' },
  { key: 'background', labelKey: 'filterBackground' },
  { key: 'event', labelKey: 'filterEvent' },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetLibrary() {
  const { t, toast } = useApp();
  const a = t.assets;
  const [assets, setAssets] = useState<AdAsset[]>([]);
  const [filter, setFilter] = useState<AssetType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/assets');
      if (res.status === 503) {
        setConfigured(false);
        setAssets([]);
        return;
      }
      const json = await res.json();
      setConfigured(true);
      setAssets(json.assets || []);
    } catch {
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('file_type', filter === 'all' ? 'product' : filter);
        const res = await fetch('/api/assets', { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok) {
          toast(json?.error || 'Upload failed');
          if (res.status === 503) setConfigured(false);
        }
      }
      await load();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/assets?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await load();
  };

  const shown =
    filter === 'all' ? assets : assets.filter((x) => x.file_type === filter);

  return (
    <div>
      {!configured && <div className="banner-note">{a.supabaseNeeded}</div>}

      <div
        className={`dropzone${drag ? ' drag' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          upload(e.dataTransfer.files);
        }}
        style={{ padding: 28, marginBottom: 16 }}
      >
        <span className="dz-ico">⬆</span>
        {uploading ? t.common.generating : a.uploadZone}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          multiple
          hidden
          onChange={(e) => upload(e.target.files)}
        />
      </div>

      <div className="filter-tabs">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`filter-tab${filter === f.key ? ' act' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {a[f.labelKey as keyof typeof a]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ld">
          <div className="sp" />
          {t.common.generating}
        </div>
      ) : shown.length === 0 ? (
        <div className="es">
          <div className="es-ico">🖼</div>
          <p>{a.empty}</p>
        </div>
      ) : (
        <div className="asset-grid">
          {shown.map((asset) => (
            <div className="asset-card" key={asset.id}>
              <div className="asset-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.public_url} alt={asset.file_name} />
              </div>
              <div className="asset-meta">
                <div className="asset-name">{asset.file_name}</div>
                <div className="asset-sub">
                  {asset.file_type} · {formatSize(asset.file_size)}
                </div>
              </div>
              <div className="asset-actions">
                <a
                  className="cbtn"
                  href={asset.public_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.common.preview}
                </a>
                <button className="cbtn" onClick={() => remove(asset.id)}>
                  {t.common.delete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
