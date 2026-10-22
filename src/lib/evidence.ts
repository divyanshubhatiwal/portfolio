// Skills <-> projects, with proof. "code" links point at an exact line or file in a public repo at a
// pinned commit (from src/data/github.json, made by scripts/sync-github.mjs). "described" means the
// project uses the skill per its own description or case study, but its code isn't public.
import { PROJECTS, SKILLS } from '@/data/site';
import github from '@/data/github.json';

export interface Proof { project: string; kind: 'dependency' | 'files' | 'code' | 'described'; label: string; url: string }
export interface SkillNode { name: string; group: string; proofs: Proof[] }
export interface ProjectNode { name: string; href: string; repo?: string }

/** project tags that name the same skill differently */
const ALIASES: Record<string, string> = {
  'Node.js': 'Node.js / Express', 'Express 5': 'Node.js / Express', 'Express': 'Node.js / Express',
  'React 18': 'React', 'React 19': 'React', 'Tailwind': 'Tailwind CSS', 'PostgreSQL 16': 'PostgreSQL', 'Redis 7': 'Redis',
  'Expo': 'React Native / Expo', 'React Native': 'React Native / Expo', 'Optuna': 'Optuna / HPO',
  'RAG': 'RAG & Vector Search', 'Vector Search': 'RAG & Vector Search', 'MongoDB Atlas': 'MongoDB', 'Supabase': 'PostgreSQL',
};
const canon = (tag: string) => ALIASES[tag] ?? tag;

const SITE: ProjectNode = { name: 'This portfolio', href: '/stats', repo: 'portfolio' };

export function buildEvidence(): { skills: SkillNode[]; projects: ProjectNode[]; synced: string } {
  const repoOf = new Map(Object.values(github.repos).map((r) => [r.project, r]));
  const projects: ProjectNode[] = [
    ...PROJECTS.map((p) => ({ name: p.name, href: p.slug ? `/case/${p.slug}` : p.demo ?? p.code ?? p.live ?? '/#projects', repo: repoOf.has(p.name) ? p.name : undefined })),
    SITE,
  ];

  const group = new Map<string, string>();
  for (const [g, list] of Object.entries(SKILLS)) for (const [name] of list) group.set(name, g);

  const skills = new Map<string, SkillNode>();
  const node = (name: string) => {
    if (!skills.has(name)) skills.set(name, { name, group: group.get(name) ?? 'Also used', proofs: [] });
    return skills.get(name)!;
  };

  // proof in code first
  for (const [skill, items] of Object.entries(github.evidence as Record<string, { project: string; kind: string; label: string; url: string }[]>)) {
    for (const it of items) node(skill).proofs.push({ project: it.project, kind: it.kind as Proof['kind'], label: it.label, url: it.url });
  }
  // then the projects that use a skill by their own description, where code proof doesn't already cover them
  for (const p of PROJECTS) {
    for (const tag of p.tags) {
      const s = node(canon(tag));
      if (!s.proofs.some((x) => x.project === p.name)) {
        s.proofs.push({ project: p.name, kind: 'described', label: p.slug ? 'described in the case study' : 'listed in the project description', url: p.slug ? `/case/${p.slug}` : '/#projects' });
      }
    }
  }

  const order = [...Object.keys(SKILLS), 'Also used'];
  const list = [...skills.values()]
    .filter((s) => s.proofs.length)
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || b.proofs.filter((x) => x.kind !== 'described').length - a.proofs.filter((x) => x.kind !== 'described').length || a.name.localeCompare(b.name));
  const used = new Set(list.flatMap((s) => s.proofs.map((x) => x.project)));
  return { skills: list, projects: projects.filter((p) => used.has(p.name)), synced: github.synced };
}
