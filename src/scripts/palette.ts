// Command palette (Ctrl/Cmd + K) with fuzzy search over sections, projects, pages and actions.
import { PROFILE, PROJECTS, SECTIONS, type IconId } from '@/data/site';
import { $, esc, focusReturner, goTo, toast } from './dom';
import { openConnect, toggleTheme } from './ui';
import type { ChatApi } from './chat';
import type { TerminalApi } from './terminal';

interface Item { group: string; label: string; hint?: string; icon: IconId; run: () => void }
export interface PaletteApi { open(): void; close(): void; isOpen(): boolean }

/** Every query character must appear in order; tighter and earlier matches score higher. */
function score(text: string, q: string): number {
  if (!q) return 1;
  text = text.toLowerCase();
  let ti = 0, s = 0, last = -1;
  for (const ch of q) {
    const i = text.indexOf(ch, ti);
    if (i < 0) return 0;
    s += i === last + 1 ? 3 : 1;
    if (i === 0) s += 2;
    last = i; ti = i + 1;
  }
  return s;
}

export function initPalette(term: TerminalApi | null, chat: ChatApi | null): PaletteApi | null {
  const box = $('#palette'), input = $<HTMLInputElement>('#pal-input'), list = $('#pal-list');
  if (!box || !input || !list) return null;
  const nav = (href: string) => () => { location.href = href; };

  const items: Item[] = [
    ...SECTIONS.map(([id, name]): Item => ({ group: 'Go to', label: name, icon: 'i-arrow', run: () => goTo(id) })),
    ...PROJECTS.map((p): Item => ({
      group: 'Projects', label: p.name, hint: p.cat, icon: 'i-layers', run: () => {
        const card = document.querySelector<HTMLElement>(`.project[data-name="${CSS.escape(p.name)}"]`);
        if (!card) { location.href = p.slug ? `/case/${p.slug}` : '/#projects'; return; }
        goTo('#projects');
        card.animate([{ boxShadow: '0 0 0 0 var(--accent)' }, { boxShadow: '0 0 0 4px var(--accent)' }, { boxShadow: '0 0 0 0 var(--accent)' }], { duration: 1400, delay: 700 });
      },
    })),
    { group: 'Actions', label: 'Download résumé', icon: 'i-download', run: () => window.open('/resume.pdf', '_blank') },
    { group: 'Actions', label: 'Toggle light / dark theme', icon: 'i-moon', run: () => { toggleTheme(); } },
    ...(term ? [{ group: 'Actions', label: 'Open terminal', hint: '~', icon: 'i-bot' as IconId, run: term.open }] : []),
    ...(chat ? [{ group: 'Actions', label: 'Ask my portfolio (AI chat)', icon: 'i-sparkles' as IconId, run: () => chat.open(true) }] : []),
    { group: 'Actions', label: 'Match me to a job description', icon: 'i-gauge', run: nav('/match') },
    { group: 'Actions', label: 'Try the T20 score predictor', icon: 'i-gauge', run: nav('/demo/t20') },
    { group: 'Actions', label: 'Copy email address', icon: 'i-mail', run: () => {
      void navigator.clipboard?.writeText(PROFILE.email).then(() => toast('Email copied', `${PROFILE.email} is on your clipboard.`), () => toast('Email', PROFILE.email));
    } },
    { group: 'Actions', label: "Let's connect", icon: 'i-arrow', run: () => openConnect() },
    { group: 'Pages', label: 'All case studies', icon: 'i-layers', run: nav('/case') },
    ...PROJECTS.filter((p) => p.slug).map((p): Item => ({ group: 'Pages', label: `Case study: ${p.name}`, icon: 'i-layers', run: nav(`/case/${p.slug}`) })),
    { group: 'Pages', label: 'Blog', icon: 'i-sparkles', run: nav('/blog') },
    { group: 'Links', label: 'GitHub', hint: `github.com/${PROFILE.githubUser}`, icon: 'i-github', run: () => window.open(PROFILE.github, '_blank', 'noopener') },
    { group: 'Links', label: 'LinkedIn', hint: 'in/divyanshu-bhatiwal', icon: 'i-linkedin', run: () => window.open(PROFILE.linkedin, '_blank', 'noopener') },
    { group: 'Links', label: 'LeetCode', hint: `@${PROFILE.leetcodeUser}`, icon: 'i-award', run: () => window.open(`https://leetcode.com/u/${PROFILE.leetcodeUser}/`, '_blank', 'noopener') },
  ];
  let shown: Item[] = [], active = 0;

  const render = () => {
    const q = input.value.trim().toLowerCase().replace(/\s+/g, '');
    shown = items.map((it) => ({ it, s: Math.max(score(it.label, q), score(it.group + it.label, q) - 1) }))
      .filter((x) => x.s > 0).sort((a, b) => (q ? b.s - a.s : 0)).map((x) => x.it);
    active = Math.min(active, Math.max(shown.length - 1, 0));
    if (!shown.length) { list.innerHTML = `<div class="pal-empty">No results for "${esc(input.value)}"</div>`; return; }
    let html = '', group = '';
    shown.forEach((it, i) => {
      if (!q && it.group !== group) { group = it.group; html += `<div class="pal-group">${esc(group)}</div>`; }
      html += `<button class="pal-item ${i === active ? 'active' : ''}" role="option" aria-selected="${i === active}" data-i="${i}"><span class="pi"><svg aria-hidden="true"><use href="#${it.icon}"/></svg></span><span>${esc(it.label)}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</button>`;
    });
    list.innerHTML = html;
    list.querySelector('.pal-item.active')?.scrollIntoView({ block: 'nearest' });
  };

  const focus = focusReturner();
  const close = () => { box.classList.remove('open'); focus.restore(box); };
  const open = () => { focus.save(); box.classList.add('open'); input.value = ''; active = 0; render(); input.focus({ preventScroll: true }); };
  const exec = (i: number) => { const it = shown[i]; if (!it) return; close(); setTimeout(it.run, 120); };

  input.addEventListener('input', () => { active = 0; render(); });
  input.addEventListener('keydown', (e) => {
    const n = Math.max(shown.length, 1);
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % n; render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + n) % n; render(); }
    else if (e.key === 'Enter') { e.preventDefault(); exec(active); }
    else if (e.key === 'Escape') close();
  });
  list.addEventListener('click', (e) => { const b = (e.target as Element).closest<HTMLElement>('.pal-item'); if (b) exec(Number(b.dataset.i)); });
  list.addEventListener('mousemove', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('.pal-item');
    if (b && Number(b.dataset.i) !== active) { active = Number(b.dataset.i); render(); }
  });
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  $('#pal-btn')?.addEventListener('click', open);
  const kbd = $('#pal-kbd');
  if (kbd && /Mac|iPhone|iPad/.test(navigator.userAgent)) kbd.textContent = '⌘ K';
  return { open, close, isOpen: () => box.classList.contains('open') };
}
