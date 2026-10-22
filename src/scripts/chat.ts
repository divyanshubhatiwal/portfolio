// "Ask my portfolio" chat window.
import { $, esc, focusReturner } from './dom';
import { localAnswer } from './chat-local';

export interface ChatApi { open(v: boolean): void; ask(text: string): void }

/** Longest question accepted from a shared link (the API accepts 500). */
export const MAX_SHARED_QUESTION = 300;

/** A link that opens the site with the chat asking this question. */
export const shareLink = (q: string): string => `${location.origin}/?ask=${encodeURIComponent(q.slice(0, MAX_SHARED_QUESTION))}`;

const CHIPS = ['What do you build?', 'Projects with FastAPI', 'Tell me about Venture DAO', 'Certifications', 'Education', 'How can I contact you?'];

/** Produces the reply HTML for a question. Replaced in initChat by the AI-backed version when available. */
export type Answerer = (question: string) => Promise<string>;

export interface ChatOptions {
  /** called with each bot reply's HTML once it is shown (used by voice mode to read answers aloud) */
  onReply?: (html: string) => void;
}

export function initChat(answer: Answerer = async (q) => localAnswer(q), opts: ChatOptions = {}): ChatApi | null {
  const chat = $('#chat'), log = $('#chat-log'), input = $<HTMLInputElement>('#chat-input'), btn = $('#chat-btn');
  if (!chat || !log || !input || !btn) return null;

  const add = (html: string, who: 'bot' | 'me') => {
    const m = document.createElement('div');
    m.className = `msg ${who}`;
    m.innerHTML = html;
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  };

  const asked = new Set<string>();
  // after each answer: up to three follow-up questions, and a button to share the question as a link.
  // AI replies bring their own follow-ups (a .followups block); otherwise topics not yet asked are offered.
  const extras = (question: string, reply: string): string => {
    const own = /class="followups"/.test(reply);
    const next = own ? [] : CHIPS.filter((c) => !asked.has(c.toLowerCase())).slice(0, 2);
    const chips = next.length ? `<div class="followups">${next.map((q) => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : '';
    return `${chips}<button type="button" class="chat-share" data-share="${esc(question)}">Copy link to this question</button>`;
  };

  let busy = false;
  const ask = async (text: string) => {
    text = text.trim();
    if (!text || busy) return;
    busy = true;
    asked.add(text.toLowerCase());
    add(esc(text), 'me');
    const t = add('<span class="typing"><i></i><i></i><i></i></span>', 'bot');
    const started = performance.now();
    let reply: string;
    try { reply = await answer(text); } catch { reply = localAnswer(text); }
    // keep the typing dots up briefly so instant local answers don't feel jarring
    const wait = Math.max(0, Math.min(400 + reply.length * 2, 1100) - (performance.now() - started));
    setTimeout(() => { t.innerHTML = reply + extras(text, reply); log.scrollTop = log.scrollHeight; busy = false; opts.onReply?.(reply); }, wait);
  };

  const chips = $('#chat-chips');
  if (chips) {
    chips.innerHTML = CHIPS.map((c) => `<button type="button">${esc(c)}</button>`).join('');
    chips.addEventListener('click', (e) => { const b = (e.target as Element).closest('button'); if (b?.textContent) void ask(b.textContent); });
  }
  log.addEventListener('click', (e) => {
    const target = e.target as Element;
    const q = target.closest<HTMLElement>('[data-q]')?.dataset.q;
    if (q) { void ask(q); return; }
    const share = target.closest<HTMLButtonElement>('[data-share]');
    if (!share) return;
    const url = shareLink(share.dataset.share ?? '');
    const done = (msg: string) => { share.textContent = msg; setTimeout(() => { share.textContent = 'Copy link to this question'; }, 2000); };
    navigator.clipboard?.writeText(url).then(() => done('Link copied'), () => { prompt('Copy this link:', url); });
  });
  $('#chat-form')?.addEventListener('submit', (e) => { e.preventDefault(); void ask(input.value); input.value = ''; });

  let greeted = false;
  const focus = focusReturner(() => btn);
  const open = (v: boolean) => {
    if (v === chat.classList.contains('open')) return;
    if (v) focus.save();
    chat.classList.toggle('open', v);
    btn.setAttribute('aria-expanded', String(v));
    if (v) {
      if (!greeted) { greeted = true; add('Hi! Ask me anything about my work: projects, tech stack, certifications or how to reach me.', 'bot'); }
      input.focus({ preventScroll: true });
    } else {
      focus.restore(chat);
    }
  };
  btn.addEventListener('click', () => open(!chat.classList.contains('open')));
  $('#chat-close')?.addEventListener('click', () => open(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && chat.classList.contains('open')) open(false); });
  return { open, ask: (t) => void ask(t) };
}
