// "Ask my portfolio" chat window.
import { $, esc, focusReturner } from './dom';
import { localAnswer } from './chat-local';

export interface ChatApi { open(v: boolean): void; ask(text: string): void }

const CHIPS = ['What do you build?', 'Projects with FastAPI', 'Tell me about Venture DAO', 'Certifications', 'Education', 'How can I contact you?'];

/** Produces the reply HTML for a question. Replaced in initChat by the AI-backed version when available. */
export type Answerer = (question: string) => Promise<string>;

export function initChat(answer: Answerer = async (q) => localAnswer(q)): ChatApi | null {
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

  let busy = false;
  const ask = async (text: string) => {
    text = text.trim();
    if (!text || busy) return;
    busy = true;
    add(esc(text), 'me');
    const t = add('<span class="typing"><i></i><i></i><i></i></span>', 'bot');
    const started = performance.now();
    let reply: string;
    try { reply = await answer(text); } catch { reply = localAnswer(text); }
    // keep the typing dots up briefly so instant local answers don't feel jarring
    const wait = Math.max(0, Math.min(400 + reply.length * 2, 1100) - (performance.now() - started));
    setTimeout(() => { t.innerHTML = reply; log.scrollTop = log.scrollHeight; busy = false; }, wait);
  };

  const chips = $('#chat-chips');
  if (chips) {
    chips.innerHTML = CHIPS.map((c) => `<button type="button">${esc(c)}</button>`).join('');
    chips.addEventListener('click', (e) => { const b = (e.target as Element).closest('button'); if (b?.textContent) void ask(b.textContent); });
  }
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
