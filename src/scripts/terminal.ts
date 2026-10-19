// Terminal mode (press ~ or `).
import { CERTS, PROFILE, PROJECTS, SECTIONS, SKILLS } from '@/data/site';
import { $, esc, focusReturner, goTo } from './dom';
import { toggleTheme } from './ui';

export interface TerminalApi { open(): void; close(): void; run(raw: string): void }

type Cmd = (args: string[]) => string | null;

export function initTerminal(): TerminalApi | null {
  const box = $('#term'), out = $('#term-out'), input = $<HTMLInputElement>('#term-input');
  if (!box || !out || !input) return null;
  const hist: string[] = [];
  let hi = 0;
  const line = (html: string, cls = '') => { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; out.appendChild(d); out.scrollTop = out.scrollHeight; };
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const link = (href: string, text: string) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;
  const ids = SECTIONS.map((s) => s[0].slice(1)).join(', ');

  const focus = focusReturner();
  const open = () => {
    if (box.classList.contains('open')) { input.focus({ preventScroll: true }); return; }
    focus.save();
    box.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (!out.childElementCount) {
      line('<span class="u">Divyanshu OS</span> <span class="dim">v2.0 · type "help" to get started</span>');
      line(`<span class="dim">Last login: ${new Date().toDateString()} on ttys001</span>`);
    }
    input.focus({ preventScroll: true }); // focus right away so fast typing isn't lost
  };
  const close = () => { box.classList.remove('open'); document.body.style.overflow = ''; focus.restore(box); };

  const CMDS: Record<string, Cmd> = {
    help: () => [
      '<span class="u">Available commands</span>',
      '  <span class="p">whoami</span>        who I am',
      '  <span class="p">about</span>         a short bio',
      '  <span class="p">projects</span>      list projects  (<span class="dim">project &lt;name&gt;</span> for details)',
      '  <span class="p">skills</span>        my tech stack',
      '  <span class="p">certs</span>         certifications',
      '  <span class="p">education</span>     degree and grades',
      '  <span class="p">contact</span>       how to reach me',
      '  <span class="p">resume</span>        download my résumé',
      '  <span class="p">blog</span> / <span class="p">cases</span>  open the blog or case studies',
      '  <span class="p">github</span> / <span class="p">linkedin</span> / <span class="p">leetcode</span>  open profiles',
      `  <span class="p">goto</span> &lt;section&gt;  scroll the page (<span class="dim">${ids}</span>)`,
      '  <span class="p">theme</span>         toggle light / dark',
      '  <span class="p">clear</span>         clear the screen',
      '  <span class="p">exit</span>          close the terminal',
      '<span class="dim">Tip: ↑/↓ for history, Tab to autocomplete.</span>',
    ].join('\n'),
    whoami: () => `${PROFILE.name}: B.Tech CSE (AI &amp; ML) @ SRM IST, AI &amp; full-stack engineer.`,
    about: () => 'I build software that shows its work: LLM agents that learn from failed experiments,\nbackend services built for correctness, and apps people actually use.\nMy rule: state the claim, build the baseline, then measure.',
    projects: () => PROJECTS.map((p, i) => `<span class="dim">${String(i + 1).padStart(2, '0')}</span>  <span class="u">${esc(p.name.padEnd(22))}</span> ${esc(p.cat)}`).join('\n') +
      '\n<span class="dim">Type "project &lt;name&gt;" for details, e.g. project venture</span>',
    project: (args) => {
      const q = args.join(' ').toLowerCase();
      if (!q) return '<span class="err">usage: project &lt;name&gt;</span>';
      const p = PROJECTS.find((x) => x.name.toLowerCase().includes(q) || slug(x.name).includes(slug(q)));
      if (!p) return `<span class="err">project not found: ${esc(q)}</span>  (try "projects")`;
      return [`<span class="u">${esc(p.name)}</span>  <span class="dim">[${esc(p.cat)}]</span>`, esc(p.desc), `<span class="p">stack:</span> ${p.tags.map(esc).join(', ')}`,
        p.live ? `<span class="p">live:</span>  ${link(p.live, p.live)}` : '', p.code ? `<span class="p">code:</span>  ${link(p.code, p.code)}` : '',
        p.slug ? `<span class="p">case study:</span> <a href="/case/${p.slug}">/case/${p.slug}</a>` : ''].filter(Boolean).join('\n');
    },
    skills: () => Object.entries(SKILLS).map(([c, l]) => `<span class="u">${esc(c)}</span>\n  ${l.map((s) => esc(s[0])).join(', ')}`).join('\n'),
    certs: () => CERTS.map((c) => `<span class="ok">✔</span> ${esc(c.title)} <span class="dim">· ${esc(c.issuer)} · ${esc(c.date)}</span>`).join('\n'),
    education: () => `${esc(PROFILE.education.degree)} · SRM IST, Delhi-NCR · ${PROFILE.education.years} · <span class="ok">CGPA ${PROFILE.education.cgpa}/10</span>\nClass XII (CBSE, 2022) · ${PROFILE.education.classXII}`,
    contact: () => `email     ${link(`mailto:${PROFILE.email}`, PROFILE.email)}\nlinkedin  ${link(PROFILE.linkedin, 'in/divyanshu-bhatiwal')}\ngithub    ${link(PROFILE.github, `github.com/${PROFILE.githubUser}`)}`,
    resume: () => { window.open('/resume.pdf', '_blank'); return '<span class="ok">Opening resume.pdf ...</span>'; },
    blog: () => { location.href = '/blog'; return '<span class="ok">Opening the blog ...</span>'; },
    cases: () => { location.href = '/case'; return '<span class="ok">Opening case studies ...</span>'; },
    github: () => { window.open(PROFILE.github, '_blank', 'noopener'); return '<span class="ok">Opening GitHub ...</span>'; },
    linkedin: () => { window.open(PROFILE.linkedin, '_blank', 'noopener'); return '<span class="ok">Opening LinkedIn ...</span>'; },
    leetcode: () => { window.open(`https://leetcode.com/u/${PROFILE.leetcodeUser}/`, '_blank', 'noopener'); return '<span class="ok">Opening LeetCode ...</span>'; },
    goto: (args) => {
      const w = (args[0] ?? '').toLowerCase();
      const s = SECTIONS.find(([id, name]) => id.slice(1) === w || name.toLowerCase().startsWith(w));
      if (!w || !s) return `<span class="err">usage: goto &lt;section&gt;</span>  (${ids})`;
      close(); setTimeout(() => goTo(s[0]), 150); return `<span class="ok">→ ${esc(s[1])}</span>`;
    },
    theme: () => `<span class="ok">theme: ${toggleTheme()}</span>`,
    ls: () => '<span class="u">about/</span>  <span class="u">projects/</span>  <span class="u">certs/</span>  <span class="u">blog/</span>  resume.pdf  contact.txt',
    cat: (args) => args[0] === 'contact.txt' ? CMDS.contact!([]) : args[0] === 'resume.pdf' ? '<span class="dim">binary file. Try "resume" instead.</span>' : `<span class="err">cat: ${esc(args[0] ?? '')}: No such file</span>`,
    sudo: () => '<span class="err">Nice try. You are already root of this conversation.</span> Try "contact" instead 😉',
    date: () => new Date().toString(),
    echo: (args) => esc(args.join(' ')),
    history: () => hist.map((h, i) => `${String(i + 1).padStart(3)}  ${esc(h)}`).join('\n') || '<span class="dim">(empty)</span>',
    clear: () => { out.innerHTML = ''; return null; },
    exit: () => { close(); return null; },
  };
  CMDS.cd = CMDS.goto!; CMDS.whois = CMDS.whoami!; CMDS.cv = CMDS.resume!; CMDS.quit = CMDS.exit!;

  const run = (raw: string) => {
    const text = raw.trim();
    line(`<span class="p">visitor@divyanshu:~$</span> ${esc(text)}`);
    if (!text) return;
    hist.push(text); hi = hist.length;
    const [cmd = '', ...args] = text.split(/\s+/);
    const fn = CMDS[cmd.toLowerCase()];
    const res = fn ? fn(args) : `<span class="err">command not found: ${esc(cmd)}</span>  (type "help")`;
    if (res) line(res);
  };

  $('#term-form')?.addEventListener('submit', (e) => { e.preventDefault(); run(input.value); input.value = ''; });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) input.value = hist[--hi] ?? ''; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hist.length, hi + 1); input.value = hist[hi] ?? ''; }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const v = input.value.toLowerCase(), m = Object.keys(CMDS).filter((c) => c.startsWith(v));
      if (m.length === 1) input.value = `${m[0]} `;
      else if (m.length > 1) line(m.join('  '), 'dim');
    } else if (e.key === 'Escape') close();
  });
  box.addEventListener('click', (e) => { if (e.target === box) close(); else if (!getSelection()?.toString()) input.focus(); });
  $('#term-close-dot')?.addEventListener('click', close);
  return { open, close, run };
}
