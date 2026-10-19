// Helpers shared by the blog/case pages, the RSS feed and the OG-image endpoint.
import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;
export type Case = CollectionEntry<'cases'>;

/** Published posts, newest first. Drafts show up only in `astro dev`. */
export async function getPosts(): Promise<Post[]> {
  const all = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.data.title.localeCompare(b.data.title));
}

export async function getCases(): Promise<Case[]> {
  return (await getCollection('cases')).sort((a, b) => a.data.order - b.data.order);
}

/** Rough reading time at ~220 words per minute. */
export function readingMinutes(markdown = ''): number {
  const words = markdown.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export const formatDate = (d: Date): string =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
