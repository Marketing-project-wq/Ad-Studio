'use client';

import { useApp } from '@/app/providers';
import { trackCopy } from '@/lib/db/generations';

export default function CopyButton({
  text,
  label,
  className = 'cbtn',
  trackId,
  field,
}: {
  text: string;
  label?: string;
  className?: string;
  trackId?: string | null;
  field?: string;
}) {
  const { t, toast } = useApp();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast(t.common.copied);
      if (trackId) trackCopy(trackId, field || 'copy');
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
