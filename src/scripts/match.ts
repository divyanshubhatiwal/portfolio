// /match page: sends the pasted job description to /api/match and renders the structured result.
// Every string from the model is escaped before it touches the page.
import { $, esc } from './dom';
import { PROFILE } from '@/data/site';

interface Result {
  fit: { score: number; label: string; summary: string };
  matched: { requirement: string; evidence: string; projects: string[] }[];
  gaps: { requirement: string; note: string }[];
  talking_points: string[];
}

const SAMPLE = `Machine Learning Engineer Intern

We're looking for an ML engineering intern to help ship models into production.

Responsibilities
- Build and evaluate ML models in Python (scikit-learn, pandas)
- Design REST APIs (FastAPI preferred) to serve model predictions
- Work with PostgreSQL and Redis in our backend services
- Write tests and help maintain CI/CD pipelines with Docker
- Experiment with LLM-based features and evaluate them rigorously

Requirements
- Pursuing a degree in Computer Science or a related field
- Strong Python; some TypeScript is a plus
- Understanding of model evaluation and avoiding data leakage
- Experience with Git and collaborative development
- Nice to have: experience with Kubernetes and AWS SageMaker`;

const form = $<HTMLFormElement>('#match-form');
const jd = $<HTMLTextAreaElement>('#jd');
const out = $('#match-out');
const go = $<HTMLButtonElement>('#jd-go');
const count = $('#jd-count');
const links = JSON.parse($('#project-links')?.textContent ?? '{}') as Record<string, string>;

const updateCount = () => { if (jd && count) count.textContent = `${jd.value.length} / 8000`; };

function render(r: Result): string {
  const chips = (ps: string[]) => ps.map((p) => `<a class="chip" href="${esc(links[p] ?? '/#projects')}">${esc(p)}</a>`).join('');
  const deg = Math.round((r.fit.score / 100) * 360);
  return `
    <div class="fit">
      <div class="fit-ring" style="--deg:${deg}deg" role="img" aria-label="Fit score ${r.fit.score} out of 100"><b>${r.fit.score}</b><span>/100</span></div>
      <div><h2>${esc(r.fit.label)}</h2><p>${esc(r.fit.summary)}</p></div>
    </div>
    ${r.matched.length ? `<h3>What my work shows</h3><ul class="m-list">${r.matched.map((m) => `
      <li><b>${esc(m.requirement)}</b><p>${esc(m.evidence)}</p>${m.projects.length ? `<div class="chips">${chips(m.projects)}</div>` : ''}</li>`).join('')}</ul>` : ''}
    ${r.gaps.length ? `<h3>Gaps, honestly</h3><ul class="m-list gaps">${r.gaps.map((g) => `<li><b>${esc(g.requirement)}</b><p>${esc(g.note)}</p></li>`).join('')}</ul>` : ''}
    ${r.talking_points.length ? `<h3>Worth discussing</h3><ul class="m-points">${r.talking_points.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <p class="match-cta">Think it's a fit? <a href="mailto:${PROFILE.email}">Email me</a> or <a href="/resume.pdf">download my résumé</a>.</p>`;
}

function message(status: number, body: { error?: string; retryAfter?: number }): string {
  switch (body.error) {
    case 'not_configured': return `AI matching isn't switched on for this site yet. You can email the role to <a href="mailto:${PROFILE.email}">${PROFILE.email}</a> and I'll reply with how my work fits.`;
    case 'rate_limited': return `That's a lot of matches in a short time. Please try again in ${body.retryAfter ?? 60} seconds.`;
    case 'busy': return 'The matcher is busy right now. Please try again in a few minutes.';
    case 'too_short': return 'That job description is a bit short. Paste the full responsibilities and requirements.';
    case 'too_long': return 'That job description is too long. Trim it to the responsibilities and requirements (under 8,000 characters).';
    case 'refused': return "I couldn't analyse that text. Please paste a regular job description.";
    default: return `Something went wrong (${status}). Please try again, or email me at <a href="mailto:${PROFILE.email}">${PROFILE.email}</a>.`;
  }
}

if (form && jd && out && go) {
  jd.addEventListener('input', updateCount);
  $('#jd-sample')?.addEventListener('click', () => { jd.value = SAMPLE; updateCount(); jd.focus(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = jd.value.trim();
    if (text.length < 80) { out.hidden = false; out.innerHTML = `<p class="match-err">${message(400, { error: 'too_short' })}</p>`; return; }
    go.disabled = true; go.textContent = 'Analysing...';
    out.hidden = false;
    out.innerHTML = '<div class="match-loading"><span class="typing"><i></i><i></i><i></i></span> Reading the role and checking it against my projects...</div>';
    try {
      const r = await fetch('/api/match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd: text }), signal: AbortSignal.timeout(60_000),
      });
      const body = (await r.json().catch(() => ({}))) as Result & { error?: string; retryAfter?: number };
      out.innerHTML = r.ok && body.fit ? render(body) : `<p class="match-err">${message(r.status, body)}</p>`;
    } catch {
      out.innerHTML = `<p class="match-err">${message(0, {})}</p>`;
    } finally {
      go.disabled = false; go.textContent = 'Analyse fit';
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}
