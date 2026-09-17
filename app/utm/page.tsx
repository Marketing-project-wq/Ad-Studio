'use client';

import PageHeader from '@/components/layout/PageHeader';
import UtmBuilder from '@/components/utm/UtmBuilder';
import { useApp } from '@/app/providers';

export default function UtmPage() {
  const { t } = useApp();
  return (
    <>
      <PageHeader title={t.utm.title} sub={t.utm.sub} />
      <UtmBuilder />
    </>
  );
}
