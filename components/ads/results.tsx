'use client';

import { useApp } from '@/app/providers';
import { LOGO_COLOR, LOGO_WHITE } from '@/lib/brand';
import CopyButton from './CopyButton';
import type {
  DisplayOutput,
  MetaOutput,
  PmaxOutput,
  SemOutput,
} from '@/lib/types';

function CharLine({
  index,
  text,
  limit,
}: {
  index: number;
  text: string;
  limit: number;
}) {
  const over = text.length > limit;
  return (
    <div className="hl-row">
      <span>
        {index + 1}. {text}
      </span>
      <span
        className="hl-ct"
        style={{ color: over ? 'var(--red)' : 'var(--ink-faint)' }}
      >
        {text.length}/{limit}
      </span>
    </div>
  );
}

const INTENT_COLOR: Record<string, string> = {
  high: 'var(--green)',
  medium: 'var(--amber)',
  low: 'var(--ink-faint)',
};

export function DisplayResult({ data }: { data: DisplayOutput }) {
  return (
    <div>
      <div className="slbl" style={{ fontSize: 14, marginBottom: 12 }}>
        Google Display Ads
      </div>
      {data.variations.map((v, i) => {
        const copyText = `=== ${v.name} ===\n\nShort Headlines:\n${v.short_headlines
          .map((h, j) => `${j + 1}. ${h} (${h.length})`)
          .join('\n')}\n\nLong Headlines:\n${v.long_headlines
          .map((h, j) => `${j + 1}. ${h} (${h.length})`)
          .join('\n')}\n\nDescriptions:\n${v.descriptions
          .map((d, j) => `${j + 1}. ${d} (${d.length})`)
          .join('\n')}\n\nCTA: ${v.cta}\nImage Text: ${v.image_text}`;
        return (
          <div className="agr" key={i}>
            <div
              className="agr-t"
              style={{
                background: 'rgba(66,133,244,.1)',
                color: '#4285f4',
                border: '1px solid rgba(66,133,244,.15)',
              }}
            >
              ● {v.name}
            </div>
            <div className="card hover-red">
              <div className="cact">
                <CopyButton text={copyText} />
              </div>
              <div className="slbl">Short Headlines (30)</div>
              {v.short_headlines.map((x, j) => (
                <CharLine key={j} index={j} text={x} limit={30} />
              ))}
              <div className="slbl">Long Headlines (90)</div>
              {v.long_headlines.map((x, j) => (
                <CharLine key={j} index={j} text={x} limit={90} />
              ))}
              <div className="slbl">Descriptions (90)</div>
              {v.descriptions.map((x, j) => (
                <CharLine key={j} index={j} text={x} limit={90} />
              ))}
              <div
                style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-faint)' }}
              >
                CTA: <strong style={{ color: 'var(--ink)' }}>{v.cta}</strong> ·
                Image:{' '}
                <strong style={{ color: 'var(--ink)' }}>{v.image_text}</strong>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SemResult({ data }: { data: SemOutput }) {
  return (
    <div>
      <div className="slbl" style={{ fontSize: 14, marginBottom: 12 }}>
        Search / SEM Ads
      </div>
      {data.ad_groups.map((ag, i) => {
        const copyText = `=== ${ag.name} ===\n\nKeywords:\n${ag.keywords
          .map((k) => {
            const f =
              k.match === 'exact'
                ? `[${k.keyword}]`
                : k.match === 'phrase'
                  ? `"${k.keyword}"`
                  : k.keyword;
            return `${f} (${k.intent})`;
          })
          .join('\n')}\n\nNegative: ${ag.negative_keywords
          .map((n) => '-' + n)
          .join(', ')}\n\nHeadlines:\n${ag.headlines
          .map((h, j) => `${j + 1}. ${h}`)
          .join('\n')}\n\nDescriptions:\n${ag.descriptions
          .map((d, j) => `${j + 1}. ${d}`)
          .join('\n')}`;
        return (
          <div className="agr" key={i}>
            <div
              className="agr-t"
              style={{
                background: 'rgba(28,138,75,.1)',
                color: 'var(--green)',
                border: '1px solid rgba(28,138,75,.15)',
              }}
            >
              ● {ag.name}
            </div>
            <div className="card hover-red">
              <div className="cact">
                <CopyButton text={copyText} />
              </div>
              <div className="slbl">Keywords</div>
              <div className="tag-wrap">
                {ag.keywords.map((k, j) => {
                  const f =
                    k.match === 'exact'
                      ? `[${k.keyword}]`
                      : k.match === 'phrase'
                        ? `"${k.keyword}"`
                        : k.keyword;
                  return (
                    <span className="kw-tag" key={j}>
                      {f}
                      <span
                        className="kw-dot"
                        style={{
                          background:
                            INTENT_COLOR[k.intent] || 'var(--ink-faint)',
                        }}
                      />
                    </span>
                  );
                })}
              </div>
              <div className="slbl">Negative Keywords</div>
              <div className="tag-wrap">
                {ag.negative_keywords.map((n, j) => (
                  <span className="neg-tag" key={j}>
                    -{n}
                  </span>
                ))}
              </div>
              <div className="slbl">Headlines (30)</div>
              {ag.headlines.map((x, j) => (
                <CharLine key={j} index={j} text={x} limit={30} />
              ))}
              <div className="slbl">Descriptions (90)</div>
              {ag.descriptions.map((x, j) => (
                <CharLine key={j} index={j} text={x} limit={90} />
              ))}
              {ag.sitelinks?.length > 0 && (
                <>
                  <div className="slbl">Sitelinks</div>
                  {ag.sitelinks.map((s, j) => (
                    <div key={j} style={{ fontSize: 12, padding: '2px 0' }}>
                      <strong style={{ color: 'var(--blue)' }}>{s.title}</strong>{' '}
                      — <span style={{ color: 'var(--ink-soft)' }}>{s.desc}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PmaxResult({ data }: { data: PmaxOutput }) {
  return (
    <div>
      <div className="slbl" style={{ fontSize: 14, marginBottom: 12 }}>
        Performance Max Assets
      </div>
      {data.asset_groups.map((ag, i) => {
        const copyText = `=== ${ag.name} ===\n\nHeadlines:\n${ag.headlines
          .map((h, j) => `${j + 1}. ${h}`)
          .join('\n')}\n\nLong Headlines:\n${ag.long_headlines
          .map((h, j) => `${j + 1}. ${h}`)
          .join('\n')}\n\nDescriptions:\n${ag.descriptions
          .map((d, j) => `${j + 1}. ${d}`)
          .join('\n')}\n\nBusiness: ${ag.business_name}\nSignals: ${ag.audience_signals.join(
          ', ',
        )}\nThemes: ${ag.search_themes.join(', ')}`;
        return (
          <div className="agr" key={i}>
            <div
              className="agr-t"
              style={{
                background: 'rgba(199,122,0,.1)',
                color: 'var(--amber)',
                border: '1px solid rgba(199,122,0,.15)',
              }}
            >
              ● {ag.name}
            </div>
            <div className="card hover-red">
              <div className="cact">
                <CopyButton text={copyText} />
              </div>
              <div className="slbl">Headlines (30)</div>
              {ag.headlines.map((x, j) => (
                <CharLine key={j} index={j} text={x} limit={30} />
              ))}
              <div className="slbl">Long Headlines (90)</div>
              {ag.long_headlines.map((x, j) => (
                <CharLine key={j} index={j} text={x} limit={90} />
              ))}
              <div className="slbl">Descriptions (90)</div>
              {ag.descriptions.map((x, j) => (
                <CharLine key={j} index={j} text={x} limit={90} />
              ))}
              <div
                style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid var(--border)',
                  fontSize: 11,
                  color: 'var(--ink-faint)',
                }}
              >
                Business:{' '}
                <strong style={{ color: 'var(--ink)' }}>
                  {ag.business_name}
                </strong>{' '}
                · CTA: <strong style={{ color: 'var(--ink)' }}>{ag.cta}</strong>
              </div>
              <div className="slbl">Audience Signals</div>
              <div className="tag-wrap">
                {ag.audience_signals.map((s, j) => (
                  <span
                    className="kw-tag"
                    key={j}
                    style={{
                      background: 'rgba(199,122,0,.08)',
                      color: 'var(--amber)',
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
              <div className="slbl">Search Themes</div>
              <div className="tag-wrap">
                {ag.search_themes.map((s, j) => (
                  <span className="kw-tag" key={j}>
                    {s}
                  </span>
                ))}
              </div>
              {ag.youtube_headline && (
                <>
                  <div className="slbl">YouTube</div>
                  <div style={{ fontSize: 12 }}>
                    <strong>Headline:</strong> {ag.youtube_headline}{' '}
                    <span className="hl-ct">
                      ({ag.youtube_headline.length}/40)
                    </span>
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <strong>Desc:</strong> {ag.youtube_description}{' '}
                    <span className="hl-ct">
                      ({ag.youtube_description.length}/90)
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MetaResult({
  data,
  cta,
}: {
  data: MetaOutput;
  cta: string;
}) {
  const { isDark } = useApp();
  const logo = isDark ? LOGO_WHITE : LOGO_COLOR;
  return (
    <div>
      <div className="slbl" style={{ fontSize: 14, marginBottom: 12 }}>
        Meta Ads
      </div>
      {data.variations.map((vr, i) => {
        const copyText = `=== ${vr.name} ===\n\nPrimary Text:\n${vr.primary_text}\n\nHeadline: ${vr.headline}\nDescription: ${vr.description}\nImage: ${vr.image_text}${
          vr.story_text ? `\nStory: ${vr.story_text}` : ''
        }`;
        return (
          <div className="agr" key={i}>
            <div
              className="agr-t"
              style={{
                background: 'rgba(0,104,201,.1)',
                color: 'var(--blue)',
                border: '1px solid rgba(0,104,201,.15)',
              }}
            >
              ● {vr.name}
            </div>
            <div className="mp">
              <div className="mh">
                <div className="mav">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo} alt="20FIT" crossOrigin="anonymous" />
                </div>
                <div>
                  <div className="mn2">20FIT Indonesia</div>
                  <div className="ms">Sponsored · 🌐</div>
                </div>
              </div>
              <div className="mb">{vr.primary_text}</div>
              <div
                className="mi"
                style={{
                  background: 'linear-gradient(135deg,var(--red),var(--blue))',
                }}
              >
                {vr.image_text || '20FIT'}
              </div>
              <div className="mcb">
                <div>
                  <div className="mhl">{vr.headline}</div>
                  <div className="mlk">{vr.description}</div>
                </div>
                <div className="mctab">{cta || 'Daftar Sekarang'}</div>
              </div>
            </div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <CopyButton text={copyText} label="Copy" />
              {vr.story_text && (
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                  Stories:{' '}
                  <strong style={{ color: 'var(--ink)' }}>
                    {vr.story_text}
                  </strong>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
