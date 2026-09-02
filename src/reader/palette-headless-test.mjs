/**
 * Headless checks for the reader palette's heading scale (the thirteenth suite).
 *
 * esbuild-bundles the REAL src/reader/palette.ts. It imports nothing at all, so
 * this suite needs no React Native, Reanimated or DOM stub.
 *
 * WHY THIS SUITE EXISTS. It covers the exact regression AD26 recorded as
 * shipping and AD29 fixes: the heading size table was the browser UA scale
 * multiplied by WEB'S 18px base, while `bodyFontSize` here is 19. Nothing
 * connected the two, so when the base moved the table did not, and h4 came out
 * at 18 — SMALLER than body text — with h5 (15) and h6 (12) smaller still. At
 * `headingWeight` 400 those levels had no weight advantage either, so an h4 was
 * indistinguishable from a paragraph.
 *
 * That failure is silent in every way that matters. It throws nothing, it
 * renders a plausible-looking document, and the seeded sample uses only `#` and
 * `##` (sample.ts:2 and :8) — so the MVP's own default document does not exhibit
 * it and no amount of running the app would surface it. It took reading the
 * arithmetic to find, which is precisely the kind of thing a check should hold.
 *
 * Two invariants are asserted, at the shipped base and across a swept range:
 *
 *   1. STRICTLY DECREASING — h1 > h2 > ... > h6.
 *   2. EVERY LEVEL STRICTLY ABOVE `bodyFontSize`.
 *
 * And the historical failure is re-enacted rather than described: a PINNED
 * snapshot of today's table is checked against a RAISED body size, and must
 * fail. If that assertion ever passes, the pinning has stopped being detectable.
 */

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const result = await build({
  stdin: {
    contents: `
      export { LAYOUT, LIGHT, HIGHLIGHT_BG, HEADING_SIZE_RATIO, headingFontSizes } from './palette';
    `,
    resolveDir: __dirname,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  target: 'node18',
  platform: 'node',
});

const tmpPath = path.join(__dirname, `.headless-palette-${process.pid}.mjs`);
const { writeFile, unlink } = await import('node:fs/promises');
await writeFile(tmpPath, result.outputFiles[0].text);

let LAYOUT, LIGHT, HIGHLIGHT_BG, HEADING_SIZE_RATIO, headingFontSizes;
try {
  ({ LAYOUT, LIGHT, HIGHLIGHT_BG, HEADING_SIZE_RATIO, headingFontSizes } = await import(
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

function ok(label, cond, msg) {
  try {
    assert.ok(cond, msg);
    console.log(`  PASS  ${label}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${label}: ${err.message}`);
    failed++;
  }
}

const LEVELS = [1, 2, 3, 4, 5, 6];

/** The size table as a plain array, h1 first. */
const asArray = (table) => LEVELS.map((level) => table[level]);

/** Invariant 1. */
function strictlyDecreasing(table) {
  const a = asArray(table);
  return a.every((v, i) => i === 0 || a[i - 1] > v);
}

/** Invariant 2. */
function allAboveBody(table, bodyFontSize) {
  return asArray(table).every((v) => v > bodyFontSize);
}

console.log('\npalette heading scale — headless checks\n');

// ─── 1. The shipped table ───────────────────────────────────────────────────

{
  const shipped = LAYOUT.headingFontSize;

  check(
    'shipped body size is 19 (AF39: the (d) ruling is ship-as-is)',
    LAYOUT.bodyFontSize,
    19,
  );

  check('shipped heading table is 36/27/24/23/22/21', asArray(shipped), [36, 27, 24, 23, 22, 21]);

  check(
    'h1 and h2 are unchanged from what shipped and was judged on-device',
    [shipped[1], shipped[2]],
    [36, 27],
  );

  ok(
    'INVARIANT 1: the shipped table is strictly decreasing',
    strictlyDecreasing(shipped),
    `got ${asArray(shipped).join(',')}`,
  );

  ok(
    'INVARIANT 2: every shipped level is strictly above body text',
    allAboveBody(shipped, LAYOUT.bodyFontSize),
    `body ${LAYOUT.bodyFontSize}, table ${asArray(shipped).join(',')}`,
  );

  ok(
    'the table covers exactly levels 1-6, the range prepareDocument clamps to',
    Object.keys(shipped).length === 6 && LEVELS.every((l) => typeof shipped[l] === 'number'),
    `keys ${Object.keys(shipped).join(',')}`,
  );

  ok(
    'every shipped level is a whole number of pixels',
    asArray(shipped).every((v) => Number.isInteger(v)),
    `got ${asArray(shipped).join(',')}`,
  );
}

// ─── 2. The table is DERIVED, not pinned ────────────────────────────────────
//
// This is the check that would have caught AD26's defect at the moment it was
// introduced: a literal table and a body size that disagree.

{
  check(
    'the shipped table IS the derivation of the shipped body size (not a literal)',
    LAYOUT.headingFontSize,
    headingFontSizes(LAYOUT.bodyFontSize),
  );
}

// ─── 3. The historical failure, re-enacted ──────────────────────────────────
//
// AD26's defect, verbatim: the browser UA scale (2 / 1.5 / 1.17 / 1 / 0.83 /
// 0.67 em) against WEB's 18px base, judged against THIS repo's body of 19.

{
  const UA_ON_WEBS_18 = { 1: 36, 2: 27, 3: 21, 4: 18, 5: 15, 6: 12 };

  ok(
    "AD26's defect is DETECTED: the UA-on-18 table fails invariant 2 at a body of 19",
    !allAboveBody(UA_ON_WEBS_18, 19),
    'the historical defect table passed — this suite would not have caught it',
  );

  check(
    'AD26 named the right levels: h4/h5/h6 were the ones at or below body 19',
    LEVELS.filter((l) => UA_ON_WEBS_18[l] <= 19),
    [4, 5, 6],
  );

  ok(
    'and the UA-on-18 table is not what ships any more',
    asArray(LAYOUT.headingFontSize).join(',') !== asArray(UA_ON_WEBS_18).join(','),
    'the defect table is still shipping',
  );
}

// ─── 4. Raising bodyFontSize without touching the scale ─────────────────────
//
// The exact historical failure mode, as a live check rather than a description.
// PINNED is a snapshot of today's shipped table. Raise the base underneath it
// and it must FAIL — that is what makes the pinning detectable at all. The
// derivation, given the same raised base, must still hold both invariants.

{
  const PINNED = { ...LAYOUT.headingFontSize };
  const RAISED = LAYOUT.bodyFontSize + 3; // 19 -> 22, past PINNED's h6 of 21

  ok(
    'a PINNED table fails invariant 2 once the body size is raised under it',
    !allAboveBody(PINNED, RAISED),
    `pinned ${asArray(PINNED).join(',')} still cleared a body of ${RAISED} — the pinning is undetectable`,
  );

  check(
    'and it is the deep levels that break first, exactly as in AD26',
    LEVELS.filter((l) => PINNED[l] <= RAISED),
    [5, 6],
  );

  const derived = headingFontSizes(RAISED);
  ok(
    'the DERIVATION survives the same raise: strictly decreasing',
    strictlyDecreasing(derived),
    `got ${asArray(derived).join(',')}`,
  );
  ok(
    'the DERIVATION survives the same raise: every level above body',
    allAboveBody(derived, RAISED),
    `body ${RAISED}, table ${asArray(derived).join(',')}`,
  );
}

// ─── 5. Both invariants across a swept range of body sizes ──────────────────

{
  const bases = [];
  for (let b = 8; b <= 60; b++) bases.push(b);

  const decFails = bases.filter((b) => !strictlyDecreasing(headingFontSizes(b)));
  const aboveFails = bases.filter((b) => !allAboveBody(headingFontSizes(b), b));

  ok(
    `INVARIANT 1 holds at every body size 8-60 (${bases.length} bases)`,
    decFails.length === 0,
    `failed at bases ${decFails.join(',')}`,
  );

  ok(
    `INVARIANT 2 holds at every body size 8-60 (${bases.length} bases)`,
    aboveFails.length === 0,
    `failed at bases ${aboveFails.join(',')}`,
  );

  ok(
    'every derived size at every swept base is a whole number',
    bases.every((b) => asArray(headingFontSizes(b)).every((v) => Number.isInteger(v))),
    'a non-integer font size would reach the style layer',
  );
}

// ─── 6. The rounding collision the derivation is built to survive ───────────
//
// Rounding each ratio independently is NOT enough, and this pins the reason.
// 1.21 and 1.16 are 0.05 apart, so at a body of 16 they both round to 19 and
// h4 === h5. headingFontSizes builds from the bottom up specifically so that
// cannot happen.

{
  const NAIVE_BASE = 16;
  const naive = {};
  for (const l of LEVELS) naive[l] = Math.round(NAIVE_BASE * HEADING_SIZE_RATIO[l]);

  ok(
    'independent rounding DOES collide at a body of 16 (h4 === h5)',
    naive[4] === naive[5],
    `expected a collision to demonstrate; got h4 ${naive[4]}, h5 ${naive[5]}`,
  );

  ok(
    'yet the real derivation is still strictly decreasing at that body size',
    strictlyDecreasing(headingFontSizes(NAIVE_BASE)),
    `got ${asArray(headingFontSizes(NAIVE_BASE)).join(',')}`,
  );
}

// ─── 7. The ratios themselves ───────────────────────────────────────────────

{
  ok(
    'every ratio is greater than 1, so no level is ever specified below body',
    LEVELS.every((l) => HEADING_SIZE_RATIO[l] > 1),
    `got ${LEVELS.map((l) => HEADING_SIZE_RATIO[l]).join(',')}`,
  );

  const rs = LEVELS.map((l) => HEADING_SIZE_RATIO[l]);
  ok(
    'the ratios are themselves strictly decreasing',
    rs.every((v, i) => i === 0 || rs[i - 1] > v),
    `got ${rs.join(',')}`,
  );

  check('the ratio table covers exactly six levels', Object.keys(HEADING_SIZE_RATIO).length, 6);
}

// ─── 8. The constraint the heading fix must NOT undo (AD26) ─────────────────
//
// Headings are distinguished by size at normal weight so the bionic head's 700
// still reads INSIDE a heading. Web's own headings inherit bold 700, which makes
// the anchor invisible there; that is the divergence AD26 chose deliberately. A
// future "give headings a weight advantage" edit would silently undo it.

{
  ok(
    'heading weight stays strictly below the bionic head weight (AD26)',
    Number(LAYOUT.headingWeight) < Number(LAYOUT.bionicHeadWeight),
    `heading ${LAYOUT.headingWeight} vs bionic head ${LAYOUT.bionicHeadWeight} — the anchor would vanish inside headings`,
  );

  check(
    "the bionic head is web's 700 (index.css:243-244)",
    LAYOUT.bionicHeadWeight,
    '700',
  );
}

// ─── 9. AF39's ruling, pinned so a retune has to be deliberate ──────────────
//
// AF39 records the project owner's ruling on AF36 question (d) against the REAL
// reader surface: ship as-is. These are the values that ruling covers. They are
// not derived from anything, so nothing else would notice them drifting.

{
  check(
    'the judged layout values are unchanged (AF39: ship as-is)',
    {
      wordGapH: LAYOUT.wordGapH,
      wordGapV: LAYOUT.wordGapV,
      wordPadH: LAYOUT.wordPadH,
      wordPadV: LAYOUT.wordPadV,
      bodyLineHeight: LAYOUT.bodyLineHeight,
      highlightOpacity: LAYOUT.highlightOpacity,
      highlightRadius: LAYOUT.highlightRadius,
      scrollTopInset: LAYOUT.scrollTopInset,
    },
    {
      wordGapH: 5,
      wordGapV: 3,
      wordPadH: 2,
      wordPadV: 1,
      bodyLineHeight: 30,
      highlightOpacity: 0.32,
      highlightRadius: 4,
      scrollTopInset: 140,
    },
  );

  ok(
    'the highlight is still DERIVED from the accent, not a second literal (AD26)',
    HIGHLIGHT_BG === `rgba(59, 110, 165, ${LAYOUT.highlightOpacity})` &&
      LIGHT.accent === '#3b6ea5',
    `got ${HIGHLIGHT_BG} from accent ${LIGHT.accent}`,
  );

  console.log(
    `        (shipped scale at body ${LAYOUT.bodyFontSize}: ${asArray(LAYOUT.headingFontSize).join(' / ')})`,
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
