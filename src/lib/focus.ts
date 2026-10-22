// Roles a visitor can ask the site to focus on (?for=backend etc.). Used by the recruiter view on the
// home page and by the tailored résumé at /resume. Ordering only: nothing is ever hidden or invented.

export interface Focus { label: string; cats: string[]; tags: RegExp; skills: string[] }

export const FOCUS: Record<string, Focus> = {
  ai: { label: 'AI / ML', cats: ['AI / ML'], tags: /llm|rag|optuna|scikit|anomaly|graph|claude|vector|experiment/i, skills: ['AI / ML', 'Languages'] },
  backend: { label: 'backend', cats: ['Backend'], tags: /fastapi|node|express|postgres|redis|mongo|celery|elasticsearch|docker|webrtc|jest|vitest|pytest/i, skills: ['Backend & Data', 'Languages'] },
  frontend: { label: 'frontend', cats: [], tags: /react|tailwind|typescript|vite|reanimated|expo/i, skills: ['Frontend & Mobile', 'Languages'] },
  fullstack: { label: 'full-stack', cats: ['Full-Stack'], tags: /react|node|supabase|mongo|postgres/i, skills: ['Frontend & Mobile', 'Backend & Data'] },
  mobile: { label: 'mobile', cats: ['Mobile'], tags: /react native|expo|reanimated|flutter/i, skills: ['Frontend & Mobile', 'Languages'] },
};

/** The focus named in the page's ?for= parameter, if it's one we know. */
export function readFocus(search: string = location.search): { key: string; focus: Focus } | null {
  const key = new URLSearchParams(search).get('for')?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  const focus = FOCUS[key];
  return focus ? { key, focus } : null;
}

/** Relevance of a project to a focus: a category match counts double, each matching tag once. */
export const projectScore = (focus: Focus, cat: string, tags: string[]): number =>
  (focus.cats.includes(cat) ? 2 : 0) + tags.filter((t) => focus.tags.test(t)).length;

/** Order of skill groups for a focus (unlisted groups keep their place after the listed ones). */
export const groupRank = (focus: Focus, group: string): number => {
  const i = focus.skills.indexOf(group);
  return i < 0 ? 99 : i;
};
