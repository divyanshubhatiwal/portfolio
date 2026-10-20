// Link-preview images (1200×630) generated at build time for every blog post and case study.
// satori lays out the card and turns text into vector paths; resvg rasterises it to PNG.
import fs from 'node:fs';
import path from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { getCases, getPosts } from '@/lib/content';
import { PROFILE } from '@/data/site';

export const prerender = true;

const root = process.cwd();
const font = (f: string) => fs.readFileSync(path.join(root, 'src/assets/fonts', f));
const FONTS = [
  { name: 'Space Grotesk', data: font('SpaceGrotesk-Bold.ttf'), weight: 700 as const, style: 'normal' as const },
  { name: 'Inter', data: font('Inter-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
  { name: 'Inter', data: font('Inter-SemiBold.ttf'), weight: 600 as const, style: 'normal' as const },
  { name: 'Space Mono', data: font('SpaceMono-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
];
const PHOTO = `data:image/jpeg;base64,${fs.readFileSync(path.join(root, 'public/profile.jpg')).toString('base64')}`;

interface CardData { label: string; title: string; summary: string }

export const getStaticPaths = (async () => {
  const [posts, cases] = await Promise.all([getPosts(), getCases()]);
  return [
    ...posts.map((p) => ({ params: { slug: `blog/${p.id}` }, props: { label: `Blog · ${p.data.tag}`, title: p.data.title, summary: p.data.summary } })),
    ...cases.map((c) => ({ params: { slug: `case/${c.id}` }, props: { label: `Case study · ${c.data.cat}`, title: c.data.title, summary: c.data.lede } })),
  ];
}) satisfies GetStaticPaths;

/** Cut text at a word boundary so it fits the card. */
const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, s.lastIndexOf(' ', max - 1))}…`);

// Minimal element factory: satori accepts plain { type, props } objects, so no JSX setup is needed.
type Child = SatoriNode | string;
interface SatoriNode { type: string; props: Record<string, unknown> & { children?: Child | Child[] } }
const h = (type: string, style: Record<string, unknown>, children?: Child | Child[], extra: Record<string, unknown> = {}): SatoriNode =>
  ({ type, props: { style, children, ...extra } });

// Explicit pixel sizes and positions throughout. satori sizes an unconstrained box to its content
// (so text never wraps) and adds padding outside a fixed height (which pushed the footer off the card),
// so the content sits in an absolutely positioned inner box instead of relying on padding.
const W = 1200, H = 630, PAD_X = 72, PAD_Y = 60, INNER = W - PAD_X * 2, INNER_H = H - PAD_Y * 2;

function card({ label, title, summary }: CardData): SatoriNode {
  return h('div', {
    width: W, height: H, display: 'flex', position: 'relative', backgroundColor: '#111418', color: '#e6e8ea', fontFamily: 'Inter',
    backgroundImage: 'radial-gradient(circle at 0% 0%, rgba(20,184,166,0.22) 0%, rgba(17,20,24,0) 50%), radial-gradient(circle at 100% 100%, rgba(13,148,136,0.16) 0%, rgba(17,20,24,0) 50%)',
  }, h('div', {
    position: 'absolute', left: PAD_X, top: PAD_Y, width: INNER, height: INNER_H,
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
  }, [
    h('div', { display: 'flex', flexDirection: 'column', width: INNER }, [
      h('div', { display: 'flex', width: INNER, fontFamily: 'Space Mono', fontSize: 22, color: '#2dd4bf', letterSpacing: 2, textTransform: 'uppercase' }, clip(label, 60)),
      h('div', { display: 'flex', width: INNER, fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: title.length > 40 ? 58 : 68, lineHeight: 1.08, marginTop: 24, letterSpacing: -1.5 }, clip(title, 80)),
      h('div', { display: 'flex', width: INNER, fontSize: 28, lineHeight: 1.45, color: '#b4bcc4', marginTop: 24 }, clip(summary, 150)),
    ]),
    h('div', { display: 'flex', width: INNER, alignItems: 'center', justifyContent: 'space-between' }, [
      h('div', { display: 'flex', alignItems: 'center' }, [
        h('img', { width: 72, height: 72, borderRadius: 36, objectFit: 'cover', border: '3px solid #14b8a6' }, undefined, { src: PHOTO, width: 72, height: 72 }),
        h('div', { display: 'flex', flexDirection: 'column', marginLeft: 20 }, [
          h('div', { display: 'flex', fontWeight: 600, fontSize: 26 }, PROFILE.name),
          h('div', { display: 'flex', fontSize: 20, color: '#9aa3ad', marginTop: 4 }, PROFILE.title),
        ]),
      ]),
      h('div', { display: 'flex', width: 180, height: 8, borderRadius: 4, backgroundColor: '#14b8a6' }),
    ]),
  ]));
}

export const GET: APIRoute = async ({ props }) => {
  const svg = await satori(card(props as CardData) as Parameters<typeof satori>[0], { width: W, height: H, fonts: FONTS });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' } });
};
