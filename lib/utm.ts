// UTM link building + 20FIT presets.

export interface UtmInput {
  url: string;
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
}

export const UTM_SOURCES = [
  'google',
  'facebook',
  'instagram',
  'youtube',
  'tiktok',
  'email',
  'whatsapp',
];

export const UTM_MEDIUMS = [
  { value: 'cpc', label: 'cpc (Paid Search)' },
  { value: 'display', label: 'display' },
  { value: 'social', label: 'social' },
  { value: 'paid_social', label: 'paid_social' },
  { value: 'email', label: 'email' },
  { value: 'referral', label: 'referral' },
  { value: 'cpm', label: 'cpm' },
];

export function buildUtmUrl(input: UtmInput): string | null {
  const { url, source, medium, campaign, term, content } = input;
  if (!url || !source || !medium || !campaign) return null;
  const params = new URLSearchParams();
  params.set('utm_source', source.trim());
  params.set('utm_medium', medium.trim());
  params.set('utm_campaign', campaign.trim());
  if (term) params.set('utm_term', term.trim());
  if (content) params.set('utm_content', content.trim());
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${params.toString()}`;
}

/** Slugify a free-text campaign name to the 20FIT convention. */
export function slugifyCampaign(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
