// Client entry point, loaded on every page by Base.astro. Each module checks that its
// elements exist, so sub-pages (case studies, blog) simply skip the home-only features.
import { isTyping } from './dom';
import { initIntro } from './intro';
import { initEffects, particleNetwork } from './effects';
import { initUI } from './ui';
import { initGitHub } from './github';
import { initLeetCode } from './leetcode';
import { initContact } from './contact';
import { initChat } from './chat';
import { aiAnswerer } from './chat-ai';
import { initTerminal } from './terminal';
import { initPalette } from './palette';
import { initSmoothScroll } from './smooth';
import { initArticle } from './article';
import { canRun3D, whenIdle } from './capability';

initSmoothScroll();
initUI();
initIntro();
initEffects();
initArticle();
initContact();

// hero background: the 3D sphere on capable devices (loaded once the page is idle), the 2D network elsewhere
if (document.getElementById('particles')) {
  if (canRun3D()) {
    whenIdle(() => {
      import('./hero3d')
        .then((m) => { if (!m.mountHero3D()) particleNetwork(); })
        .catch(() => particleNetwork());
    });
  } else {
    particleNetwork();
  }
}
void initGitHub();
void initLeetCode();

const chat = initChat(aiAnswerer());
const term = initTerminal();
const palette = initPalette(term, chat);

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
