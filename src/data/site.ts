// Single source of truth for the portfolio's content.
// Every section, the chat assistant, the terminal and the command palette read from here.

export const PROFILE = {
  name: 'Divyanshu Bhatiwal',
  title: 'AI & Full-Stack Engineer',
  email: 'divyanshubhatiwal99@gmail.com',
  github: 'https://github.com/divyanshubhatiwal',
  githubUser: 'divyanshubhatiwal',
  linkedin: 'https://www.linkedin.com/in/divyanshu-bhatiwal-0587b3288/',
  leetcodeUser: 'Divyanshu_Bhatiwal1',
  location: 'India · open to remote',
  education: {
    degree: 'B.Tech, CSE (AI & ML)',
    school: 'SRM Institute of Science and Technology, Delhi-NCR',
    years: '2023–2027',
    cgpa: 8.83,
    classXII: '88%',
  },
} as const;

export type IconId =
  | 'i-github' | 'i-linkedin' | 'i-mail' | 'i-arrow' | 'i-up' | 'i-down' | 'i-x' | 'i-menu' | 'i-send'
  | 'i-download' | 'i-pin' | 'i-bot' | 'i-layers' | 'i-gauge' | 'i-award' | 'i-sparkles' | 'i-sun' | 'i-moon';

/** [skill name, self-rated level 0–100] */
export type Skill = readonly [name: string, level: number];

export const SKILLS: Record<string, readonly Skill[]> = {
  'Languages': [['TypeScript', 90], ['Python', 88], ['JavaScript', 90], ['SQL', 70]],
  'Frontend & Mobile': [['React', 88], ['React Native / Expo', 82], ['Tailwind CSS', 85], ['Vite', 80]],
  'Backend & Data': [['Node.js / Express', 86], ['MongoDB', 82], ['WebRTC', 72], ['REST APIs', 88]],
  'AI / ML': [['LLM Agents', 85], ['RAG & Vector Search', 80], ['Optuna / HPO', 74], ['Anomaly Detection', 72]],
};

export type ProjectCategory = 'AI / ML' | 'Full-Stack' | 'Backend' | 'Mobile';

export interface Project {
  name: string;
  /** set when a case study exists at /case/<slug> */
  slug?: string;
  cat: ProjectCategory;
  featured?: boolean;
  desc: string;
  tags: readonly string[];
  /** repo URL; shows a Source button */
  code?: string;
  /** live deployment; shows a Live Demo button */
  live?: string;
  /** interactive demo hosted on this site */
  demo?: string;
  /** screenshot under /public */
  img?: string;
  imgPos?: string;
}

export const PROJECTS: readonly Project[] = [
  { name: 'AutoSci', slug: 'autosci', cat: 'AI / ML', featured: true,
    desc: 'An autonomous multi-agent research system. An LLM agent plans and runs ML experiments, then reasons over its own failures to choose what to try next. It is benchmarked against random search, Optuna TPE and ablated LLM variants on the same budget.',
    tags: ['Python', 'LLM Agents', 'Optuna', 'Experiment Design'] },
  { name: 'Venture DAO', slug: 'venture-dao', cat: 'Full-Stack',
    desc: 'Autonomous trading and governance platform. An explicit state-machine engine with idempotent order dispatch, a risk preflight no code path can skip, AES-256-GCM credential vault, TOTP 2FA and 20+ Jest suites.',
    tags: ['Node.js', 'Express 5', 'MongoDB', 'React 19', 'Docker', 'Jest'], code: 'https://github.com/divyanshubhatiwal/venture-dao',
    img: '/img/venturedao.jpg' },
  { name: 'FlowBoard', slug: 'flowboard', cat: 'Full-Stack',
    desc: 'AI-powered project management app with 15+ views (Kanban, Gantt, sprints, calendar, analytics) on a real-time Postgres backend with row-level security. An LLM creates tasks from plain language, with a rule-based fallback.',
    tags: ['React 18', 'TypeScript', 'Supabase', 'PostgreSQL', 'Tailwind', 'Claude AI'], live: 'https://flowboard-teal.vercel.app/' },
  { name: 'RideCompare', slug: 'ridecompare', cat: 'Backend',
    desc: 'Multi-provider fare aggregation service. Fans out concurrent fare and ETA lookups across four ride-hailing providers, normalises them into one schema and caches the hot path in Redis.',
    tags: ['FastAPI', 'PostgreSQL 16', 'Redis 7', 'Celery', 'Flutter', 'Nginx'], code: 'https://github.com/divyanshubhatiwal/ridecompare' },
  { name: 'SafeSignal AI', slug: 'safesignal', cat: 'Backend',
    desc: 'NLP pharmacovigilance data platform. Parses messy adverse-event reports into a relational schema and applies ROR/PRR disproportionality statistics to surface drug-safety signals, with Elasticsearch search and a full pytest suite.',
    tags: ['FastAPI', 'PostgreSQL', 'Redis', 'Elasticsearch', 'React', 'pytest'] },
  { name: 'Forensic Agent', slug: 'forensic-agent', cat: 'AI / ML',
    desc: 'Evidence-grounded incident investigation. It turns mixed logs into an entity graph, ranks anomalies, links them into incident chains and answers questions with a citation for every statement.',
    tags: ['Python', 'Graphs', 'RAG', 'Anomaly Detection'] },
  { name: 'T20 Score Predictor', cat: 'AI / ML',
    desc: 'ML pipeline on a simulated IPL-style dataset: generates innings data, engineers in-match features and compares Linear Regression with Random Forest. Runs live in the browser here, with an honest look at what the model actually learned.',
    tags: ['Python', 'Scikit-learn', 'Pandas', 'Streamlit'], demo: '/demo/t20', live: 'https://t20-score-predictor-wal.streamlit.app/', code: 'https://github.com/divyanshubhatiwal/t20-score-predictor' },
  { name: 'Friends Talk', cat: 'Full-Stack',
    desc: 'Anonymous, voice-first random chat. One tap matches you by voice, with no camera or account. Includes self-hosted signalling, matchmaking and moderation.',
    tags: ['WebRTC', 'Node.js', 'MongoDB Atlas'], live: 'https://friendstalk.fun/', code: 'https://github.com/divyanshubhatiwal/friends-talk',
    img: '/img/friendstalk.jpg' },
  { name: 'Breathe', cat: 'Mobile',
    desc: 'An offline-first breathing app with a 60 FPS animated guide, box and 4-7-8 patterns, ambient sound, haptics, streaks and reminders. No accounts and no network calls.',
    tags: ['Expo', 'React Native', 'TypeScript', 'Reanimated'],
    img: '/img/breathe.jpg', imgPos: 'center 40%' },
  // live demo hidden: lluminaa.vercel.app is paused on Vercel (503). Add `live` back once it's resumed.
  { name: 'Lumina', cat: 'Full-Stack',
    desc: 'A full-stack blogging platform with AI-powered semantic search over vector embeddings and real-time notifications.',
    tags: ['Node.js', 'MongoDB', 'Vector Search'] },
];

export interface Experience {
  badge: string;
  role: string;
  org: string;
  period: string;
  place: string;
  points: readonly string[];
  tags: readonly string[];
}

// Add internships or jobs here as you get them (newest first)
export const EXPERIENCE: readonly Experience[] = [
  { badge: 'IE', role: 'Independent Engineer', org: 'Self-directed projects', period: '2024 — Present', place: 'Remote',
    points: [
      'Designed and built AutoSci, a multi-agent research harness that compares LLM-driven experiment proposers against random search and Optuna TPE.',
      'Shipped an evidence-grounded forensic pipeline that turns raw logs into cited incident timelines, with a ground-truth evaluator.',
      'Built and deployed full-stack products (Venture DAO, Friends Talk) across Vercel and Render with MongoDB Atlas.',
    ],
    tags: ['Python', 'TypeScript', 'React', 'Node.js', 'LLM Agents'] },
  { badge: 'MB', role: 'Mobile Developer', org: 'Breathe (personal app)', period: '2025', place: 'Android / iOS',
    points: [
      'Built an offline-first Expo app with a UI-thread breathing animation that targets 60 FPS.',
      'Added wall-clock session timing that survives backgrounding, plus haptics, ambient audio and local reminders.',
      'Strict TypeScript, Jest tests and EAS build pipelines for APK, AAB and iOS.',
    ],
    tags: ['Expo', 'React Native', 'Reanimated', 'Jest'] },
  { badge: 'SRM', role: 'B.Tech, CSE (AI & ML)', org: 'SRM Institute of Science and Technology', period: '2023 — 2027', place: 'Delhi-NCR Campus, Ghaziabad',
    points: [
      'CGPA 8.83 / 10.',
      'Coursework: Data Structures & Algorithms, Operating Systems, DBMS, OOP, Compiler Design, Software Engineering & Project Management, Data Mining and NLP.',
    ],
    tags: ['DSA', 'DBMS', 'OS', 'NLP', 'Data Mining'] },
];

export interface Cert {
  title: string;
  issuer: string;
  date: string;
  desc: string;
  /** per-certificate verification link; the button is hidden when empty */
  url?: string;
}

export const CERTS: readonly Cert[] = [
  { title: 'Introduction to Artificial Intelligence', issuer: 'IBM · Coursera', date: 'Apr 2025',
    desc: 'Core AI concepts, machine learning and deep learning basics, and real-world AI use cases.',
    url: 'https://coursera.org/share/67449f835ef046dde5d9e35b93fdaebb' },
  { title: 'Python (Basic)', issuer: 'HackerRank', date: 'Oct 2024',
    desc: 'Skills test covering Python data types, control flow, functions and core syntax.',
    url: 'https://www.hackerrank.com/certificates/ef0d9608550a' },
  { title: 'Java (Basic)', issuer: 'HackerRank', date: 'Oct 2024',
    desc: 'Skills test covering Java fundamentals, OOP, classes and core language features.',
    url: 'https://www.hackerrank.com/certificates/3c02cdb22831' },
  { title: 'Introduction to Data Science', issuer: 'Infosys Springboard', date: 'Jun 2025',
    desc: 'The data science workflow: collecting, cleaning, exploring and modelling data.' },
  { title: 'Introduction to Natural Language Processing', issuer: 'Infosys Springboard', date: 'Jun 2025',
    desc: 'Text preprocessing, tokenisation, text representations and common NLP tasks.' },
  { title: 'Data Analysis with Python & Pandas', issuer: 'Infosys Springboard', date: '2025',
    desc: 'Loading, transforming and analysing tabular data with Pandas.' },
  { title: 'Data Mining', issuer: 'Infosys Springboard', date: '2025',
    desc: 'Finding patterns in data through classification, clustering and association rules.' },
];

export const ROLES: readonly string[] = ['AI & Full-Stack Engineer', 'LLM Agent Builder', 'React & React Native Dev', 'Systems That Show Their Work'];

export interface AchStat { n: number; dec?: number; suffix?: string; small?: string; label: string }

/** Only real, verifiable numbers. */
export const ACH_STATS: readonly AchStat[] = [
  { n: PROFILE.education.cgpa, dec: 2, small: '/10', label: 'CGPA at SRM IST' },
  { n: PROJECTS.length, label: 'Projects built' },
  { n: CERTS.length, label: 'Certifications' },
  { n: 88, suffix: '%', label: 'Class XII (CBSE)' },
];

export interface Milestone { icon: IconId; when: string; title: string; text: string }

// To add hackathons, contest ranks or other milestones, add another entry here.
export const MILESTONES: readonly Milestone[] = [
  { icon: 'i-award', when: 'Oct 2024', title: 'HackerRank Python & Java', text: 'Passed HackerRank skills certifications in both Python and Java.' },
  { icon: 'i-sparkles', when: 'Apr 2025', title: 'IBM: Introduction to AI', text: "Completed IBM's AI foundations course on Coursera." },
  { icon: 'i-layers', when: '2025', title: '4 Infosys Springboard courses', text: 'Data Science, NLP, Data Analysis with Pandas and Data Mining.' },
  { icon: 'i-gauge', when: '2026', title: '20+ test suites on Venture DAO', text: 'Engine, auth, vault and venue adapters covered by Jest before every Docker deploy.' },
  { icon: 'i-bot', when: '2026', title: 'Shipped live products', text: 'Friends Talk is live at friendstalk.fun, and the T20 Score Predictor runs in the browser on this site.' },
  { icon: 'i-github', when: '2023 — now', title: `${PROJECTS.length} projects, end to end`, text: 'From ML pipelines to backend services and mobile apps, each one built and owned solo.' },
];

/** In-page sections, in order; used by the nav, terminal and command palette. */
export const SECTIONS: readonly (readonly [id: string, label: string])[] = [
  ['#home', 'Home'], ['#about', 'About'], ['#skills', 'Skills'], ['#experience', 'Experience'], ['#projects', 'Projects'],
  ['#github', 'GitHub activity'], ['#certifications', 'Certifications'], ['#achievements', 'Achievements'], ['#contact', 'Contact'],
];

/** Group projects by category, preserving order. */
export function projectsByCategory(): Record<string, Project[]> {
  const out: Record<string, Project[]> = {};
  for (const p of PROJECTS) (out[p.cat] ??= []).push(p);
  return out;
}
