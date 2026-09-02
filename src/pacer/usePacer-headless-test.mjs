/**
 * Headless checks for the three pure helpers in the ported src/pacer/usePacer.ts
 * (AD22's queued ninth suite).
 *
 * esbuild-bundles the REAL src/pacer/usePacer.ts and exercises the actual
 * shipped helpers, not a hand-copied restatement. `react` is marked external
 * rather than bundled: the three helpers under test are pure and React-free,
 * and Node resolves `react` from the repo root at import time. The hook itself
 * (usePacer) is deliberately NOT exercised here — it needs a React renderer,
 * requestAnimationFrame and performance.now(), none of which this harness has.
 * Its clock is covered by the on-device acceptance probe instead.
 *
 * Why this suite exists at all: AD22 records that usePacer.ts has NO test
 * coverage in EITHER repo. A sweep of every `entryPoints` across the web
 * repo's twelve suites finds none that bundles it — src/pacer/headless-test.mjs
 * there bundles keyboard.ts, not usePacer.ts. So these helpers ship the port's
 * seek/advance logic with nothing guarding them until now.
 *
 * NOTE ON FORMATTING: The NFD normalization in formatMs() at usePacer.ts:191
 * shares a limitation with the web implementation and is filed as a web-repo
 * issue. Do not mistake this for a port regression.
 *
 * `lastWordlikeUpTo` and `nearestWordlike` are module-private in the web
 * original; the Android port adds the `export` keyword to both so this suite can
 * reach them. That is two of the port's four permitted line changes (AD25) and
 * is additive — it cannot alter behaviour.
 *
 * Documents are built as plain Word[] (bypassing the tokenizer) so each test
 * controls isWordlike precisely; ids are the flat index per word, matching the
 * reindexWords invariant (CLAUDE.md invariant 1).
 */

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const result = await build({
  entryPoints: [path.join(__dirname, 'usePacer.ts')],
  bundle: true,
  write: false,
  format: 'esm',
  target: 'node18',
  platform: 'node',
  external: ['react'],
});

const code = result.outputFiles[0].text;
const tmpPath = path.join(__dirname, `.headless-usepacer-${process.pid}.mjs`);
const { writeFile, unlink } = await import('node:fs/promises');
await writeFile(tmpPath, code);

let firstWordlikeFrom, lastWordlikeUpTo, nearestWordlike;
try {
  ({ firstWordlikeFrom, lastWordlikeUpTo, nearestWordlike } = await import(
    `${tmpPath}?t=${Date.now()}`
  ));
} finally {
  await unlink(tmpPath);
}

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  try {
    assert.deepEqual(actual, expected);
    console.log(`  PASS  ${label}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${label}: ${err.message}`);
    failed++;
  }
}

/** Build a Word[] from [text, isWordlike] pairs, ids = flat index. */
function words(specs) {
  let id = 0;
  return specs.map(([text, isWordlike]) => ({
    id: String(id++),
    text,
    isWordlike,
    spaceBefore: true,
  }));
}

const W = (t) => [t, true];
const P = (t) => [t, false];

console.log('\nusePacer pure helpers — headless checks\n');

// ─── firstWordlikeFrom ───────────────────────────────────────────────────────

{
  const w = words([W('a'), P('—'), W('b')]);
  check('firstWordlikeFrom: lands on a word-like token at `from`', firstWordlikeFrom(w, 0), 0);
  check('firstWordlikeFrom: skips a punctuation run forward', firstWordlikeFrom(w, 1), 2);
  check('firstWordlikeFrom: no word-like at or after `from` -> -1', firstWordlikeFrom(w, 3), -1);
}

{
  // Negative `from` is clamped to 0 by Math.max(0, from) rather than iterating
  // from a negative index (which would read undefined and throw).
  const w = words([W('a'), W('b')]);
  check('firstWordlikeFrom: negative `from` clamps to 0', firstWordlikeFrom(w, -5), 0);
}

{
  const w = words([P('.'), P('—')]);
  check('firstWordlikeFrom: all-punctuation document -> -1', firstWordlikeFrom(w, 0), -1);
  check('firstWordlikeFrom: empty document -> -1', firstWordlikeFrom(words([]), 0), -1);
}

// ─── lastWordlikeUpTo ────────────────────────────────────────────────────────

{
  const w = words([W('a'), P('—'), W('b'), P('!')]);
  check('lastWordlikeUpTo: lands on a word-like token at `from`', lastWordlikeUpTo(w, 2), 2);
  check('lastWordlikeUpTo: skips a punctuation run backward', lastWordlikeUpTo(w, 3), 2);
  check('lastWordlikeUpTo: from index 1 finds the earlier word', lastWordlikeUpTo(w, 1), 0);
  // `from` past the end is clamped to words.length - 1, not left out of range.
  check('lastWordlikeUpTo: `from` past the end clamps to last index', lastWordlikeUpTo(w, 99), 2);
}

{
  const w = words([P('('), W('a')]);
  check('lastWordlikeUpTo: no word-like at or before `from` -> -1', lastWordlikeUpTo(w, 0), -1);
  check('lastWordlikeUpTo: empty document -> -1', lastWordlikeUpTo(words([]), 0), -1);
}

// ─── nearestWordlike ─────────────────────────────────────────────────────────
// The snap used by seek(). Order of preference: the target itself, then the
// nearest word-like FORWARD, then — only if forward finds nothing — BACKWARD.

{
  const w = words([W('a'), P('—'), W('b')]);
  check('nearestWordlike: target already word-like is returned unchanged', nearestWordlike(w, 2), 2);
  check('nearestWordlike: punctuation target snaps FORWARD first', nearestWordlike(w, 1), 2);
}

{
  // THE BACKWARD FALLBACK (web line 42). Target 2 is punctuation and there is
  // no word-like token at or after it, so the forward search returns -1 and the
  // helper must fall back to lastWordlikeUpTo -> index 0. Without the fallback
  // seek() would return -1 here and refuse to move at all.
  const w = words([W('a'), P('—'), P('!')]);
  check('nearestWordlike: BACKWARD fallback when nothing word-like at/after target',
    nearestWordlike(w, 2), 0);
  check('nearestWordlike: backward fallback also fires for a mid-run target',
    nearestWordlike(w, 1), 0);
}

{
  // Out-of-range targets are clamped BEFORE the search, so a target past the
  // end still resolves rather than reading undefined.
  const w = words([W('a'), P('—'), P('!')]);
  check('nearestWordlike: target past the end clamps, then falls back backward',
    nearestWordlike(w, 999), 0);
  const w2 = words([P('('), W('a')]);
  check('nearestWordlike: negative target clamps to 0, then snaps forward',
    nearestWordlike(w2, -7), 1);
}

{
  check('nearestWordlike: empty document -> -1', nearestWordlike(words([]), 0), -1);
  check('nearestWordlike: all-punctuation document -> -1 (both searches fail)',
    nearestWordlike(words([P('.'), P('—')]), 1), -1);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
