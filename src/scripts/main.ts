// Client entry point, loaded on every page by Base.astro. Each module checks that its
// elements exist, so sub-pages (case studies, blog) simply skip the home-only features.
import { isTyping, storageGet, storageSet } from './dom';
import { initIntro } from './intro';
import { initEffects } from './effects';
import { initUI } from './ui';
import { initGitHub } from './github';
import { initLeetCode } from './leetcode';
import { initContact } from './contact';
import { initChat, MAX_SHARED_QUESTION } from './chat';
import { aiAnswerer } from './chat-ai';
import { initVoice } from './voice';
import { initTerminal } from './terminal';
import { initPalette } from './palette';
import { initSmoothScroll } from './smooth';
import { initArticle } from './article';
import { initRecruiterView } from './recruiter';
import { initStatus } from './status';

// A refresh always starts at the top of the page. Without this the browser restores the old scroll
// position, and a #section left in the address bar by a nav click jumps back to that section.
// Opening a link to a section, and back/forward, still land where they should.
const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
if (nav?.type === 'reload') {
  history.scrollRestoration = 'manual';
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  // 'instant', because html { scroll-behavior: smooth } would otherwise animate it and let a late jump win
  // never fights the visitor: once they wheel, touch or press a key, the later resets are skipped
  let userMoved = false;
  for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(ev, () => { userMoved = true; }, { once: true, passive: true });
  const top = () => { if (!userMoved) scrollTo({ top: 0, left: 0, behavior: 'instant' }); };
  top();
  // again once late images and fonts have changed the layout (the browser may also retry the old #section)
  addEventListener('load', () => { top(); requestAnimationFrame(() => requestAnimationFrame(top)); }, { once: true });
  void document.fonts?.ready.then(top);
}

initSmoothScroll();
initRecruiterView(); // before initUI, so reveal and filter code sees the final order
initUI();
initIntro();
initEffects();
initArticle();
initContact();

void initGitHub();
void initLeetCode();
void initStatus();

const voice = initVoice();
const chat = initChat(aiAnswerer(), { onReply: (html) => voice.readAloud(html) });
const term = initTerminal();
const palette = initPalette(term, chat);

// a shared question link (/?ask=…) opens the chat and asks it; the question then leaves the address bar
const shared = new URLSearchParams(location.search).get('ask')?.trim().slice(0, MAX_SHARED_QUESTION);
if (shared && chat) {
  const url = new URL(location.href);
  url.searchParams.delete('ask');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  chat.open(true);
  chat.ask(shared);
}

// visitor counter for /stats: one count per browser session; the endpoint ignores it until storage is set up
if (import.meta.env.PROD && !storageGet('visit-counted')) {
  storageSet('visit-counted', '1');
  try { navigator.sendBeacon('/api/visits'); } catch { /* blocked: not counted */ }
}

// offline support; production only, so a dev server never serves stale cached files
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => { /* unsupported or blocked: site still works online */ }); });
}

addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && palette) {
    e.preventDefault();
    if (palette.isOpen()) palette.close(); else palette.open();
    return;
  }
  if ((e.key === '`' || e.key === '~') && !isTyping() && term) {
    e.preventDefault();
    term.open();
  }
});
