// Rule-based answers from the site's own data. Used when the AI chat endpoint is unavailable
// (no API key configured, rate-limited, offline), so the chat always says something accurate.
import { CERTS, EXPERIENCE, PROFILE, PROJECTS, SKILLS, projectsByCategory, type Project } from '@/data/site';
import { esc } from './dom';

const a = (href: string, text: string) =>
  `<a href="${esc(href)}"${href.startsWith('#') || href.startsWith('/') ? '' : ' target="_blank" rel="noopener noreferrer"'}>${esc(text)}</a>`;
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (q: string, word: string) => new RegExp(`(^|[^a-z0-9])${reEsc(word)}([^a-z0-9]|$)`).test(q);

// tech term -> projects that use it (tags like "Express 5" become "express")
const techIndex: Record<string, Set<string>> = {};
for (const p of PROJECTS) for (const t of p.tags) {
  const k = t.toLowerCase().replace(/\s+\d+(\.\d+)?$/, '').trim();
  (techIndex[k] ??= new Set()).add(p.name);
}
const ALIASES: Record<string, string> = {
  postgres: 'postgresql', node: 'node.js', nodejs: 'node.js', llm: 'llm agents', agents: 'llm agents',
  ml: 'scikit-learn', sklearn: 'scikit-learn', rn: 'react native',
};
const projectKeys = PROJECTS.map((p) => {
  const n = p.name.toLowerCase();
  return { p, keys: [n, n.split(' ')[0] ?? n, n.replace(/\s+/g, '')] };
});

export function projectAnswer(p: Project): string {
  const links = [p.live && a(p.live, 'Live demo'), p.code && a(p.code, 'Source code'), p.slug && a(`/case/${p.slug}`, 'Case study')].filter(Boolean);
  return `<b>${esc(p.name)}</b> (${esc(p.cat)})<br>${esc(p.desc)}<br><br><b>Stack:</b> ${p.tags.map(esc).join(', ')}` +
    (links.length ? `<br>${links.join(' · ')}` : '');
}

export function localAnswer(raw: string): string {
  const q = ` ${raw.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, ' ').replace(/\s+/g, ' ')} `;

  if (/^\s*(hi|hello|hey|hii+|yo|namaste|hola)\b/.test(q)) {
    return 'Hi! Ask me about my projects, the tech I use, my certifications or how to reach me.';
  }
  const hit = projectKeys.find(({ keys }) => keys.some((k) => k.length > 2 && has(q, k)));
  if (hit && !/\b(all|list|which)\b/.test(q)) return projectAnswer(hit.p);

  let term = Object.keys(techIndex).sort((x, y) => y.length - x.length).find((k) => has(q, k));
  if (!term) { const al = Object.keys(ALIASES).find((k) => has(q, k)); if (al) term = ALIASES[al]; }
  const names = term ? techIndex[term] : undefined;
  if (term && names) {
    return `I've used <b>${esc(term)}</b> in ${names.size} project${names.size > 1 ? 's' : ''}:<ul>${[...names].map((n) => {
      const p = PROJECTS.find((x) => x.name === n)!;
      return `<li><b>${esc(n)}</b>: ${esc(p.desc.split('. ')[0])}.</li>`;
    }).join('')}</ul>`;
  }
  if (/\b(contact|email|mail|reach|hire|hiring|available|availability|freelance|opportunit|job|role)/.test(q)) {
    return `I'm open to internships, full-time roles and freelance work.<br>Email: ${a(`mailto:${PROFILE.email}`, PROFILE.email)}<br>${a(PROFILE.linkedin, 'LinkedIn')} · ${a(PROFILE.github, 'GitHub')} · ${a('/#contact', 'Contact form')}`;
  }
  if (/\b(resume|cv|résumé)\b/.test(q)) return `You can download my résumé here: ${a('/resume.pdf', 'resume.pdf')}`;
  if (/\b(education|college|university|cgpa|gpa|degree|srm|study|studying|student|school|marks|grade)/.test(q)) {
    const e = PROFILE.education;
    return `I'm doing a <b>${esc(e.degree)}</b> at ${esc(e.school)} (${esc(e.years)}), with a <b>CGPA of ${e.cgpa}/10</b>. Class XII (CBSE): ${esc(e.classXII)}.`;
  }
  if (/\b(cert|certificate|certificates|certification|certifications|course|courses|certified)/.test(q)) {
    return `${CERTS.length} certifications:<ul>${CERTS.map((c) => `<li>${c.url ? a(c.url, c.title) : esc(c.title)}, ${esc(c.issuer)} (${esc(c.date)})</li>`).join('')}</ul>`;
  }
  if (/\b(leetcode|dsa|problems|competitive)\b/.test(q)) {
    return `I practise DSA on ${a(`https://leetcode.com/u/${PROFILE.leetcodeUser}/`, 'LeetCode')}. The ${a('/#github', 'coding activity section')} shows my live solved counts.`;
  }
  if (/\b(github|repo|repos|repository|open source|code)\b/.test(q)) {
    return `My code is on ${a(PROFILE.github, 'GitHub')}. The ${a('/#github', 'GitHub section')} shows my languages and latest repos live.`;
  }
  if (/\b(experience|worked|work history|internship|intern)\b/.test(q)) {
    return `<ul>${EXPERIENCE.map((x) => `<li><b>${esc(x.role)}</b>, ${esc(x.org)} (${esc(x.period)})</li>`).join('')}</ul>Details are in the ${a('/#experience', 'Experience section')}.`;
  }
  if (/\b(skill|skills|stack|tech|technologies|languages|tools|good at|know)\b/.test(q)) {
    return `<ul>${Object.entries(SKILLS).map(([cat, list]) => `<li><b>${esc(cat)}:</b> ${list.map((s) => esc(s[0])).join(', ')}</li>`).join('')}</ul>`;
  }
  if (/\b(project|projects|built|build|made|portfolio|work)\b/.test(q)) {
    return `${PROJECTS.length} projects:<ul>${Object.entries(projectsByCategory()).map(([c, ps]) => `<li><b>${esc(c)}:</b> ${ps.map((p) => esc(p.name)).join(', ')}</li>`).join('')}</ul>Ask about any one by name for details.`;
  }
  if (/\b(where|location|based|live|city|country|india|remote)\b/.test(q)) return "I'm based in India (Delhi-NCR) and open to remote work.";
  if (/\b(best|favourite|favorite|proud|proudest|hardest|biggest|top)\b/.test(q)) {
    return 'Two stand out:<ul><li><b>AutoSci</b>: an LLM agent that learns from its own failed experiments, measured against Optuna and random search.</li><li><b>Venture DAO</b>: a trading engine where a retried request can never open a duplicate position, plus a risk check no code path can skip.</li></ul>';
  }
  if (/\b(who|about|yourself|introduce|summary|divyanshu|bhatiwal)\b/.test(q)) {
    return "I'm Divyanshu Bhatiwal, a B.Tech CSE (AI &amp; ML) student at SRM IST. I build LLM agents, backend services and full-stack apps. My rule: state the claim, build the baseline, then measure.";
  }
  return "I only know what's on this site, and I couldn't match that. Try asking about my <b>projects</b>, a technology like <b>FastAPI</b> or <b>React</b>, my <b>certifications</b>, <b>education</b> or how to <b>contact</b> me.";
}
