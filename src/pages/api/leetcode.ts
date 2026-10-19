// LeetCode stats proxy. LeetCode's GraphQL API doesn't allow browser requests from other sites (CORS),
// so the page asks this serverless function instead. Vercel's edge caches the answer for an hour.
import type { APIRoute } from 'astro';
import { PROFILE } from '@/data/site';

export const prerender = false;

const QUERY = `query($u: String!) {
  matchedUser(username: $u) {
    profile { ranking }
    submitStatsGlobal { acSubmissionNum { difficulty count } }
  }
  userContestRanking(username: $u) { rating attendedContestsCount }
}`;

interface LcResponse {
  data?: {
    matchedUser: { profile: { ranking: number }; submitStatsGlobal: { acSubmissionNum: { difficulty: string; count: number }[] } } | null;
    userContestRanking: { rating: number; attendedContestsCount: number } | null;
  };
}

const json = (body: unknown, status: number, cache: string) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache } });

export const GET: APIRoute = async () => {
  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com', 'User-Agent': 'Mozilla/5.0 (portfolio stats)' },
      body: JSON.stringify({ query: QUERY, variables: { u: PROFILE.leetcodeUser } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`LeetCode responded ${res.status}`);
    const { data } = (await res.json()) as LcResponse;
    const user = data?.matchedUser;
    if (!user) throw new Error('user not found');
    const by = (d: string) => user.submitStatsGlobal.acSubmissionNum.find((x) => x.difficulty === d)?.count ?? 0;
    return json({
      total: by('All'), easy: by('Easy'), medium: by('Medium'), hard: by('Hard'),
      ranking: user.profile.ranking,
      rating: data?.userContestRanking ? Math.round(data.userContestRanking.rating) : null,
      contests: data?.userContestRanking?.attendedContestsCount ?? 0,
    }, 200, 'public, s-maxage=3600, stale-while-revalidate=86400');
  } catch (e) {
    // short cache on failure so a LeetCode hiccup doesn't stick for an hour
    return json({ error: e instanceof Error ? e.message : 'unavailable' }, 502, 'public, s-maxage=60');
  }
};
