// Request guards shared by the API endpoints that accept input (/api/chat, /api/match).
import { timingSafeEqual } from 'node:crypto';

export class RequestError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

/**
 * Only this site's own pages may call the API from a browser. Browsers always send Origin on POST and
 * Sec-Fetch-Site in modern versions; another website's page can't fake either. Without this, a page
 * elsewhere could make its visitors' browsers spend this site's AI quota with a simple form-style POST.
 * Requests with neither header (curl, servers) are left to the rate limits.
 */
export function assertSameOrigin(request: Request): void {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') throw new RequestError(403, 'cross_origin');
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new RequestError(403, 'cross_origin');
}

/**
 * Read a JSON body of at most `maxBytes`, without buffering anything larger. Requiring
 * application/json also means cross-site browser requests need a CORS preflight, which this API never grants.
 */
export async function readJson<T>(request: Request, maxBytes: number): Promise<T> {
  if (!/^application\/json\b/i.test(request.headers.get('content-type') ?? '')) throw new RequestError(415, 'json_required');
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new RequestError(413, 'too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, 'bad_request');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new RequestError(413, 'too_large'); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T; } catch { throw new RequestError(400, 'bad_request'); }
}

/**
 * The visitor's IP for rate limiting. Vercel sets x-real-ip itself; X-Forwarded-For's first entry can be
 * written by the client, so it's only a last resort (for local development).
 */
export function clientIp(request: Request, clientAddress?: string): string {
  return request.headers.get('x-real-ip')?.trim() || clientAddress || request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
}

/** Constant-time comparison for shared secrets such as AI_EVAL_TOKEN. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
