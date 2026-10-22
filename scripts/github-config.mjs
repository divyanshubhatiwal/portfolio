// What scripts/sync-github.mjs collects from the public GitHub repos. Edit this, then run
//   node scripts/sync-github.mjs
// and commit src/data/github.json. Everything links to an exact commit, so the site never
// shows code that has since changed without saying which version it is.

export const OWNER = 'divyanshubhatiwal';

/** Portfolio project name -> public repo. Projects not listed have no public code. */
export const REPOS = {
  'Venture DAO': 'venture-dao',
  'Friends Talk': 'friends-talk',
  'RideCompare': 'ridecompare',
  'T20 Score Predictor': 't20-score-predictor',
  'This portfolio': 'portfolio',
};

/**
 * How each skill is proven in code. A repo counts as evidence when any rule matches:
 *   deps  - a dependency name in package.json / requirements.txt / pubspec.yaml (regex, whole name)
 *   files - a file path in the repo (regex)
 *   grep  - { text, in }: the text appears in a file whose path matches `in` (checked line by line)
 */
export const EVIDENCE = {
  'TypeScript': { deps: /^typescript$/, files: /\.tsx?$/ },
  'Python': { files: /\.py$/ },
  'JavaScript': { files: /\.(m?js|jsx)$/ },
  'SQL': { deps: /^(sqlalchemy|alembic|psycopg2?(-binary)?|pg)$/i, files: /\.sql$|alembic\/versions\// },
  'React': { deps: /^react$/ },
  'React Native / Expo': { deps: /^(expo|react-native)$/ },
  'Tailwind CSS': { deps: /^tailwindcss$/ },
  'Vite': { deps: /^vite$/ },
  'Node.js / Express': { deps: /^express$/ },
  'MongoDB': { deps: /^(mongoose|mongodb)$/ },
  'WebRTC': { grep: { text: 'RTCPeerConnection', in: /^public\/js\/app\.js$/ } },
  'REST APIs': { deps: /^(fastapi|express)$/i },
  'FastAPI': { deps: /^fastapi$/i },
  'PostgreSQL': { deps: /^(psycopg2?(-binary)?|asyncpg|pg)$/i },
  'Redis': { deps: /^(redis|ioredis)$/i },
  'Celery': { deps: /^celery$/i },
  'Docker': { files: /(^|\/)(Dockerfile|docker-compose\.ya?ml)$/ },
  'Jest': { deps: /^jest$/ },
  'Vitest': { deps: /^vitest$/ },
  'Astro': { deps: /^astro$/ },
  'Playwright': { deps: /^@playwright\/test$/ },
  'Flutter': { files: /(^|\/)pubspec\.yaml$/ },
  'Nginx': { files: /nginx[^/]*\.conf$|(^|\/)nginx\// },
  'Scikit-learn': { deps: /^scikit-learn$/i },
  'Pandas': { deps: /^pandas$/i },
  'Streamlit': { deps: /^streamlit$/i },
};

/**
 * Code tours: real excerpts with notes. Each step finds its lines by a start and end marker
 * (the first line containing `from`, through the first later line containing `to`, widened by
 * `before`/`after` lines), so the excerpt stays right if lines above it move.
 */
export const TOURS = [
  {
    slug: 'venture-dao-one-order',
    repo: 'venture-dao',
    title: 'One signal, one order',
    summary: "How Venture DAO's trading engine makes sure a retried or duplicated signal can never open a second position, and refuses trades that can't pay for their own fees.",
    steps: [
      { file: 'backend/trading/botEngine.js', from: 'Identifies one intended trade', to: 'Math.floor(at / bucketMs)', before: 1, after: 1,
        title: 'Every trade gets a name',
        note: 'An intended trade is identified by account, symbol, direction and the minute it happened. A restart, a double-click or two overlapping ticks all produce the same key, so the engine can recognise them as the same trade.' },
      { file: 'backend/trading/botEngine.js', from: 'const key = executionKey({ accountId', to: 'usedKeys.add(key)',
        title: 'Reserve the key before sending',
        note: 'The key is reserved before the order goes out, not after it comes back. If the exchange call fails halfway, the order might already be live, so the key stays used and a retry is suppressed instead of becoming a second position.' },
      { file: 'backend/trading/botEngine.js', from: 'The trade must be able to pay for itself', to: "'EDGE_BELOW_COST'", after: 4,
        title: 'Refuse trades that only pay fees',
        note: 'This check exists because of my own result: 31 winning trades and the account still down 6%. The losses were fees and slippage, not direction, so a trade whose target is worth less than three round trips of costs is blocked.' },
    ],
  },
  {
    slug: 'venture-dao-vault',
    repo: 'venture-dao',
    title: 'Keeping exchange keys safe',
    summary: "Venture DAO stores users' exchange API secrets. This is the code that encrypts them, binds each one to its owner, and keeps them out of logs.",
    steps: [
      { file: 'backend/identity/vault.js', from: 'AES-256-GCM rather than CBC', to: 'fallback key is indistinguishable', after: 1,
        title: 'Why this cipher',
        note: 'GCM authenticates as well as encrypts: a tampered record fails to decrypt instead of quietly returning altered bytes. The IV is random every time and never taken from a caller, because reusing one breaks GCM completely.' },
      { file: 'backend/identity/vault.js', from: '`aad` binds the ciphertext', to: 'return [VERSION', before: 3, after: 1,
        title: 'Bind each secret to its row',
        note: "The additional authenticated data ties a secret to its user and account. Without it, someone with write access could move another user's encrypted key into their own row and it would decrypt fine." },
      { file: 'backend/identity/vault.js', from: 'Throws on a wrong key, a wrong aad', to: ".toString('utf8')",
        title: 'Fail loudly',
        note: 'A failed decryption is deliberately not caught. Turning it into an empty string would let an empty "secret" flow on into a signed request.' },
      { file: 'backend/identity/vault.js', from: 'const EMBEDDED =', to: 'return mixedCase || alphanumeric', after: 1,
        title: 'Keep secrets out of logs',
        note: 'Exchange error messages echo the request, so a key can hide inside an innocent-looking string. Embedded "apiKey=…" pairs are scrubbed, and long high-entropy values are redacted, while error codes like ip_not_whitelisted_for_api_key stay readable.' },
    ],
  },
  {
    slug: 'friends-talk-matching',
    repo: 'friends-talk',
    title: 'Matching that never strands anyone',
    summary: "Friends Talk pairs strangers for a voice chat. The hard part isn't finding the best match; it's never leaving someone staring at a spinner.",
    steps: [
      { file: 'src/matchmaker.js', from: 'Filters loosen the longer someone waits', to: '];', before: 1,
        title: 'Preferences relax over time',
        note: 'On a small server, a strict filter matches nobody, which looks exactly like a broken app. After 12 seconds the gender preference is dropped, after 25 the country filter, and the user is told. Blocks and mode are rules, so they never relax.' },
      { file: 'src/matchmaker.js', from: 'Returns null for a forbidden pairing', to: 'return score;', before: 1, after: 1,
        title: 'Forbidden is not the same as unlikely',
        note: 'null means "never pair these two"; a negative score just means "not ideal". An earlier version treated any negative score as forbidden, so two people who had just talked could never be rematched, even when they were the only two online.' },
      { file: 'src/matchmaker.js', from: 'Re-attempt matching for everyone already waiting', to: 'return pairs;', before: 1, after: 1,
        title: 'A sweep for people whose filters relaxed',
        note: 'Matching normally runs when someone joins. Two people whose filters relax past each other would otherwise wait forever with nobody to trigger a retry, so the server sweeps the queue on a timer.' },
    ],
  },
  {
    slug: 'ridecompare-fan-out',
    repo: 'ridecompare',
    title: 'Asking four providers at once',
    summary: "RideCompare gets fares from four ride-hailing providers per search. This is the endpoint that asks them in parallel, survives the ones that fail, and caches the answer.",
    steps: [
      { file: 'backend/app/api/v1/compare.py', from: 'def _cache_key', to: '    )',
        title: 'A cache key that tolerates GPS jitter',
        note: 'Coordinates are rounded to 4 decimal places, about 11 metres, so two searches from the same spot share a cached answer even when the phone reports slightly different positions.' },
      { file: 'backend/app/api/v1/compare.py', from: 'providers = get_all_providers()', to: 'all_estimates.extend(r)',
        title: 'Fan out, and survive failures',
        note: 'All providers are asked at once with asyncio.gather, so a search takes as long as the slowest provider, not the sum. return_exceptions=True means one provider being down removes its fares instead of failing the whole search. What I would change: failures are skipped silently, and they should be logged and shown as "unavailable".' },
      { file: 'backend/app/api/v1/compare.py', from: 'redis_client.setex(cache_key', to: 'return response',
        title: 'Cache the combined answer',
        note: 'The whole comparison is cached in Redis with a short expiry, because fares change quickly but a user often searches the same trip twice. A cache hit still records the search, so history stays complete.' },
    ],
  },
];
