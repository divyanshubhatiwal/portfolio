---
title: The risk check that never fired
summary: Two of my trading engine's safety gates passed every trade. The bug was two field names; the real lesson was about tests.
date: 2026-10-23
tag: Venture DAO
---

Venture DAO's engine runs every order through a preflight: kill switch, stale data, stop-loss, leverage, fees, exposure, and finally the account's drawdown and daily loss limits. If the account is down 20% from its peak, no new trades. That last pair of checks never fired. Not once.

## How it was found

The checks were being ported to TypeScript for the [risk-gate simulator](/demo/risk-gate) on this site. Porting forces you to read every line as if it were new, and these two didn't add up:

```js
const goal = computeGoalState(config, account)
if (goal.drawdownBreached) return fail('DRAWDOWN', 'Drawdown limit reached.')
if (goal.dayLossBreached) return fail('DAILY_LOSS', 'Daily loss limit reached.')
```

`computeGoalState()` returns `drawdownLimitBreached` and `dailyLossLimitBreached`. The names in preflight don't exist on that object, so both are `undefined`, and `undefined` is falsy. JavaScript didn't complain. Every trade passed both gates.

## Why it didn't cost money

The risk engine that decides whether a trade is worth taking checks the same limits, with the right names, before preflight ever runs. So a drawdown breach was still caught one layer earlier. Preflight was supposed to be the second, independent wall, and it had a hole in exactly the place it mattered most.

## Why the tests didn't catch it

The engine's test file had 37 tests, all passing. None of them put the account in a drawdown. Every test started from a healthy account and broke one other rule: no stop, wrong-side target, too much leverage. The two gates at the bottom were never exercised, so they could be wrong forever.

The fix started with two tests that put the account 25% below its peak, and 4% down on the day. Both failed against the old code, which is the point: a test that has never failed hasn't proven anything. Then the fix itself, two field names. All 263 backend tests pass.

## What I'm taking from it

- **Every gate needs a test that trips it.** Coverage numbers would have looked fine here; a list of "each check has a failing case" would not have.
- **Defence in depth only counts if each layer works alone.** A second wall that silently relies on the first isn't a second wall.
- **Shared field names deserve a type.** In TypeScript, the misspelled field would have been a compile error. The port on this site uses the right names because the compiler insisted.
