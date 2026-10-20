// Content collections: blog posts and case studies are plain Markdown files in src/content/.
// The schemas are checked at build time, so a missing or misspelled field fails the build.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    /** which project the post is about, shown as a tag */
    tag: z.string(),
    /** drafts build in `astro dev` but are left out of the live site and RSS */
    draft: z.boolean().default(false),
  }),
});

const cases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/cases' }),
  schema: z.object({
    title: z.string(),
    cat: z.string(),
    lede: z.string(),
    tags: z.array(z.string()),
    /** display order on /case */
    order: z.number(),
    links: z.array(z.object({ href: z.url(), label: z.string() })).default([]),
    // an interactive demo on this site, linked from the case study header
    demo: z.object({ href: z.string().startsWith('/'), label: z.string() }).optional(),
    /** screenshot path under /public */
    img: z.string().optional(),
  }),
});

export const collections = { blog, cases };
