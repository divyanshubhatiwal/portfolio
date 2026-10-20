// Serves the built site (.vercel/output/static) with the same security headers Vercel will send,
// so tests can check the real build: CSP violations, and screenshots without the dev toolbar.
// Usage: node scripts/serve-static.mjs [port]   (default 4323). API routes aren't served here.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '.vercel/output');
const dir = path.join(root, 'static');
const port = Number(process.argv[2] || 4323);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain', '.pdf': 'application/pdf',
};
const headersFile = path.join(root, 'security-headers.json');

http.createServer((req, res) => {
  // read on each request, so a rebuild is picked up without restarting
  // 200 so Playwright sees the server as up; tests read the header and skip
  if (!fs.existsSync(dir)) { res.writeHead(200, { 'Content-Type': 'text/plain', 'X-Not-Built': '1' }).end('not built: run npm run build'); return; }
  const headers = fs.existsSync(headersFile) ? JSON.parse(fs.readFileSync(headersFile, 'utf8')) : {};
  const url = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let file = path.join(dir, url);
  if (!file.startsWith(dir)) { res.writeHead(400).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  else if (!path.extname(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
  const found = fs.existsSync(file);
  if (!found) file = path.join(dir, '404.html');
  res.writeHead(found ? 200 : 404, { ...headers, 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).on('error', () => res.end()).pipe(res);
}).listen(port, () => console.log(`built site on http://localhost:${port}`));
