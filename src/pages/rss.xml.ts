import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getPosts } from '@/lib/content';
import { PROFILE } from '@/data/site';

export const GET: APIRoute = async ({ site }) => {
  const posts = await getPosts();
  return rss({
    title: `${PROFILE.name} | Blog`,
    description: 'Short write-ups on building LLM agents, trading systems and evidence-grounded pipelines.',
    site: site ?? 'https://divyanshu-portfolio.vercel.app',
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.summary,
      pubDate: p.data.date,
      link: `/blog/${p.id}/`,
      categories: [p.data.tag],
    })),
    customData: '<language>en</language>',
  });
};
