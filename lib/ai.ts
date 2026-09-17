import Anthropic from '@anthropic-ai/sdk';
import type { Brief, GenerationOutput, Lang, Platform } from './types';
import { buildPrompt } from './prompts';

/**
 * Default model. Overridable via ANTHROPIC_MODEL so the account's available
 * model can be selected without a code change (e.g. claude-sonnet-5 for the
 * latest, or the value from the PRD). Kept to a broadly-available default so
 * the tool works on first deploy.
 */
export const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
export const AI_MAX_TOKENS = 2500;

export function isAIConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/** Pull a JSON object out of a model response, tolerating code fences / prose. */
export function extractJson<T>(raw: string): T {
  let text = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  // If there is leading/trailing prose, grab the first {...} block.
  if (!text.startsWith('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      text = text.slice(start, end + 1);
    }
  }
  return JSON.parse(text) as T;
}

export async function generateCopy(
  platform: Platform,
  brief: Brief,
  lang: Lang,
): Promise<GenerationOutput> {
  const prompt = buildPrompt(platform, brief, lang);
  const msg = await getClient().messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = msg.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('');
  return extractJson<GenerationOutput>(text);
}
