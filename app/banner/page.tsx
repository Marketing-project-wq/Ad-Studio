'use client';

import PageHeader from '@/components/layout/PageHeader';
import BannerMaker from '@/components/banner/BannerMaker';
import { useApp } from '@/app/providers';

export default function BannerPage() {
  const { t } = useApp();
  return (
    <>
      <PageHeader title={t.banner.title} sub={t.banner.sub} />
      <BannerMaker />
    </>
  );
}
