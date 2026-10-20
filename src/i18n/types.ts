// Shape of a home-page dictionary (src/i18n/index.ts has English, src/i18n/hi.ts has Hindi).
type S = string;

export interface Dict {
  meta: { description: S; skip: S; switchLabel: S; switchTitle: S };
  nav: { about: S; skills: S; experience: S; projects: S; cases: S; blog: S; contact: S; resume: S; downloadResume: S };
  hero: { status: S; lede: S; viewWork: S; getInTouch: S; quote: S; scroll: S };
  about: {
    eyebrow: S; title: S; p1: S; p2: S; focus: S; statProjects: S; statPlatforms: S; statTech: S; portrait: S; openToWork: S;
    cards: [title: S, text: S][];
  };
  skills: { eyebrow: S; title: S; sub: S };
  experience: { eyebrow: S; title: S; sub: S };
  projects: { eyebrow: S; title: S; sub: S; filterLabel: S; all: S; caseStudy: S; tryIt: S; source: S; live: S; shot: S; focusShown: S; focusReset: S };
  github: {
    eyebrow: S; title: S; sub: S; repos: S; followers: S; since: S; langs: S; solved: S;
    easy: S; medium: S; hard: S; rating: S; contests: S; ranking: S; graph: S; graphAlt: S;
  };
  certs: { eyebrow: S; title: S; sub: S; view: S };
  ach: { eyebrow: S; title: S; sub: S };
  contact: {
    eyebrow: S; title: S; sub: S; email: S; location: S; quick: S; formTitle: S; formSub: S;
    name: S; namePh: S; subject: S; pick: S; subjects: S[]; message: S; messagePh: S; send: S;
  };
  footer: { built: S; updated: S };
}

/** Translations of the descriptive text in src/data/site.ts. */
export interface DataDict {
  roles: S[];
  skillGroups: Record<S, S>;
  categories: Record<S, S>;
  projects: Record<S, S>;
  experience: { role: S; org: S; period: S; place: S; points: S[] }[];
  certs: Record<S, S>;
  stats: S[];
  milestones: { when: S; title: S; text: S }[];
}
