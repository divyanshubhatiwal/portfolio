// Adds security headers to the Vercel build output. Runs after `astro build` (see package.json).
// The Vercel adapter writes its own .vercel/output/config.json and ignores `headers` in vercel.json,
// so the headers go straight into that file as a route that runs before every other one.
//
// The Content-Security-Policy allows scripts only from this site plus the exact inline scripts the
// build produced (by SHA-256 hash), so an injected <script> can't run. Re-run on every build: a
// changed inline script gets a new hash automatically.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, '.vercel/output');
const configPath = path.join(out, 'config.json');
if (!fs.existsSync(configPath)) {
  console.error('security-headers: .vercel/output/config.json not found; run astro build first.');
  process.exit(1);
}

// every executable inline <script> in the built pages (JSON data blocks don't run, so they need no hash)
const hashes = new Set();
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.html') ? [path.join(dir, e.name)] : []);
const pages = walk(path.join(out, 'static'));
for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  // inline handlers (onclick="…") can't be allowed by hash, so the CSP would silently block them
  const handler = /<[a-z][^>]*\son[a-z]+\s*=/i.exec(html);
  if (handler) {
    console.error(`security-headers: inline event handler in ${path.relative(out, file)}: ${handler[0].slice(0, 120)}\nUse addEventListener in a script instead.`);
    process.exit(1);
  }
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const [, attrs, body] = m;
    if (/\bsrc\s*=/i.test(attrs) || !body.trim()) continue;
    const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1]?.toLowerCase();
    if (type && !['module', 'text/javascript', 'application/javascript'].includes(type)) continue;
    hashes.add(`'sha256-${crypto.createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
}

const csp = [
  "default-src 'self'",
  `script-src 'self' ${[...hashes].sort().join(' ')}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // style="--var:…" attributes are used throughout
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://ghchart.rshah.org",
  "connect-src 'self' https://api.github.com https://api.web3forms.com",
  "media-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const headers = {
  'Content-Security-Policy': csp,
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // the microphone is only for the chat's voice input, on this site only
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
// drop a copy from an earlier run (the Build Output API rejects unknown keys, so match on the CSP header)
config.routes = (config.routes ?? []).filter((r) => !r.headers?.['Content-Security-Policy']);
config.routes.unshift({ src: '/(.*)', headers, continue: true });
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

// a copy outside the served files, used by the local preview server in the Playwright tests
fs.writeFileSync(path.join(out, 'security-headers.json'), JSON.stringify(headers, null, 2));
console.log(`security-headers: ${pages.length} pages, ${hashes.size} inline script hash(es), ${Object.keys(headers).length} headers written`);
