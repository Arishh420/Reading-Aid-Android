/**
 * The core-fork baseline check (AD31).
 *
 * NOT a test suite. The thirteen `*-headless-test.mjs` suites esbuild-bundle
 * real source and assert what it computes; this executes nothing and asserts
 * nothing about behaviour. It is a static check of the same kind as `tsc`, and
 * it is reported separately for that reason — "13 suites plus 1 baseline
 * check", never "14 suites".
 *
 * WHAT IT IS FOR. AD31 settles `D-D` by forking `src/core/`: byte-identity to
 * the web repo is abandoned, and byte-identity to a RECORDED BASELINE is
 * enforced instead. This is the enforcement. Without it, CORE-DIVERGENCE.md is
 * documentation nobody checks — which is exactly what the web repo's
 * PORT-PLAN.md §5.1 diagnoses in F-PRESETS-5, where two copies "were diffed by
 * eye" with "no automated guard against the inline copy drifting". A manifest
 * and its check are one thing, not two.
 *
 * WHAT IT CHECKS.
 *
 *   1. Every manifest row's file hashes to that row's `Current sha256`.
 *   2. The manifest is SELF-CONSISTENT: baseline == current implies
 *      `Diverged?` is `n`; baseline != current implies `y` AND a non-empty
 *      `Record` pointing at the AD/AF entry that says why.
 *   3. COMPLETENESS for `src/core/`: every file on disk under that directory
 *      appears in the manifest. This closes PORT-PLAN §5.2 option (c)'s named
 *      weakness — "it only guards files on the manifest, so a new pure module
 *      added here is invisible to it until someone remembers to add it" — for
 *      the core directory. Outside `src/core/` the manifest is opt-in, and
 *      AD31 records that residue rather than hiding it.
 *
 * A mismatch is NOT a failure of the code. Under a fork, divergence is
 * expected; the check exists to make it VISIBLE and to force the manifest row
 * and the file edit into the same PR. The fix for a red run is almost always
 * "write the row", not "revert the edit".
 *
 * No network, no web checkout, no esbuild, no dependencies — `node:` builtins
 * only. The hashes live in CORE-DIVERGENCE.md and are deliberately NOT
 * duplicated here: a second copy is a second copy that will eventually
 * disagree with the first (AD2, AF8, AD18).
 */

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const manifestRel = 'CORE-DIVERGENCE.md';
const coreRel = 'src/core';

const BEGIN = '<!-- BEGIN MANIFEST -->';
const END = '<!-- END MANIFEST -->';

let failed = 0;
const fail = (msg) => {
  console.log(`  FAIL  ${msg}`);
  failed++;
};

/**
 * Parse the manifest table.
 *
 * Fenced by HTML comments rather than located by heading text, so renaming a
 * heading cannot silently empty the check. A zero-row parse is a hard error for
 * the same reason: a check that passes on an unparseable manifest is worse than
 * no check at all.
 */
function parseManifest(md) {
  const begin = md.indexOf(BEGIN);
  const end = md.indexOf(END);
  if (begin < 0 || end < 0 || end < begin) {
    console.error(
      `\n  ${manifestRel}: the manifest fence is missing or malformed.\n` +
        `  Expected "${BEGIN}" ... "${END}".`,
    );
    process.exit(1);
  }

  const strip = (s) => s.replace(/^`/, '').replace(/`$/, '').trim();
  const rows = [];

  for (const line of md.slice(begin + BEGIN.length, end).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length !== 7) continue;
    if (cells[0] === '#' || /^:?-+:?$/.test(cells[0])) continue;
    rows.push({
      n: cells[0],
      file: strip(cells[1]),
      origin: cells[2],
      baseline: strip(cells[3]),
      current: strip(cells[4]),
      diverged: cells[5].toLowerCase(),
      record: cells[6],
    });
  }

  if (rows.length === 0) {
    console.error(`\n  ${manifestRel}: the manifest fence parsed ZERO rows.`);
    process.exit(1);
  }
  return rows;
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const rows = parseManifest(await readFile(path.join(repoRoot, manifestRel), 'utf8'));
const listed = new Set();

for (const row of rows) {
  if (listed.has(row.file)) fail(`${row.file}: listed more than once in the manifest`);
  listed.add(row.file);

  if (!/^[0-9a-f]{64}$/.test(row.baseline)) {
    fail(`${row.file}: "Baseline sha256" is not a sha256 (got "${row.baseline}")`);
    continue;
  }
  if (!/^[0-9a-f]{64}$/.test(row.current)) {
    fail(`${row.file}: "Current sha256" is not a sha256 (got "${row.current}")`);
    continue;
  }

  let bytes;
  try {
    bytes = await readFile(path.join(repoRoot, row.file));
  } catch {
    fail(`${row.file}: listed in the manifest but not on disk`);
    continue;
  }

  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== row.current) {
    fail(
      `${row.file}: on-disk content does not match the manifest\n` +
        `          manifest "Current sha256": ${row.current}\n` +
        `          actual sha256 on disk:     ${actual}\n` +
        `          -> update this row in ${manifestRel} IN THE SAME PR, and point\n` +
        `             "Record" at the AD/AF entry that says why it changed (AD31).`,
    );
  }

  const unchanged = row.baseline === row.current;
  if (unchanged && row.diverged !== 'n') {
    fail(`${row.file}: hashes equal the baseline but "Diverged?" reads "${row.diverged}"`);
  }
  if (!unchanged && row.diverged !== 'y') {
    fail(`${row.file}: hash differs from the baseline but "Diverged?" reads "${row.diverged}"`);
  }
  if (!unchanged && (row.record === '' || row.record === '—' || row.record === '-')) {
    fail(`${row.file}: diverged from the baseline with no AD/AF entry in "Record"`);
  }
}

// Completeness, for src/core/ only. See the docblock.
const coreFiles = await walk(path.join(repoRoot, coreRel));
for (const abs of coreFiles) {
  const rel = path.relative(repoRoot, abs).split(path.sep).join('/');
  if (!listed.has(rel)) {
    fail(
      `${rel}: exists under ${coreRel}/ but is NOT in the manifest\n` +
        `          -> add a row to ${manifestRel} (AD31: every core file is listed).`,
    );
  }
}

console.log(
  `  ${rows.length} files checked, ${coreFiles.length} under ${coreRel}/, ` +
    `${failed} mismatch${failed === 1 ? '' : 'es'}`,
);
if (failed > 0) process.exit(1);
