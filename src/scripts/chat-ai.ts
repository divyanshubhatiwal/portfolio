// AI answers for the chat via /api/chat, with the rule-based answers as an automatic fallback
// (no API key configured, rate-limited, offline or any error).
import { $, esc } from './dom';
import { localAnswer } from './chat-local';
import type { Answerer } from './chat';

interface Turn { role: 'user' | 'assistant'; content: string }

/**
 * Render the model's reply safely: escape everything first, then allow only **bold**, "- " lists
 * and [text](url) links whose URL is http(s) or a site path. Nothing else from the model becomes HTML.
 */
export function renderReply(text: string): string {
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)"'<>]+|\/[^\s)"'<>]*)\)/g, (_m, label: string, url: string) =>
        `<a href="${url}"${url.startsWith('/') ? '' : ' target="_blank" rel="noopener noreferrer"'}>${label}</a>`);
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.map((l) => `<li>${l}</li>`).join('')}</ul>`); list = []; } };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const item = /^[-*]\s+(.*)/.exec(line);
    if (item) { list.push(inline(item[1] ?? '')); continue; }
    flush();
    if (line) out.push(inline(line));
  }
  flush();
  return out.join('<br>').replace(/<br><ul>/g, '<ul>').replace(/<\/ul><br>/g, '</ul>');
}

export function aiAnswerer(): Answerer {
  const history: Turn[] = [];
  let aiOff = false; // after a "not configured" reply, stop trying for this page view
  const mode = $('#chat-mode');

  return async (question: string) => {
    let reply: string | null = null;
    if (!aiOff) {
      try {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, history: history.slice(-6) }),
          signal: AbortSignal.timeout(30_000),
        });
        if (r.ok) {
          const { answer } = (await r.json()) as { answer?: string };
          if (answer) {
            history.push({ role: 'user', content: question }, { role: 'assistant', content: answer });
            reply = renderReply(answer);
          }
        } else if (r.status === 503) {
          aiOff = true;
          if (mode) mode.textContent = 'Answers from this site';
        }
      } catch { /* network error or timeout: fall through to the local answer */ }
    }
    return reply ?? localAnswer(question);
  };
}
