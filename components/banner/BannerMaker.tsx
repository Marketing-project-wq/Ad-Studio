'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/app/providers';
import { BRAND_GRADIENTS } from '@/lib/brand';
import type { MetaOutput } from '@/lib/types';

interface Size {
  key: string;
  label: string;
  w: number;
  h: number;
}
const SIZES: Size[] = [
  { key: 'feed', label: 'Feed 1200×628', w: 1200, h: 628 },
  { key: 'square', label: 'Square 1080', w: 1080, h: 1080 },
  { key: 'story', label: 'Story 1080×1920', w: 1080, h: 1920 },
  { key: 'leaderboard', label: 'Display 728×90', w: 728, h: 90 },
  { key: 'rectangle', label: 'Rectangle 300×250', w: 300, h: 250 },
];

type Style = 'bold' | 'minimal' | 'gradient' | 'photo';

export default function BannerMaker() {
  const { t, toast, lang } = useApp();
  const b = t.banner;

  const [size, setSize] = useState<Size>(SIZES[0]);
  const [headline, setHeadline] = useState('20 MENIT = 2 JAM GYM');
  const [sub, setSub] = useState('Teknologi EMS dari Jerman. Coba sesi pertama gratis.');
  const [cta, setCta] = useState('Daftar Sekarang');
  const [badge, setBadge] = useState('FREE TRIAL');
  const [gradient, setGradient] = useState(BRAND_GRADIENTS[0].value);
  const [style, setStyle] = useState<Style>('gradient');
  const [logo, setLogo] = useState<string | null>(null);
  const [bg, setBg] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const bannerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  // Fit the preview to the available stage width.
  useEffect(() => {
    const measure = () => {
      const stageW = stageRef.current?.clientWidth ?? 400;
      setScale(Math.min(1, (stageW - 16) / size.w));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [size]);

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const onLogo = async (files: FileList | null) => {
    if (files?.[0]) setLogo(await fileToDataUrl(files[0]));
  };
  const onBg = async (files: FileList | null) => {
    if (files?.[0]) {
      setBg(await fileToDataUrl(files[0]));
      setStyle('photo');
    }
  };

  const aiCopy = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'meta',
          language: lang,
          brief: { product: headline || 'EMS Training 20 menit' },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json?.error || 'AI error');
        return;
      }
      const data = json.data as MetaOutput;
      const v = data.variations?.[0];
      if (v) {
        setHeadline(v.headline?.toUpperCase() || headline);
        setSub(v.description || sub);
        if (v.image_text) setBadge(v.image_text.toUpperCase());
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'AI error');
    } finally {
      setAiLoading(false);
    }
  };

  const download = async () => {
    if (!bannerRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(bannerRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `20fit-banner-${size.key}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const compact = size.h <= 200;
  const headSize = compact
    ? Math.max(14, Math.round(size.h * 0.24))
    : Math.max(20, Math.round(size.w * 0.058));
  const pad = compact ? Math.round(size.h * 0.14) : Math.round(size.w * 0.06);

  const overlay =
    style === 'photo'
      ? 'linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,.72))'
      : 'linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.28))';

  const bgStyle: React.CSSProperties = bg
    ? {
        backgroundImage: `${overlay}, url(${bg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { backgroundImage: gradient };

  const ctaStyle: React.CSSProperties =
    style === 'minimal'
      ? {
          background: 'transparent',
          color: '#fff',
          border: '2px solid #fff',
        }
      : style === 'gradient'
        ? { background: '#E4002B', color: '#fff' }
        : { background: '#fff', color: '#E4002B' };

  const LogoMark = () =>
    logo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt="logo"
        style={{ height: headSize * 0.9, objectFit: 'contain' }}
        crossOrigin="anonymous"
      />
    ) : (
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          color: '#fff',
          fontSize: headSize * 0.7,
          letterSpacing: '-0.02em',
        }}
      >
        20FIT
      </span>
    );

  return (
    <div className="banner-split">
      {/* ===== PREVIEW ===== */}
      <div className="canvas-wrap">
        <div className="size-row">
          {SIZES.map((s) => (
            <button
              key={s.key}
              className={`size-pill${size.key === s.key ? ' act' : ''}`}
              onClick={() => setSize(s)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="canvas-stage" ref={stageRef}>
          <div
            style={{
              width: size.w * scale,
              height: size.h * scale,
              overflow: 'hidden',
              margin: '0 auto',
              borderRadius: 8,
            }}
          >
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <div
                ref={bannerRef}
                className="banner-canvas"
                style={{
                  width: size.w,
                  height: size.h,
                  padding: pad,
                  color: '#fff',
                  ...bgStyle,
                  flexDirection: compact ? 'row' : 'column',
                  alignItems: compact ? 'center' : 'stretch',
                  justifyContent: compact ? 'space-between' : 'flex-start',
                  gap: compact ? pad : 0,
                }}
              >
                {compact ? (
                  <>
                    <LogoMark />
                    <div
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 900,
                        fontSize: headSize,
                        textTransform: 'uppercase',
                        lineHeight: 1,
                      }}
                    >
                      {headline}
                    </div>
                    <div
                      style={{
                        ...ctaStyle,
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: headSize * 0.6,
                        textTransform: 'uppercase',
                        padding: `${headSize * 0.3}px ${headSize * 0.6}px`,
                        borderRadius: 999,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cta}
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <LogoMark />
                      {badge && (
                        <span
                          style={{
                            background: '#E4002B',
                            color: '#fff',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: headSize * 0.32,
                            textTransform: 'uppercase',
                            padding: `${headSize * 0.16}px ${headSize * 0.4}px`,
                            borderRadius: 999,
                            letterSpacing: '0.04em',
                          }}
                        >
                          {badge}
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1 }} />
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 900,
                        fontSize: headSize,
                        textTransform: 'uppercase',
                        lineHeight: 0.98,
                        letterSpacing: '-0.01em',
                        textShadow: '0 2px 20px rgba(0,0,0,.25)',
                      }}
                    >
                      {headline}
                    </div>
                    {sub && (
                      <div
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontWeight: 500,
                          fontSize: headSize * 0.36,
                          marginTop: headSize * 0.28,
                          lineHeight: 1.35,
                          opacity: 0.95,
                          maxWidth: '90%',
                        }}
                      >
                        {sub}
                      </div>
                    )}
                    <div
                      style={{
                        ...ctaStyle,
                        display: 'inline-block',
                        marginTop: headSize * 0.5,
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: headSize * 0.42,
                        textTransform: 'uppercase',
                        padding: `${headSize * 0.3}px ${headSize * 0.7}px`,
                        borderRadius: 999,
                        alignSelf: 'flex-start',
                      }}
                    >
                      {cta}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="row mt16" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-red" onClick={aiCopy} disabled={aiLoading}>
            {aiLoading ? <span className="sp" /> : '✦'} {b.aiCopy}
          </button>
          <button className="btn btn-glass" onClick={download} disabled={exporting}>
            {exporting ? <span className="sp" /> : '⬇'} {b.downloadPng}
          </button>
        </div>
      </div>

      {/* ===== CONTROLS ===== */}
      <div>
        <div className="card">
          <div className="ctrl-group fi">
            <label>{b.headline}</label>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
          <div className="ctrl-group fi">
            <label>{b.subheadline}</label>
            <textarea rows={2} value={sub} onChange={(e) => setSub(e.target.value)} />
          </div>
          <div className="fg" style={{ marginBottom: 0 }}>
            <div className="fi">
              <label>{b.cta}</label>
              <input value={cta} onChange={(e) => setCta(e.target.value)} />
            </div>
            <div className="fi">
              <label>{b.badge}</label>
              <input value={badge} onChange={(e) => setBadge(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="ctrl-group">
            <div className="slbl">{b.style}</div>
            <div className="fi">
              <select value={style} onChange={(e) => setStyle(e.target.value as Style)}>
                <option value="bold">{b.styleBold}</option>
                <option value="minimal">{b.styleMinimal}</option>
                <option value="gradient">{b.styleGradient}</option>
                <option value="photo">{b.stylePhoto}</option>
              </select>
            </div>
          </div>
          <div className="ctrl-group">
            <div className="slbl">{b.color}</div>
            <div className="swatch-row">
              {BRAND_GRADIENTS.map((g) => (
                <button
                  key={g.value}
                  className={`swatch${gradient === g.value && !bg ? ' act' : ''}`}
                  style={{ background: g.value }}
                  title={g.name}
                  onClick={() => {
                    setGradient(g.value);
                    setBg(null);
                    if (style === 'photo') setStyle('gradient');
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="ctrl-group">
            <div className="slbl">{b.logo}</div>
            <label className="dropzone" style={{ display: 'block' }}>
              <span className="dz-ico">⬆</span>
              {logo ? '✓ Logo' : b.dropLogo}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onLogo(e.target.files)}
              />
            </label>
          </div>
          <div className="ctrl-group">
            <div className="slbl">{b.background}</div>
            <label className="dropzone" style={{ display: 'block' }}>
              <span className="dz-ico">🖼</span>
              {bg ? '✓ Background' : b.dropBg}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onBg(e.target.files)}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
