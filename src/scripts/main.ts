// Client entry point, loaded on every page by Base.astro. Each module checks that its
// elements exist, so sub-pages (case studies, blog) simply skip the home-only features.
import { isTyping, storageGet, storageSet } from './dom';
import { initIntro } from './intro';
import { initEffects } from './effects';
import { initUI } from './ui';
import { initGitHub } from './github';
import { initLeetCode } from './leetcode';
import { initContact } from './contact';
import { initChat } from './chat';
import { aiAnswerer } from './chat-ai';
import { initVoice } from './voice';
import { initTerminal } from './terminal';
import { initPalette } from './palette';
import { initSmoothScroll } from './smooth';
import { initArticle } from './article';
import { initRecruiterView } from './recruiter';

// A refresh always starts at the top of the page. Without this the browser restores the old scroll
// position, and a #section left in the address bar by a nav click jumps back to that section.
// Opening a link to a section, and back/forward, still land where they should.
const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
if (nav?.type === 'reload') {
  history.scrollRestoration = 'manual';
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  scrollTo(0, 0);
  addEventListener('load', () => scrollTo(0, 0), { once: true }); // after late images and fonts change the layout
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

const voice = initVoice();
const chat = initChat(aiAnswerer(), { onReply: (html) => voice.readAloud(html) });
const term = initTerminal();
const palette = initPalette(term, chat);

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
