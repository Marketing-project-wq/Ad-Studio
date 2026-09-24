// Client-side report fetchers. They call the server API routes (which use the
// service-role client); the browser never touches Supabase directly.
import type {
  ContentInsights,
  DashboardStats,
  ProductivityRow,
  QualityRow,
} from './types';

export type {
  ContentInsights,
  DashboardStats,
  ProductivityRow,
  QualityRow,
} from './types';

/** Raised when Supabase isn't configured yet (503) so the UI can show a hint. */
export class NotConfiguredError extends Error {
  constructor() {
    super('supabase_not_configured');
    this.name = 'NotConfiguredError';
  }
}

async function getReport<T>(
  report: string,
  start?: string,
  end?: string,
): Promise<T> {
  const qs = new URLSearchParams({ report });
  if (start) qs.set('start', start);
  if (end) qs.set('end', end);
  const res = await fetch(`/api/reports?${qs.toString()}`);
  if (res.status === 503) throw new NotConfiguredError();
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Report failed (${res.status})`);
  return json.data as T;
}

export const fetchProductivity = (start: string, end: string) =>
  getReport<ProductivityRow[]>('productivity', start, end);

export const fetchQuality = (start: string, end: string) =>
  getReport<QualityRow[]>('quality', start, end);

export const fetchContentInsights = (start: string, end: string) =>
  getReport<ContentInsights>('content', start, end);

export const fetchDashboardStats = () =>
  getReport<DashboardStats>('dashboard');
