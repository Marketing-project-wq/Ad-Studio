'use client';

import { useApp } from '@/app/providers';

export default function CopyButton({
  text,
  label,
  className = 'cbtn',
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const { t, toast } = useApp();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast(t.common.copied);
    } catch {
      toast(t.common.copyFailed);
    }
  };
  return (
    <button className={className} onClick={copy} type="button">
      {label ?? t.common.copy}
    </button>
  );
}
