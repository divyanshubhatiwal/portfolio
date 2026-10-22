// /evidence: pick a skill (or a project) to highlight its links and list the proof.
import { $, $$, esc } from './dom';
import type { ProjectNode, SkillNode } from '@/lib/evidence';

const root = $('#ev');
if (root) {
  const skills = JSON.parse(root.dataset.skills ?? '[]') as SkillNode[];
  const projects = JSON.parse(root.dataset.projects ?? '[]') as ProjectNode[];
  const panel = $('#ev-panel')!;
  const KIND: Record<string, string> = { dependency: 'Dependency', files: 'In the code', code: 'In the code', described: 'Described' };
  const external = (u: string) => u.startsWith('http');
  const link = (u: string, text: string) => `<a href="${esc(u)}"${external(u) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}${external(u) ? ' ↗' : ''}</a>`;

  const clear = () => {
    root.classList.remove('focused');
    for (const el of $$('.on', root)) el.classList.remove('on');
  };
  const mark = (sel: string) => { for (const el of $$(sel, root)) el.classList.add('on'); };

  const showSkill = (i: number): void => {
    const s = skills[i];
    if (!s) return;
    clear();
    root.classList.add('focused');
    mark(`[data-s="${i}"]`);
    for (const p of s.proofs) { const pi = projects.findIndex((x) => x.name === p.project); if (pi >= 0) mark(`.ev-project[data-p="${pi}"]`); }
    const coded = s.proofs.filter((p) => p.kind !== 'described').length;
    panel.innerHTML = `<h3>${esc(s.name)}</h3>
      <p class="ev-sum">${coded ? `Proven in the code of ${coded} project${coded > 1 ? 's' : ''}` : 'Described, not public code'}${s.proofs.length > coded ? `; described in ${s.proofs.length - coded} more` : ''}.</p>
      <ul>${s.proofs.map((p) => `<li class="${p.kind === 'described' ? 'weak' : ''}"><span class="k">${KIND[p.kind]}</span><b>${esc(p.project)}</b>${link(p.url, esc(p.label))}</li>`).join('')}</ul>`;
  };

  const showProject = (i: number): void => {
    const p = projects[i];
    if (!p) return;
    clear();
    root.classList.add('focused');
    mark(`.ev-project[data-p="${i}"]`);
    mark(`.ev-edge[data-p="${i}"]`);
    const uses = skills.map((s, si) => ({ s, si, proof: s.proofs.find((x) => x.project === p.name) })).filter((x) => x.proof);
    for (const u of uses) mark(`.ev-skill[data-s="${u.si}"], .ev-list [data-s="${u.si}"]`);
    panel.innerHTML = `<h3>${esc(p.name)}</h3>
      <p class="ev-sum">${uses.length} skills. ${link(p.href, 'Open the project')}</p>
      <ul>${uses.map(({ s, proof }) => `<li class="${proof!.kind === 'described' ? 'weak' : ''}"><span class="k">${KIND[proof!.kind]}</span><b>${esc(s.name)}</b>${link(proof!.url, esc(proof!.label))}</li>`).join('')}</ul>`;
  };

  const pick = (el: Element | null) => {
    const node = el?.closest<HTMLElement>('[data-s], .ev-project');
    if (!node || node.classList.contains('ev-edge')) return;
    if (node.classList.contains('ev-project')) showProject(Number(node.dataset.p));
    else showSkill(Number(node.dataset.s));
  };
  root.addEventListener('click', (e) => pick(e.target as Element));
  root.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && (e.target as Element).matches('.ev-node')) { e.preventDefault(); pick(e.target as Element); }
  });

  // a skill can be linked to directly: /evidence#skill=MongoDB
  const wanted = decodeURIComponent(/skill=([^&]+)/.exec(location.hash)?.[1] ?? '');
  const start = Math.max(0, skills.findIndex((s) => s.name.toLowerCase() === wanted.toLowerCase()));
  showSkill(wanted ? start : 0);
}
