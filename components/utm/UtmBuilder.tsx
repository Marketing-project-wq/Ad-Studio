'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/app/providers';
import { buildUtmUrl, slugifyCampaign, UTM_MEDIUMS, UTM_SOURCES } from '@/lib/utm';
import { saveUtmLink } from '@/lib/history';
import { saveUtm } from '@/lib/db/generations';
import CopyButton from '@/components/ads/CopyButton';

export default function UtmBuilder() {
  const { t, toast } = useApp();
  const u = t.utm;

  const [url, setUrl] = useState('');
  const [source, setSource] = useState('');
  const [medium, setMedium] = useState('');
  const [campaign, setCampaign] = useState('');
  const [term, setTerm] = useState('');
  const [content, setContent] = useState('');
  const [customSource, setCustomSource] = useState('');
  const [customMedium, setCustomMedium] = useState('');

  const effSource = source === 'custom' ? customSource : source;
  const effMedium = medium === 'custom' ? customMedium : medium;

  const fullUrl = useMemo(
    () =>
      buildUtmUrl({
        url,
        source: effSource,
        medium: effMedium,
        campaign,
        term,
        content,
      }),
    [url, effSource, effMedium, campaign, term, content],
  );

  const suggestCampaign = () => {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    const base = [effMedium || 'promo', `q${q}`, now.getFullYear()]
      .filter(Boolean)
      .join('_');
    setCampaign(slugifyCampaign(`ems_${base}`));
  };

  const params: [string, string][] = [];
  if (effSource) params.push(['utm_source', effSource]);
  if (effMedium) params.push(['utm_medium', effMedium]);
  if (campaign) params.push(['utm_campaign', campaign]);
  if (term) params.push(['utm_term', term]);
  if (content) params.push(['utm_content', content]);

  return (
    <div>
      <div className="fg">
        <div className="fi full">
          <label>{u.url} *</label>
          <input
            placeholder="https://20fit.id/promo"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="fi">
          <label>{u.source} *</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">{u.choose}</option>
            {UTM_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="custom">{u.custom}</option>
          </select>
        </div>
        <div className="fi">
          <label>{u.medium} *</label>
          <select value={medium} onChange={(e) => setMedium(e.target.value)}>
            <option value="">{u.choose}</option>
            {UTM_MEDIUMS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
            <option value="custom">{u.custom}</option>
          </select>
        </div>
        {source === 'custom' && (
          <div className="fi">
            <label>{u.customSource}</label>
            <input
              placeholder="nama_source"
              value={customSource}
              onChange={(e) => setCustomSource(e.target.value)}
            />
          </div>
        )}
        {medium === 'custom' && (
          <div className="fi">
            <label>{u.customMedium}</label>
            <input
              placeholder="nama_medium"
              value={customMedium}
              onChange={(e) => setCustomMedium(e.target.value)}
            />
          </div>
        )}
        <div className="fi">
          <label>{u.campaign} *</label>
          <div className="row">
            <input
              placeholder="ems_promo_q4_2026"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
            />
            <button
              className="btn btn-glass btn-sm"
              type="button"
              onClick={suggestCampaign}
            >
              ✦ {u.aiSuggest}
            </button>
          </div>
        </div>
        <div className="fi">
          <label>{u.term}</label>
          <input
            placeholder="gym+jakarta"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <div className="fi full">
          <label>{u.content}</label>
          <input
            placeholder="cta_button_header"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      </div>

      {fullUrl ? (
        <div>
          <div className="slbl">{u.generatedUrl}</div>
          <div className="utm-output">{fullUrl}</div>
          <div className="utm-params">
            {params.map(([k, v]) => (
              <span key={k}>
                {k}={v}
              </span>
            ))}
          </div>
          <div className="row mt12" style={{ flexWrap: 'wrap' }}>
            <CopyButton
              text={fullUrl}
              label={u.copyUrl}
              className="btn btn-red btn-sm"
            />
            <button
              className="btn btn-glass btn-sm"
              type="button"
              onClick={() => {
                saveUtmLink(fullUrl, campaign);
                // Best-effort team-wide persist (no-op if Supabase is off).
                saveUtm({
                  baseUrl: url,
                  utmSource: effSource,
                  utmMedium: effMedium,
                  utmCampaign: campaign,
                  utmTerm: term,
                  utmContent: content,
                  fullUrl,
                }).catch(() => {});
                toast(u.saveLink);
              }}
            >
              {u.saveLink}
            </button>
          </div>
        </div>
      ) : (
        <div className="es">
          <div className="es-ico">🔗</div>
          <p>{u.sub}</p>
        </div>
      )}

      <div className="tips mt16">
        <strong>{u.conventionTitle}:</strong> {u.convention}
      </div>
    </div>
  );
}
