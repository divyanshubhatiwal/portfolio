// Home-page text in English and Hindi. The Hindi version lives at /hi/; case studies, blog posts,
// demos and the chat assistant are English only. Hindi translation: needs review by a native speaker.
import { CERTS, EXPERIENCE, MILESTONES, PROJECTS, ROLES, SKILLS, ACH_STATS } from '@/data/site';
import { HI, type Dict } from './hi';

export type Lang = 'en' | 'hi';
export const LANGS: Lang[] = ['en', 'hi'];

export const getLang = (url: URL): Lang => (/^\/hi(\/|$)/.test(url.pathname) ? 'hi' : 'en');
/** the home page for a language */
export const homeHref = (lang: Lang) => (lang === 'hi' ? '/hi/' : '/');

export const EN: Dict = {
  meta: {
    description: 'B.Tech CSE (AI & ML) student and engineer building LLM agents, backend services, full-stack products and mobile apps.',
    skip: 'Skip to content', switchLabel: 'हिन्दी', switchTitle: 'यह पेज हिन्दी में पढ़ें',
  },
  nav: { about: 'About', skills: 'Skills', experience: 'Experience', projects: 'Projects', cases: 'Case studies', blog: 'Blog', contact: 'Contact', resume: 'Resume', downloadResume: 'Download Resume' },
  hero: {
    role: 'AI & Full-Stack Engineer',
    lede: 'I build software that shows its work: AI agents that learn from their own failed experiments, forensic pipelines that cite every claim, and apps people actually use.',
    facts: ['B.Tech CSE (AI & ML), SRM IST', 'CGPA 8.83', `${PROJECTS.length} projects shipped`, 'India · open to remote'],
    viewWork: 'View my work', resume: 'Download résumé', contact: 'Contact me',
    workTitle: 'Selected work',
    work: [
      ['AutoSci', 'Tests whether an LLM agent can out-search Optuna on the same budget. 45-trial baseline study, replayable.', '/demo/autosci'],
      ['Forensic Agent', 'Rebuilds incident timelines from raw logs. Found 22 of 22 planted anomalies, with every claim cited.', '/case/forensic-agent'],
      ['Venture DAO', 'Trading engine with a risk gate no order can skip, and a landing page that publishes its own losses.', '/case/venture-dao'],
    ],
    allWork: 'All projects',
  },
  tour: {
    start: 'Take the 1-minute tour', next: 'Next', back: 'Back', done: 'Finish', skip: 'Skip tour', of: 'of',
    stops: [
      ['.hero-main', 'Who I am', 'AI and full-stack engineer, B.Tech CSE (AI & ML) at SRM. Everything on this site can be checked: demos, code and numbers.'],
      ['.hero-work', 'Start with these three', 'My strongest work: an AI research system, a forensic pipeline and a trading engine. Each has a case study and something you can try.'],
      ['#project-grid', 'Every project, with proof', 'Case studies, live demos, code tours and whether the live site is up right now. Hover a card with a demo to watch it run.'],
      ['#skills', 'Skills you can verify', 'Each skill links to the exact file or line on GitHub that uses it, on the evidence page.'],
      ['#experience', 'What I have shipped', 'Self-directed projects across AI, backend, web and mobile, plus my degree.'],
      ['#contact', 'Get in touch', 'Email, LinkedIn or the form, which goes straight to my inbox.'],
    ],
    endTitle: 'Where to next?',
    endLinks: [['Try the risk-gate demo', '/demo/risk-gate'], ['See the skill evidence', '/evidence'], ['Get a résumé for your role', '/resume']],
  },
  about: {
    eyebrow: '01 / About me', title: 'Measure first, claim second.',
    p1: 'I work where <strong>applied AI meets product engineering</strong>. I\'ve built LLM agents that design and run their own experiments, a forensic pipeline that rebuilds incident timelines from raw logs, a quant trading platform, and consumer apps on web and mobile.',
    p2: 'Every project starts the same way: <strong>state the claim, build the baseline, then measure</strong>. If a system can\'t show where its answer came from, it isn\'t finished.',
    focusLabel: 'Currently', focus: 'LLM agents, evidence-grounded RAG, and production-grade full-stack apps.',
    statProjects: 'Projects shipped', statPlatforms: 'Platforms', statTech: 'Core technologies',
    portrait: 'Portrait of', openToWork: 'Open to work',
    cards: [
      ['AI Agents & LLMs', 'Multi-agent systems, RAG and agent loops evaluated against real baselines like Optuna TPE.'],
      ['Full-Stack Builder', 'React, Node.js, Express and MongoDB, from WebRTC voice chat to live trading terminals.'],
      ['Production Mindset', 'Deterministic risk gates, offline-first design, strict TypeScript and tests that ship with the code.'],
    ],
  },
  skills: { eyebrow: '02 / Toolbox', title: 'Skills & Technologies', sub: 'The stack I reach for when an idea needs to become a working system.', evidence: 'See the code behind each skill', projects: 'projects', project: 'project', inCode: 'in public code', described: 'described' },
  experience: { eyebrow: '03 / Journey', title: 'Experience', sub: 'Where I\'ve been building and what I\'ve shipped.' },
  projects: {
    eyebrow: '04 / Work', title: 'Featured Projects', sub: 'Systems built to be measured, not just demoed.', filterLabel: 'Filter projects by category',
    all: 'All', caseStudy: 'Case study', tryIt: 'Try it here', source: 'Source', live: 'Live Demo ↗', tour: 'Code tour', shot: 'Screenshot of',
    focusShown: 'Showing my <b></b> work first.', focusReset: 'Show the usual order', focusCv: 'Get a résumé for this role', up: 'Live', down: 'Not responding',
  },
  github: {
    eyebrow: '05 / Open source', title: 'GitHub & Coding Activity',
    sub: 'Live from my GitHub and LeetCode profiles: contributions, languages, problems solved and what I\'ve pushed recently.',
    repos: 'Public repos', followers: 'Followers', since: 'On GitHub since', langs: 'Top languages', solved: 'solved',
    easy: 'Easy', medium: 'Medium', hard: 'Hard', rating: 'Contest rating', contests: 'Contests', ranking: 'Global ranking',
    graph: 'Contributions in the last year', graphAlt: 'GitHub contribution graph for',
  },
  certs: { eyebrow: '06 / Credentials', title: 'Certifications', sub: 'Courses and credentials that back up the work.', view: 'View Credential ↗' },
  ach: { eyebrow: '07 / Milestones', title: 'Achievements', sub: 'Numbers I\'m proud of, and the milestones behind them.' },
  contact: {
    eyebrow: '08 / Contact', title: 'Let\'s work together.', sub: 'Open to internships, full-time roles and interesting freelance builds.',
    email: 'Email', location: 'Location', quick: 'Open quick connect', formTitle: 'Send a Message', formSub: 'Fill out the form and it\'ll land in my inbox.',
    name: 'Name', namePh: 'Your name', subject: 'Subject', pick: 'Select a subject', subjects: ['Project Inquiry', 'Job Opportunity', 'General Question'],
    message: 'Message', messagePh: 'Tell me about it...', send: 'Send Message',
  },
  footer: { built: 'Built with Astro', updated: 'Last updated:' },
};

const DICTS: Record<Lang, Dict> = { en: EN, hi: HI };
export const ui = (lang: Lang): Dict => DICTS[lang];

/** Site data with the descriptive text in the given language. Names, tags, dates and links stay as they are. */
export function content(lang: Lang) {
  if (lang === 'en') {
    return { projects: PROJECTS, experience: EXPERIENCE, certs: CERTS, stats: ACH_STATS, milestones: MILESTONES, roles: ROLES,
      skillGroup: (g: string) => g, category: (c: string) => c };
  }
  const d = HI.data;
  return {
    projects: PROJECTS.map((p) => ({ ...p, desc: d.projects[p.name] ?? p.desc })),
    experience: EXPERIENCE.map((x, i) => ({ ...x, ...d.experience[i] })),
    certs: CERTS.map((c) => ({ ...c, desc: d.certs[c.title] ?? c.desc })),
    stats: ACH_STATS.map((s, i) => ({ ...s, label: d.stats[i] ?? s.label })),
    milestones: MILESTONES.map((m, i) => ({ ...m, ...d.milestones[i] })),
    roles: d.roles,
    skillGroup: (g: string) => d.skillGroups[g] ?? g,
    category: (c: string) => d.categories[c] ?? c,
  };
}

// every skill group, category, project and list entry has a translation (checked at build time)
if (Object.keys(SKILLS).some((g) => !HI.data.skillGroups[g]) || PROJECTS.some((p) => !HI.data.projects[p.name])
  || HI.data.experience.length !== EXPERIENCE.length || HI.data.milestones.length !== MILESTONES.length || HI.data.stats.length !== ACH_STATS.length) {
  throw new Error('src/i18n/hi.ts is missing a translation for some site data');
}
