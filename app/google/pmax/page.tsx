'use client';

import PageHeader from '@/components/layout/PageHeader';
import Generator, { type GenField } from '@/components/ads/Generator';
import { PmaxResult } from '@/components/ads/results';
import { useApp } from '@/app/providers';
import type { GenerationOutput, PmaxOutput } from '@/lib/types';

export default function PmaxPage() {
  const { t } = useApp();
  const p = t.pmax;

  const fields: GenField[] = [
    { id: 'product', label: p.product, placeholder: 'EMS Training Membership' },
    {
      id: 'audience',
      label: p.audience,
      placeholder: 'Fitness enthusiast, health-conscious',
    },
    { id: 'usp', label: p.usp, placeholder: '20 menit = 2 jam gym biasa' },
    { id: 'promo', label: p.promo, placeholder: 'First session FREE' },
    { id: 'url', label: p.url, placeholder: 'https://20fit.id/promo' },
    {
      id: 'goal',
      label: p.goal,
      type: 'select',
      options: [
        { value: 'leads', label: 'Lead Form Submissions' },
        { value: 'purchase', label: 'Online Purchases' },
        { value: 'calls', label: 'Phone Calls' },
        { value: 'visits', label: 'Store Visits' },
      ],
    },
    {
      id: 'notes',
      label: p.notes,
      type: 'textarea',
      full: true,
      placeholder: 'Brand voice: bold, innovative, premium fitness',
    },
  ];

  return (
    <>
      <PageHeader title={p.title} sub={p.sub} />
      <Generator
        platform="google_pmax"
        fields={fields}
        buttonLabel={p.button}
        tips={p.tips}
        tipsTitle="Tips Performance Max"
        renderResult={(data, _brief, generationId) => (
          <PmaxResult data={data as PmaxOutput} trackId={generationId} />
        )}
      />
    </>
  );
}
