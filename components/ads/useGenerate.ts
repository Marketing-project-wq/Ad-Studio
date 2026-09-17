'use client';

import { useState } from 'react';
import { useApp } from '@/app/providers';
import { saveGeneration } from '@/lib/history';
import type { Brief, GenerationOutput, Platform } from '@/lib/types';

interface GenState {
  loading: boolean;
  error: string | null;
  data: GenerationOutput | null;
}

export function useGenerate(platform: Platform) {
  const { lang } = useApp();
  const [state, setState] = useState<GenState>({
    loading: false,
    error: null,
    data: null,
  });

  async function run(brief: Brief) {
    setState({ loading: true, error: null, data: null });
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, language: lang, brief }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      const data = json.data as GenerationOutput;
      setState({ loading: false, error: null, data });
      try {
        saveGeneration({
          platform,
          language: lang,
          input_brief: brief,
          output_data: data,
        });
      } catch {
        /* history is best-effort */
      }
    } catch (err) {
      setState({
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        data: null,
      });
    }
  }

  return { ...state, run };
}
