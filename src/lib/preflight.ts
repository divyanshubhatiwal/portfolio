// A TypeScript port of preflight() and executionKey() from Venture DAO's backend/trading/botEngine.js,
// used by the /demo/risk-gate simulator. Same checks, same order, same codes; the first failure wins.
// Differences from the original: the pipeline-approval check is left out (the visitor plays the
// pipeline), and drawdown / daily loss read computeGoalState()'s real field names
// (drawdownLimitBreached, dailyLossLimitBreached).

export type Side = 'BUY' | 'SELL';
export interface Position { symbol: string; side: 'long' | 'short' }
export interface Order { symbol: string; action: Side; entry: number; stop: number | null; target: number | null; quantity: number }
export interface Limits {
  maxLeverage: number; maxPositionPercent: number; maxOrderNotional: number;
  feeBps: number; slippageBps: number; minRewardToCost: number;
  maxOpenPositions: number; maxTradesPerDay: number; maxDrawdownPercent: number; dailyLossLimitPercent: number;
}
export interface World {
  equity: number; killSwitch: boolean; emergencyStop: boolean; dataAgeMs: number;
  positions: Position[]; tradesToday: number; drawdownFromPeak: number; dayLossPercent: number;
}
export interface Check { code: string; label: string; ok: boolean; detail?: string }

export const MAX_DATA_AGE_MS = 90_000;

export function executionKey(accountId: string, symbol: string, direction: Side, at: number, bucketMs = 60_000): string {
  return `${accountId}:${symbol}:${direction}:${Math.floor(at / bucketMs)}`;
}

/** Every check in the engine's order. Stops at the first failure, as the engine does. */
export function preflight(o: Order, w: World, c: Limits): Check[] {
  const out: Check[] = [];
  const step = (code: string, label: string, failed: false | string): boolean => {
    out.push({ code, label, ok: !failed, detail: failed || undefined });
    return !failed;
  };
  const long = o.action === 'BUY';
  const notional = o.quantity * o.entry;
  const leverage = w.equity > 0 ? notional / w.equity : 0;
  const costBps = (c.feeBps + c.slippageBps) * 2;
  const roundTrip = notional * (costBps / 10_000);
  const reward = o.target == null ? 0 : Math.abs(o.target - o.entry) * o.quantity;
  const onSymbol = w.positions.filter((p) => p.symbol === o.symbol);
  const wanted = long ? 'long' : 'short';
  const opposing = onSymbol.find((p) => p.side !== wanted);

  const checks: [string, string, () => false | string][] = [
    ['KILL_SWITCH', 'Server kill switch off', () => w.killSwitch && 'Server kill switch is engaged.'],
    ['EMERGENCY_STOP', 'No emergency stop', () => w.emergencyStop && 'Emergency stop is active until explicitly cleared.'],
    ['STALE_DATA', 'Market data fresh (≤ 90 s)', () => w.dataAgeMs > MAX_DATA_AGE_MS && `Market data is ${Math.round(w.dataAgeMs / 1000)}s old.`],
    ['NO_STOP', 'Stop-loss present', () => !o.stop && 'A stop is mandatory; refusing an unprotected entry.'],
    ['INVALID_STOP', 'Stop on the right side of entry', () => o.stop != null && (long ? !(o.stop < o.entry) : !(o.stop > o.entry))
      && (long ? 'Long stop must sit below entry.' : 'Short stop must sit above entry.')],
    ['INVALID_TARGET', 'Target on the right side of entry', () => o.target != null && (long ? !(o.target > o.entry) : !(o.target < o.entry))
      && (long ? 'Long target must sit above entry.' : 'Short target must sit below entry.')],
    ['INVALID_QTY', 'Size above zero', () => !(o.quantity > 0) && 'Position size resolved to zero.'],
    ['MAX_LEVERAGE', `Leverage ≤ ${c.maxLeverage}×`, () => leverage > c.maxLeverage + 1e-9 && `Position is ${leverage.toFixed(2)}× equity, limit ${c.maxLeverage}×.`],
    ['MAX_POSITION', `Notional ≤ ${c.maxPositionPercent}% of equity`, () => notional > w.equity * (c.maxPositionPercent / 100) + 1e-9
      && `Notional ${notional.toFixed(2)} exceeds ${c.maxPositionPercent}% of equity.`],
    ['MAX_NOTIONAL', `Notional ≤ ${c.maxOrderNotional}`, () => notional > c.maxOrderNotional && `Notional ${notional.toFixed(2)} exceeds cap ${c.maxOrderNotional}.`],
    ['EDGE_BELOW_COST', `Target pays ≥ ${c.minRewardToCost}× fees + slippage`, () => o.target != null && reward < roundTrip * c.minRewardToCost
      && `Target is worth ${reward.toFixed(2)} against ${roundTrip.toFixed(2)} in fees and slippage (need ${c.minRewardToCost}×).`],
    ['SYMBOL_EXPOSURE', 'No open position on this symbol', () => onSymbol.length > 0 && (opposing
      ? `Already ${opposing.side} ${o.symbol}; refusing to hedge against it.`
      : `Already holding ${o.symbol}; not adding to an open position.`)],
    ['MAX_POSITIONS', `Open positions < ${c.maxOpenPositions}`, () => w.positions.length >= c.maxOpenPositions && `${w.positions.length} open, limit ${c.maxOpenPositions}.`],
    ['MAX_TRADES', `Trades today < ${c.maxTradesPerDay}`, () => w.tradesToday >= c.maxTradesPerDay && `${w.tradesToday} today, limit ${c.maxTradesPerDay}.`],
    ['DRAWDOWN', `Drawdown from peak < ${c.maxDrawdownPercent}%`, () => w.drawdownFromPeak >= c.maxDrawdownPercent && 'Drawdown limit reached.'],
    ['DAILY_LOSS', `Day loss < ${c.dailyLossLimitPercent}%`, () => w.dayLossPercent >= c.dailyLossLimitPercent && 'Daily loss limit reached.'],
  ];
  for (const [code, label, test] of checks) if (!step(code, label, test())) break;
  return out;
}
