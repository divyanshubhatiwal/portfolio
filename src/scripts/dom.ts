// Small DOM helpers shared by every client-side module.

/** querySelector that returns null instead of throwing; typed by the caller. */
export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(sel);

export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] =>
  [...root.querySelectorAll<T>(sel)];

/** Escape text before putting it into innerHTML. */
export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = (): boolean => matchMedia('(hover: hover) and (pointer: fine)').matches;
export const coarsePointer = (): boolean => matchMedia('(pointer: coarse)').matches;

export const isTyping = (): boolean => {
  const el = document.activeElement;
  return !!el && (el.matches('input, textarea, select') || (el as HTMLElement).isContentEditable);
};

export function storageGet(key: string, store: Storage = sessionStorage): string | null {
  try { return store.getItem(key); } catch { return null; }
}
export function storageSet(key: string, value: string, store: Storage = sessionStorage): void {
  try { store.setItem(key, value); } catch { /* private mode / blocked storage: just skip caching */ }
}

/**
 * Remember what had focus when an overlay opens, and give it back on close. Without this,
 * focus stays inside the hidden overlay and keyboard shortcuts stop working.
 */
export function focusReturner(fallback?: () => HTMLElement | null) {
  let opener: HTMLElement | null = null;
  return {
    save(): void {
      const a = document.activeElement;
      opener = a instanceof HTMLElement && a !== document.body ? a : null;
    },
    restore(overlay: HTMLElement): void {
      if (!overlay.contains(document.activeElement)) return; // focus already moved on; leave it
      const target = opener?.isConnected ? opener : fallback?.() ?? null;
      if (target) target.focus({ preventScroll: true });
      else (document.activeElement as HTMLElement | null)?.blur();
      opener = null;
    },
  };
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(title: string, msg: string): void {
  const t = $('#toast');
  if (!t) return;
  t.innerHTML = `<b>${esc(title)}</b><span>${esc(msg)}</span>`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4000);
}

/** Lenis instance when smooth scrolling is active (set by smooth.ts). */
interface Scroller {
  scrollTo(target: number | string | HTMLElement, opts?: { offset?: number; immediate?: boolean }): void;
  stop(): void;
  start(): void;
}
let scroller: Scroller | null = null;
export const setScroller = (s: Scroller | null): void => { scroller = s; };

/** Scroll to an in-page section; on sub-pages, navigate to that section on the home page. */
export function goTo(sel: string): void {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) { location.href = `/${sel}`; return; }
  if (scroller) scroller.scrollTo(el, { offset: -64 });
  else el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
}

export const scrollTop = (): void => {
  if (scroller) scroller.scrollTo(0);
  else scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
};
