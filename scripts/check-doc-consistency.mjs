/**
 * The doc-consistency check (AD46).
 *
 * NOT a test suite. Like `scripts/check-core-baseline.mjs` it executes nothing
 * and asserts nothing about behaviour, so the repo's tally is "16 suites plus
 * 2 static checks" and a static check is never folded into the suite number
 * (AD31, AD46).
 *
 * WHAT IT IS FOR. AF54 measured the same failure four times across four pull
 * requests: a count moved, a sweep chased only the axis that had just changed,
 * and some other document was left stating a figure no suite had produced for
 * a milestone. Worse, a comment forbidding a suite count INVERTED — it ended up
 * instructing a future reader to state the wrong number — and nothing could
 * catch it, because no check reads prose. AD43 then required that a deferral
 * name a checkable trigger, and named this check as the follow-up. This is it.
 *
 * GROUND TRUTH, PER AXIS. Nothing here stores an expected number; every figure
 * is derived, and the documents are compared against the derivation:
 *
 *   - SUITE COUNTS come from parsing the `.mjs` paths out of package.json's
 *     `test:core` and `test:local` scripts. That is the list npm actually runs.
 *   - AD / AF MAXIMA come from ENTRY-HEADING lines only, never from a mention
 *     in body text -- the logs cite their own entry numbers constantly, so any
 *     looser pattern would measure the prose rather than the entries. The
 *     entries are also asserted contiguous from 1, with no gaps or duplicates.
 *   - THE TRACKED .mjs COUNT comes from `git ls-files --cached --others
 *     --exclude-standard`, which is both staging-independent (a file added in
 *     this pull request counts before it is staged) and gitignore-aware.
 *     A filesystem walk would be flaky: .gitignore:40 ignores the
 *     `.headless-*.mjs` bundles a suite writes beside its subject while it
 *     runs, and a walk during a suite run would count one (AF56).
 *
 * PER-CHECK TOTALS ARE NOT DERIVED, AND THAT IS DELIBERATE. The only ground
 * truth for "578 checks" is running the suites, and running them from here
 * would roughly double the behavioural step of every `npm run check` -- the
 * suites take 1.57 s measured (AF56). So instead the totals are held to
 * AGREEMENT and to ARITHMETIC, which needs no run:
 *
 *   - every document must state the same headline total and the same subtotals;
 *   - each subtotal's parenthesised breakdown must SUM to it;
 *   - the number of addends must equal the suite count derived from
 *     package.json -- which is what ties the prose to something real;
 *   - core + local must equal the headline.
 *
 * That would have caught AF54's actual defect, where README said 271 while
 * ARCHITECTURE said 286: they disagreed with each other. What it cannot catch
 * is every document agreeing on a wrong figure whose addends still sum -- and
 * the very next thing `npm run check` does is run the suites, which shows it.
 *
 * IT FAILS CLOSED. A claim it cannot find is an error, not a silent pass, so
 * deleting a sentence cannot quietly disable the check. If you reword one of
 * the lines below, this file is part of the same change.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let problems = 0;
const fail = (msg) => {
  console.error(`  MISMATCH  ${msg}`);
  problems += 1;
};

const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * Pull every occurrence of a claim out of a document.
 * Fails closed when a pattern matches nothing.
 */
function claims(file, label, re) {
  const text = read(file);
  const found = [...text.matchAll(re)];
  if (found.length === 0) {
    fail(`${file}: no "${label}" claim found — the wording changed, so update this check in the same change`);
    return [];
  }
  return found.map((m) => ({ file, label, groups: m.slice(1) }));
}

function expect(list, index, want, what) {
  for (const c of list) {
    const got = Number(c.groups[index]);
    if (got !== want) fail(`${c.file}: ${what} — states ${got}, derived ${want} (${c.label})`);
  }
}

// ── Derived: the suite lists npm actually runs ───────────────────────────────
const pkg = JSON.parse(read('package.json'));
const suiteFiles = (script) => (String(pkg.scripts[script] ?? '').match(/[A-Za-z0-9_./-]+\.mjs/g) ?? []);
const coreSuites = suiteFiles('test:core');
const localSuites = suiteFiles('test:local');
const totalSuites = coreSuites.length + localSuites.length;

for (const f of [...coreSuites, ...localSuites]) {
  try {
    readFileSync(path.join(ROOT, f));
  } catch {
    fail(`package.json names a suite that does not exist: ${f}`);
  }
}

// ── Derived: AD / AF entry headings ──────────────────────────────────────────
const ENTRY_HEADING = /^- \*\*(AD|AF)(\d+)(?:\*\*)?(?=[ ·])/gm;

function entryNumbers(file, prefix) {
  const nums = [...read(file).matchAll(ENTRY_HEADING)]
    .filter((m) => m[1] === prefix)
    .map((m) => Number(m[2]))
    .sort((a, b) => a - b);
  if (nums.length === 0) {
    fail(`${file}: no ${prefix} entry headings matched — the heading form changed`);
    return 0;
  }
  const max = nums[nums.length - 1];
  for (let i = 1; i < nums.length; i += 1) {
    if (nums[i] === nums[i - 1]) fail(`${file}: ${prefix}${nums[i]} appears twice as an entry heading`);
  }
  for (let want = 1; want <= max; want += 1) {
    if (!nums.includes(want)) fail(`${file}: ${prefix}${want} is missing — entries must be contiguous from 1`);
  }
  return max;
}

const maxAD = entryNumbers('DECISIONS.md', 'AD');
const maxAF = entryNumbers('FINDINGS.md', 'AF');

// ── Derived: tracked + untracked, gitignore-aware, .mjs files ────────────────
let trackedMjs = 0;
try {
  trackedMjs = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((l) => l.trim() !== '').length;
} catch {
  fail('could not list .mjs files with git — is this a git checkout?');
}

// ── Claimed: suite counts ────────────────────────────────────────────────────
const suiteTotalClaims = [
  ...claims('README.md', 'README headline', /\*\*(\d+) headless suites — (\d+) checks\*\*/g),
  ...claims('README.md', 'README Jest note', /already (\d+) suites and (\d+) checks/g),
  ...claims('ARCHITECTURE.md', 'ARCHITECTURE headline', /\*\*(\d+) headless\s+suites\s+totalling (\d+) checks\*\*/g),
  ...claims('ARCHITECTURE.md', 'ARCHITECTURE check comment', /(\d+) suites \/ (\d+) checks/g),
];
expect(suiteTotalClaims, 0, totalSuites, 'total suite count');

const reportingForm = [
  ...claims('ARCHITECTURE.md', 'ARCHITECTURE reporting form', /"(\d+) suites plus 2 static checks"/g),
  ...claims('CORE-DIVERGENCE.md', 'CORE-DIVERGENCE tally', /\*\*(\d+) suites plus 2\nstatic checks\*\*/g),
  ...claims('CORE-DIVERGENCE.md', 'CORE-DIVERGENCE command comment', /then all (\d+) suites/g),
  ...claims('ARCHITECTURE.md', 'ARCHITECTURE mjs sentence', /so the (\d+) suites, the/g),
];
expect(reportingForm, 0, totalSuites, 'total suite count');

// ── Claimed: subtotals, with their breakdowns ────────────────────────────────
const subtotalClaims = [
  { file: 'README.md', label: 'README test:core', re: /`npm run test:core` \((\d+) suites, (\d+) checks\)/g, suites: coreSuites.length },
  { file: 'README.md', label: 'README test:local', re: /`npm run test:local` \((\d+) suites, (\d+) checks\)/g, suites: localSuites.length },
];
const subtotalChecks = new Map();
for (const { file, label, re, suites } of subtotalClaims) {
  for (const c of claims(file, label, re)) {
    if (Number(c.groups[0]) !== suites) {
      fail(`${file}: ${label} — states ${c.groups[0]} suites, derived ${suites}`);
    }
    subtotalChecks.set(label.endsWith('core') ? 'core' : 'local', Number(c.groups[1]));
  }
}

// ARCHITECTURE's table carries the breakdown, which is the strongest claim here.
const tableRows = [
  { key: 'core', label: 'ARCHITECTURE table test:core', re: /\| `test:core`[^|]*\| (\d+) \| (\d+) \(([\d +]+)\) \|/g, suites: coreSuites.length },
  { key: 'local', label: 'ARCHITECTURE table test:local', re: /\| `test:local`[^|]*\| (\d+) \| (\d+) \(([\d +]+)\) \|/g, suites: localSuites.length },
];
const tableChecks = new Map();
for (const { key, label, re, suites } of tableRows) {
  for (const c of claims('ARCHITECTURE.md', label, re)) {
    const [statedSuites, statedChecks, breakdown] = c.groups;
    if (Number(statedSuites) !== suites) {
      fail(`ARCHITECTURE.md: ${label} — states ${statedSuites} suites, derived ${suites}`);
    }
    const addends = breakdown.split('+').map((n) => Number(n.trim()));
    const sum = addends.reduce((a, b) => a + b, 0);
    if (sum !== Number(statedChecks)) {
      fail(`ARCHITECTURE.md: ${label} — breakdown sums to ${sum} but the subtotal says ${statedChecks}`);
    }
    if (addends.length !== suites) {
      fail(`ARCHITECTURE.md: ${label} — ${addends.length} addends for ${suites} suites; one suite has no figure`);
    }
    tableChecks.set(key, Number(statedChecks));
  }
}

// Subtotals must agree wherever they are stated, and must close on the headline.
for (const key of ['core', 'local']) {
  const a = subtotalChecks.get(key);
  const b = tableChecks.get(key);
  if (a !== undefined && b !== undefined && a !== b) {
    fail(`README.md says ${a} checks for test:${key}, ARCHITECTURE.md says ${b}`);
  }
}
const headlineTotals = new Set(suiteTotalClaims.map((c) => Number(c.groups[1])));
if (headlineTotals.size > 1) {
  fail(`the headline check total is stated inconsistently: ${[...headlineTotals].join(' vs ')}`);
}
const headline = [...headlineTotals][0];
const core = tableChecks.get('core');
const local = tableChecks.get('local');
if (headline !== undefined && core !== undefined && local !== undefined && core + local !== headline) {
  fail(`${core} + ${local} = ${core + local}, but the headline total says ${headline}`);
}

// §7.1's denominator is the same headline total.
for (const c of claims('ARCHITECTURE.md', 'ARCHITECTURE §7.1 denominator', /of the (\d+) checks\) bundle modules/g)) {
  if (headline !== undefined && Number(c.groups[0]) !== headline) {
    fail(`ARCHITECTURE.md: §7.1 denominator states ${c.groups[0]}, headline total is ${headline}`);
  }
}

// ── Claimed: AD / AF ranges and the tracked .mjs count ───────────────────────
expect(claims('README.md', 'README AD range', /`AD1`–`AD(\d+)`/g), 0, maxAD, 'AD range');
expect(claims('README.md', 'README AF range', /`AF1`–`AF(\d+)`/g), 0, maxAF, 'AF range');
expect(claims('ARCHITECTURE.md', 'ARCHITECTURE tracked .mjs', /sees the (\d+) tracked `\.mjs` files/g), 0, trackedMjs, 'tracked .mjs count');

// ── Report ──────────────────────────────────────────────────────────────────
console.log(
  `  ${totalSuites} suites (${coreSuites.length} core + ${localSuites.length} local), ` +
    `${headline ?? '?'} checks, AD1-AD${maxAD}, AF1-AF${maxAF}, ${trackedMjs} tracked .mjs, ` +
    `${problems} mismatches`,
);
process.exit(problems === 0 ? 0 : 1);
