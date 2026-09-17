'use client';

import PageHeader from '@/components/layout/PageHeader';
import AssetLibrary from '@/components/assets/AssetLibrary';
import { useApp } from '@/app/providers';

export default function AssetsPage() {
  const { t } = useApp();
  return (
    <>
      <PageHeader title={t.assets.title} sub={t.assets.sub} />
      <AssetLibrary />
    </>
  );
}
