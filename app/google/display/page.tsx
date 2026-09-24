'use client';

import PageHeader from '@/components/layout/PageHeader';
import Generator, { type GenField } from '@/components/ads/Generator';
import { DisplayResult } from '@/components/ads/results';
import { useApp } from '@/app/providers';
import type { DisplayOutput, GenerationOutput } from '@/lib/types';

export default function DisplayPage() {
  const { t } = useApp();
  const d = t.display;

  const fields: GenField[] = [
    { id: 'product', label: d.product, placeholder: 'EMS Training 20 menit' },
    {
      id: 'audience',
      label: d.audience,
      placeholder: 'Pekerja kantoran 25-40 tahun',
    },
    { id: 'usp', label: d.usp, placeholder: 'Hasil 2 jam gym hanya 20 menit' },
    { id: 'promo', label: d.promo, placeholder: 'Free trial, diskon 50%' },
    { id: 'url', label: d.url, placeholder: 'https://20fit.id/promo' },
    {
      id: 'format',
      label: d.format,
      type: 'select',
      options: [
        { value: 'responsive', label: 'Responsive Display Ads' },
        { value: 'static', label: 'Static Banner Ads' },
        { value: 'gmail', label: 'Gmail Sponsored Ads' },
      ],
    },
    {
      id: 'notes',
      label: d.notes,
      type: 'textarea',
      full: true,
      placeholder: "Energik, profesional, hindari kata 'murah'",
    },
  ];

  return (
    <>
      <PageHeader title={d.title} sub={d.sub} />
      <Generator
        platform="google_display"
        fields={fields}
        buttonLabel={d.button}
        tips={d.tips}
        tipsTitle="Tips Display Ads"
        renderResult={(data, _brief, generationId) => (
          <DisplayResult data={data as DisplayOutput} trackId={generationId} />
        )}
      />
    </>
  );
}
