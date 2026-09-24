'use client';

import PageHeader from '@/components/layout/PageHeader';
import Generator, { type GenField } from '@/components/ads/Generator';
import { MetaResult } from '@/components/ads/results';
import { useApp } from '@/app/providers';
import type { GenerationOutput, MetaOutput } from '@/lib/types';

export default function MetaPage() {
  const { t } = useApp();
  const m = t.meta;

  const fields: GenField[] = [
    { id: 'product', label: m.product, placeholder: 'EMS Training 20 menit' },
    {
      id: 'audience',
      label: m.audience,
      placeholder: 'Wanita 25-35 tahun, fitness enthusiast',
    },
    {
      id: 'objective',
      label: m.objective,
      type: 'select',
      defaultValue: 'leads',
      options: [
        { value: 'awareness', label: 'Brand Awareness' },
        { value: 'traffic', label: 'Traffic' },
        { value: 'leads', label: 'Lead Generation' },
        { value: 'conversions', label: 'Conversions' },
        { value: 'engagement', label: 'Engagement' },
      ],
    },
    {
      id: 'cta',
      label: m.cta,
      type: 'select',
      options: [
        { value: 'Daftar Sekarang', label: 'Daftar Sekarang' },
        { value: 'Pelajari Selengkapnya', label: 'Pelajari Selengkapnya' },
        { value: 'Hubungi Kami', label: 'Hubungi Kami' },
        { value: 'Pesan Sekarang', label: 'Pesan Sekarang' },
        { value: 'Dapatkan Promo', label: 'Dapatkan Promo' },
      ],
    },
    { id: 'usp', label: m.usp, placeholder: 'Teknologi EMS dari Jerman' },
    { id: 'promo', label: m.promo, placeholder: 'Trial gratis sesi pertama' },
    {
      id: 'placement',
      label: m.placement,
      type: 'select',
      options: [
        { value: 'feed', label: 'Feed (Facebook & Instagram)' },
        { value: 'stories', label: 'Stories & Reels' },
        { value: 'all', label: 'All Placements' },
      ],
    },
    { id: 'url', label: m.url, placeholder: 'https://20fit.id/promo' },
    {
      id: 'notes',
      label: m.notes,
      type: 'textarea',
      full: true,
      placeholder: 'Fun, relatable, gunakan emoji',
    },
  ];

  return (
    <>
      <PageHeader title={m.title} sub={m.sub} />
      <Generator
        platform="meta"
        fields={fields}
        buttonLabel={m.button}
        tips={m.tips}
        tipsTitle="Tips Meta Ads"
        renderResult={(data, brief, generationId) => (
          <MetaResult data={data as MetaOutput} cta={brief.cta} trackId={generationId} />
        )}
      />
    </>
  );
}
