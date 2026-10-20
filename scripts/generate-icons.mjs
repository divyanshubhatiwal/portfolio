// Generates the PWA / home-screen icons from public/favicon.svg.
// Run after changing the favicon:  node scripts/generate-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = path.resolve(import.meta.dirname, '..');
const svg = fs.readFileSync(path.join(root, 'public/favicon.svg'), 'utf8');
const outDir = path.join(root, 'public/icons');
fs.mkdirSync(outDir, { recursive: true });

const render = (source, size) => new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();

// "any" icons: the favicon as-is
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), render(svg, size));
}

// maskable icon: Android crops icons to circles/squircles, so keep the artwork inside the
// central 80% "safe zone" on a full-bleed background.
const inner = svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#111418"/>
  <g transform="translate(6.4 6.4) scale(0.8)">${inner}</g>
</svg>`;
fs.writeFileSync(path.join(outDir, 'maskable-512.png'), render(maskable, 512));

for (const f of fs.readdirSync(outDir)) {
  console.log(`${f}  ${fs.statSync(path.join(outDir, f)).size} bytes`);
}
