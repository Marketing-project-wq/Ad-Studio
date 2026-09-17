'use client';

import PageHeader from '@/components/layout/PageHeader';
import Generator, { type GenField } from '@/components/ads/Generator';
import { SemResult } from '@/components/ads/results';
import { useApp } from '@/app/providers';
import type { GenerationOutput, SemOutput } from '@/lib/types';

export default function SemPage() {
  const { t } = useApp();
  const s = t.sem;

  const fields: GenField[] = [
    {
      id: 'product',
      label: s.product,
      placeholder: 'EMS Training, Personal Training',
    },
    {
      id: 'location',
      label: s.location,
      placeholder: 'Jakarta Selatan, Surabaya',
    },
    {
      id: 'keywords',
      label: s.keywords,
      placeholder: 'gym terdekat, fitness cepat',
    },
    {
      id: 'competitor',
      label: s.competitor,
      placeholder: "Gold's Gym, Fitness First",
    },
    { id: 'url', label: s.url, placeholder: 'https://20fit.id' },
    {
      id: 'goal',
      label: s.goal,
      type: 'select',
      options: [
        { value: 'leads', label: 'Lead Generation' },
        { value: 'traffic', label: 'Website Traffic' },
        { value: 'calls', label: 'Phone Calls' },
        { value: 'visits', label: 'Store Visits' },
      ],
    },
    {
      id: 'notes',
      label: s.notes,
      type: 'textarea',
      full: true,
      placeholder: 'Hanya 20 menit, personal trainer, teknologi Jerman',
    },
  ];

  return (
    <>
      <PageHeader title={s.title} sub={s.sub} />
      <Generator
        platform="google_sem"
        fields={fields}
        buttonLabel={s.button}
        tips={s.tips}
        tipsTitle="Tips Search Ads"
        renderResult={(data: GenerationOutput) => (
          <SemResult data={data as SemOutput} />
        )}
      />
    </>
  );
}
