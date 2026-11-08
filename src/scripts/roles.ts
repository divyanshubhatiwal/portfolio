// Hero role line: slides through the roles every few seconds. Static for reduced motion,
// and paused while the tab is hidden so it doesn't churn in the background.
import { $, reducedMotion } from './dom';

export function initRoleRoll(): void {
  const box = $('.role-roll');
  if (!box || reducedMotion()) return;
  let roles: string[] = [];
  try { roles = JSON.parse(box.dataset.roles ?? '[]') as string[]; } catch { return; }
  if (roles.length < 2) return;
  let i = 0;
  setInterval(() => {
    if (document.hidden) return;
    i = (i + 1) % roles.length;
    const next = document.createElement('span');
    next.textContent = roles[i]!;
    next.className = 'in';
    const old = box.firstElementChild;
    old?.classList.add('out');
    box.append(next);
    setTimeout(() => old?.remove(), 600);
  }, 3200);
}