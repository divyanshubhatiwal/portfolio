// The citable sources the chat can reference (ids, titles, links; no text). Built at deploy time.
// Used by the tests (every citation link must resolve) and the AI evaluation suite.
import type { APIRoute } from 'astro';
import { getSources } from '@/lib/ai';

export const prerender = true;

export const GET: APIRoute = async () => {
  const sources = (await getSources()).map(({ id, title, url }) => ({ id, title, url }));
  return new Response(JSON.stringify(sources, null, 2), { headers: { 'Content-Type': 'application/json' } });
};
