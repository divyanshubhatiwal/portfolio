// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// After deploying, set SITE_URL in Vercel (e.g. https://divyanshu-portfolio.vercel.app)
// so the sitemap, RSS feed and link-preview images use absolute URLs.
const site = process.env.SITE_URL || 'https://divyanshu-portfolio.vercel.app';

export default defineConfig({
  site,
  // pages are pre-rendered to static HTML; only files under src/pages/api run as serverless functions
  output: 'static',
  adapter: vercel({ webAnalytics: { enabled: true } }),
  integrations: [sitemap({ filter: (page) => !page.includes('/offline') })],
  build: { inlineStylesheets: 'auto' },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
