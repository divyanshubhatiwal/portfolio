// Runs the Forensic Agent's real Python pipeline in the browser with Pyodide, in a Web Worker so
// the page stays responsive. Messages in:  {type:'load'} | {type:'run', case} | {type:'ask', question}
// Messages out: {type:'progress', text} | {type:'ready', seconds} | {type:'result', data} | {type:'answer', data} | {type:'error', text}
/* global importScripts, loadPyodide */
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
let py = null;

const say = (type, extra) => postMessage({ type, ...extra });

const GLUE = `
import json, sys
sys.path.insert(0, '/home/pyodide/py')
from forensics import analyse
from forensics.evaluation import evaluate

_state = {}

def _ev(e):
    return {
        'id': e.event_id, 'at': e.timestamp.isoformat(), 'type': e.event_type.value, 'user': e.user, 'process': e.process,
        'path': e.path, 'dst': (f"{e.dst_ip}:{e.dst_port}" if e.dst_ip else None), 'bytes_out': e.bytes_out,
        'source': f"{e.source_file}:{e.source_line}", 'confidence': round(e.timestamp_confidence, 2),
    }

def run_case(case):
    root = f'/home/pyodide/cases/{case}'
    a = analyse(root)
    _state['a'] = a
    by = {e.event_id: e for e in a.events}
    ev = evaluate(a, f'{root}/ground_truth.json')
    r = a.ingest_report
    return json.dumps({
        'summary': a.summary(),
        'sources': r.per_source,
        'skew': {k: round(v, 1) for k, v in r.skew_applied.items()},
        'anchors': r.skew_anchors,
        'incidents': [{
            'id': i.incident_id, 'start': i.start.isoformat(), 'end': i.end.isoformat(), 'stages': i.stages,
            'score': round(i.score, 2), 'confidence': round(i.confidence, 2), 'rationale': i.rationale,
            'entities': i.entities, 'events': [_ev(by[x]) for x in i.event_ids if x in by],
        } for i in a.incidents],
        'anomalies': [{'id': x.event_id, 'score': round(x.score, 2), 'severity': x.severity, 'reasons': x.reasons, 'event': _ev(by[x.event_id])}
                      for x in sorted(a.anomalies, key=lambda x: -x.score)[:12] if x.event_id in by],
        'metrics': [{'name': m.name, 'value': round(m.value, 3), 'detail': m.detail} for m in ev.metrics],
    })

def ask(question):
    a = _state.get('a')
    if a is None:
        return json.dumps({'error': 'run a case first'})
    ans = a.investigator.ask(question)
    return json.dumps({
        'query': ans.query.describe(),
        'findings': [{'statement': f.statement, 'tier': f.tier, 'confidence': round(f.confidence, 2), 'evidence': f.evidence, 'reason': f.reason} for f in ans.findings],
        'withheld': len(ans.unsupported_claims),
    })
`;

async function load() {
  const t0 = performance.now();
  say('progress', { text: 'Downloading the Python runtime…' });
  importScripts(`${PYODIDE}pyodide.js`);
  py = await loadPyodide({ indexURL: PYODIDE });
  say('progress', { text: 'Installing numpy, scikit-learn and pydantic…' });
  const progress = (m) => { if (/^Loading /.test(m)) say('progress', { text: m.length > 90 ? `${m.slice(0, 90)}…` : m }); };
  await py.loadPackage(['numpy', 'scikit-learn', 'pydantic'], { messageCallback: progress });
  // networkx's package entry also pulls in matplotlib, which the pipeline never imports. Its wheel is pure
  // Python, so it's loaded straight from its URL, which skips those extra downloads (about 13 MB).
  say('progress', { text: 'Installing networkx…' });
  await py.loadPackage(`${PYODIDE}networkx-3.4.2-py3-none-any.whl`, { messageCallback: progress });

  say('progress', { text: 'Loading the Forensic Agent code and sample cases…' });
  const manifest = await (await fetch('/forensic/manifest.json')).json();
  const write = async (url, dest) => {
    const text = await (await fetch(url)).text();
    py.FS.mkdirTree(dest.slice(0, dest.lastIndexOf('/')));
    py.FS.writeFile(dest, text);
  };
  await Promise.all(manifest.python.map((f) => write(`/forensic/py/${f}`, `/home/pyodide/py/${f}`)));
  await Promise.all(Object.entries(manifest.cases).flatMap(([c, files]) =>
    files.map((f) => write(`/forensic/cases/${c}/${f}`, `/home/pyodide/cases/${c}/${f}`))));
  await py.runPythonAsync(GLUE);
  say('ready', { seconds: Math.round((performance.now() - t0) / 100) / 10 });
}

onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'load') await load();
    else if (msg.type === 'run') {
      const t0 = performance.now();
      const data = JSON.parse(py.globals.get('run_case')(msg.case));
      say('result', { data, seconds: Math.round((performance.now() - t0) / 100) / 10 });
    } else if (msg.type === 'ask') {
      say('answer', { data: JSON.parse(py.globals.get('ask')(String(msg.question).slice(0, 300))) });
    }
  } catch (err) {
    say('error', { text: String(err && err.message ? err.message : err).split('\n').slice(-3).join(' ') });
  }
};
