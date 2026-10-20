// /demo/risk-gate: drives the ported preflight() the way Venture DAO's engine loop does:
// SIGNAL_DETECTED -> RISK_CHECK -> (RISK_BLOCKED | duplicate check -> ORDER_APPROVED -> ORDER_SUBMITTED -> POSITION_OPEN | RECONCILING)
import { $, esc } from './dom';
import { executionKey, preflight, type Limits, type Order, type Position, type Side, type World } from '@/lib/preflight';

const LIMITS: Limits = {
  maxLeverage: 3, maxPositionPercent: 50, maxOrderNotional: 1000, feeBps: 5, slippageBps: 2, minRewardToCost: 3,
  maxOpenPositions: 2, maxTradesPerDay: 6, maxDrawdownPercent: 5, dailyLossLimitPercent: 2,
};

const inp = (id: string) => $<HTMLInputElement>(`#rg-${id}`);
const sel = (id: string) => $<HTMLSelectElement>(`#rg-${id}`);
const num = (id: string): number | null => { const v = inp(id)?.value.trim(); return v ? Number(v) : null; };

let clock = Date.UTC(2026, 9, 20, 9, 0, 0); // simulated time; "Wait 1 minute" moves it on
let positions: Position[] = [];
let tradesToday = 0;
let usedKeys = new Set<string>();
let lastOrder: Order | null = null;

function readOrder(): Order {
  return {
    symbol: sel('symbol')?.value ?? 'ETH', action: (sel('side')?.value ?? 'BUY') as Side,
    entry: num('entry') ?? 0, stop: num('stop'), target: num('target'), quantity: num('qty') ?? 0,
  };
}
function readWorld(): World {
  return {
    equity: num('equity') ?? 0, killSwitch: !!inp('kill')?.checked, emergencyStop: false,
    dataAgeMs: (num('age') ?? 0) * 1000, positions, tradesToday,
    drawdownFromPeak: num('dd') ?? 0, dayLossPercent: num('dl') ?? 0,
  };
}

const time = () => new Date(clock).toISOString().slice(11, 19);
function journal(kind: string, text: string): void {
  const li = document.createElement('li');
  li.className = kind;
  li.innerHTML = `<time>${time()}</time> ${text}`;
  $('#rg-journal')?.prepend(li);
}
function states(list: string[], bad = false): void {
  const el = $('#rg-states');
  if (el) el.innerHTML = list.map((s, i) => `<span class="${i === list.length - 1 ? (bad ? 'end bad' : 'end') : ''}">${s}</span>`).join('');
}
function verdict(text: string, ok: boolean): void {
  const el = $('#rg-verdict');
  if (el) { el.textContent = text; el.className = `sim-verdict ${ok ? 'ok' : 'bad'}`; }
}
function showPositions(): void {
  const el = $('#rg-positions');
  if (el) el.textContent = positions.length ? positions.map((p) => `${p.side} ${p.symbol}`).join(', ') : 'None';
}

function run(order: Order): void {
  lastOrder = order;
  const checks = preflight(order, readWorld(), LIMITS);
  const list = $('#rg-checks');
  if (list) {
    list.innerHTML = checks.map((c) =>
      `<li class="${c.ok ? 'pass' : 'fail'}"><code>${c.code}</code> ${esc(c.label)}${c.detail ? `<small>${esc(c.detail)}</small>` : ''}</li>`).join('');
  }
  const failed = checks.find((c) => !c.ok);
  const label = `${order.action === 'BUY' ? 'long' : 'short'} ${order.quantity} ${esc(order.symbol)}`;
  if (failed) {
    states(['SIGNAL_DETECTED', 'RISK_CHECK', 'RISK_BLOCKED'], true);
    verdict(`blocked: ${failed.code}`, false);
    journal('blocked', `blocked ${label}: <code>${failed.code}</code>`);
    return;
  }
  const key = executionKey('demo', order.symbol, order.action, clock);
  if (usedKeys.has(key)) {
    states(['SIGNAL_DETECTED', 'RISK_CHECK'], true); // the engine logs it and moves on without a new state
    verdict('duplicate suppressed', false);
    journal('dup', `duplicate suppressed: key <code>${esc(key)}</code> already used`);
    return;
  }
  usedKeys.add(key); // reserved before submitting: a failure mid-flight must not free it
  if (inp('venue')?.checked) {
    states(['SIGNAL_DETECTED', 'RISK_CHECK', 'ORDER_APPROVED', 'ORDER_SUBMITTED', 'RECONCILING'], true);
    verdict('exchange timed out', false);
    journal('error', `exchange timed out on ${label}; key <code>${esc(key)}</code> stays reserved, reconciling`);
    const venue = inp('venue');
    if (venue) venue.checked = false; // only the next order times out
    return;
  }
  positions = [...positions, { symbol: order.symbol, side: order.action === 'BUY' ? 'long' : 'short' }];
  tradesToday += 1;
  states(['SIGNAL_DETECTED', 'RISK_CHECK', 'ORDER_APPROVED', 'ORDER_SUBMITTED', 'POSITION_OPEN']);
  verdict('order placed', true);
  journal('order', `opened ${label}, key <code>${esc(key)}</code>`);
  showPositions();
}

function reset(): void {
  positions = []; tradesToday = 0; usedKeys = new Set(); lastOrder = null;
  const j = $('#rg-journal'); if (j) j.innerHTML = '';
  const c = $('#rg-checks'); if (c) c.innerHTML = '<li class="idle">Submit an order to run the checks.</li>';
  const v = $('#rg-verdict'); if (v) { v.textContent = ''; v.className = 'sim-verdict'; }
  states([]); showPositions();
}

function outputs(): void {
  const set = (id: string, v: string) => { const el = $(`#rg-${id}-v`); if (el) el.textContent = v; };
  set('age', `${num('age') ?? 0} s`);
  set('dd', `${num('dd') ?? 0}%`);
  set('dl', `${num('dl') ?? 0}%`);
}

if ($('#rg')) {
  $('#rg-submit')?.addEventListener('click', () => run(readOrder()));
  $('#rg-retry')?.addEventListener('click', () => run(lastOrder ?? readOrder()));
  $('#rg-wait')?.addEventListener('click', () => { clock += 60_000; journal('info', 'one minute later'); });
  $('#rg-reset')?.addEventListener('click', reset);
  for (const id of ['age', 'dd', 'dl']) inp(id)?.addEventListener('input', outputs);
  outputs();
}
