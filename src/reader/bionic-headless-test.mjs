/**
 * Headless checks for splitBionic (AD23's queued tenth suite).
 *
 * esbuild-bundles the REAL src/core/reader/bionic.ts and exercises the actual
 * shipped `splitBionic`, not a hand-copied restatement.
 *
 * Why this suite exists: AD23 records — after resolving every `entryPoints`
 * and `bundleAndImport` call site in both repos to a literal — that
 * `bionic.ts` has NO test coverage in EITHER repo, and it now ships in the
 * MVP. (The web repo's presets suite matches "bionic" nine times, but every
 * match is the settings field `bionic.enabled` / `bionic.intensity`; that
 * suite bundles no source at all.)
 *
 * PLACEMENT: this suite lives in src/reader/, NOT beside its subject in
 * src/core/reader/, because every suite writes a temporary `.headless-*.mjs`
 * beside its own __dirname while running (AF16), and src/core/ is the one
 * directory whose contents are hash-pinned by CORE-DIVERGENCE.md. Keeping this
 * suite outside it keeps those temp files out of that directory. It reaches its
 * subject via a relative entry point instead.
 *
 * NOTE (AD31): an earlier version of this comment also said src/core/ was
 * "byte-pinned shared surface ... out of scope for Android-local changes". That
 * is FALSE since AD31 forked src/core/. Byte-identity to the web repo is
 * abandoned; src/core/ is ANDROID-OWNED and editable with no freeze exception
 * and no copy-across. It is pinned to a RECORDED BASELINE in
 * CORE-DIVERGENCE.md, and the procedure for changing a file there is to update
 * its row in the SAME PR, not to leave the file alone.
 *
 * Expected values here were derived by RUNNING the real module, then checked
 * against the docblock's stated contract — not predicted from the prose.
 */

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const result = await build({
  entryPoints: [path.join(__dirname, '../core/reader/bionic.ts')],
  bundle: true,
  write: false,
  format: 'esm',
  target: 'node18',
  platform: 'node',
});

const code = result.outputFiles[0].text;
const tmpPath = path.join(__dirname, `.headless-bionic-${process.pid}.mjs`);
const { writeFile, unlink } = await import('node:fs/promises');
await writeFile(tmpPath, code);

let splitBionic, BIONIC_RATIO;
try {
  ({ splitBionic, BIONIC_RATIO } = await import(`${tmpPath}?t=${Date.now()}`));
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

/** Compact split assertion: [lead, head, tail]. */
function split(label, text, ratio, expected) {
  const s = splitBionic(text, ratio);
  check(`${label}  ${JSON.stringify(text)} @${ratio}`, [s.lead, s.head, s.tail], expected);
}

const MED = 0.5;

console.log('\nsplitBionic — headless checks\n');

// ─── The intensity table (§7.1) ──────────────────────────────────────────────

check('BIONIC_RATIO is exactly low/medium/high = 0.3/0.5/0.6', BIONIC_RATIO, {
  low: 0.3,
  medium: 0.5,
  high: 0.6,
});

// ─── The three-slot split ────────────────────────────────────────────────────
// lead + head + tail must ALWAYS reconstitute the input exactly. This is the
// invariant a renderer depends on: it emits {lead}<b>{head}</b>{tail}, so any
// lost or duplicated character would silently corrupt the displayed word.

for (const t of ['quick', '(e.g.', '"Hello', '2026', '\u2014', 'a-b',
                 '\u00e9clair', 'e\u0301clair',
                 '\u0905\u0915\u094d\u0937\u0930', '']) {
  for (const r of [0, 0.3, 0.5, 0.6, 1]) {
    const s = splitBionic(t, r);
    check(
      `lossless: ${JSON.stringify(t)} @${r} reconstitutes`,
      s.lead + s.head + s.tail,
      t,
    );
  }
}

split('three slots', 'quick', MED, ['', 'qui', 'ck']);

// ─── Leading punctuation is never bolded (the reason `lead` exists) ──────────

split('leading punct', '(e.g.', MED, ['(', 'e', '.g.']);
split('leading quote', '"Hello', MED, ['"', 'Hel', 'lo']);
split('multiple leading punct', '((x))', MED, ['((', 'x', '))']);

// ─── Ratio boundaries ────────────────────────────────────────────────────────
// n = max(1, round(L * ratio)), L = LETTER count. Two boundary behaviours
// follow from that formula and are pinned here because a renderer change could
// silently alter either:
//   - the max(1, ...) floor means at least one letter always bolds when the
//     token has any letters at all, even at ratio 0;
//   - Math.round is half-up, so an exact .5 rounds AWAY from zero.

split('ratio 0 still bolds one letter (the max(1,..) floor)', 'quick', 0, ['', 'q', 'uick']);
split('ratio 1 bolds every letter', 'quick', 1, ['', 'quick', '']);
split('low 0.3 on 5 letters -> round(1.5) = 2', 'quick', 0.3, ['', 'qu', 'ick']);
split('medium 0.5 on 5 letters -> round(2.5) = 3 (half-up)', 'quick', 0.5, ['', 'qui', 'ck']);
split('high 0.6 on 5 letters -> round(3.0) = 3', 'quick', 0.6, ['', 'qui', 'ck']);
split('half-up rounding on 3 letters -> round(1.5) = 2', 'The', 0.5, ['', 'Th', 'e']);
split('single letter at ratio 0.3 -> floor to 1', 'a', 0.3, ['', 'a', '']);

// ─── Tokens with no letters get an EMPTY head ────────────────────────────────
// Note the asymmetry, which is easy to get wrong when reimplementing: the
// whole token goes to `tail`, and `lead` stays empty — it is NOT split into
// leading punctuation. The renderer relies on `head` being falsy to degrade to
// plain text.

split('digits only -> empty head, all tail', '2026', MED, ['', '', '2026']);
split('punctuation only -> empty head, all tail', '—', MED, ['', '', '—']);
split('ellipsis -> empty head, all tail', '...', MED, ['', '', '...']);
split('decimal number -> empty head, all tail', '42.5', MED, ['', '', '42.5']);
split('empty string -> all slots empty', '', MED, ['', '', '']);

// ─── Non-letters inside the head span are carried along ──────────────────────
// The head walk extends until it has covered n LETTERS, so a non-letter sitting
// between two counted letters ends up inside the bolded head.

split('interior hyphen is inside the head at ratio 1', 'a-b', 1, ['', 'a-b', '']);

// ─── \p{L} beyond ASCII (AF31 residue item 4, closed on-device by the stage 1 probe) ───

split('non-ASCII Latin: precomposed U+00E9 counts as one letter',
  '\u00e9clair', MED, ['', '\u00e9cl', 'air']);
split('Devanagari: virama U+094D is Mn, not L, so it is not counted',
  '\u0905\u0915\u094d\u0937\u0930', MED, ['', '\u0905\u0915', '\u094d\u0937\u0930']);

// ─── DOCUMENTED CURRENT BEHAVIOUR, not an endorsement ────────────────────────
// splitBionic iterates CODE POINTS (`[...text]`), not grapheme clusters, and
// nothing on the MVP's flowing-highlight path normalizes text: only
// src/core/pacer/orp.ts:137 calls normalize('NFC'), and orp.ts belongs to RSVP,
// which AD19 cut. So decomposed (NFD) input reaches splitBionic as-is.
//
// Consequence pinned below: when a base letter is exactly the nth letter, its
// following combining mark falls on the head/tail boundary and is ORPHANED into
// the unbolded tail. NFD "é" (e + U+0301) at ratio 0.5 bolds "e" and leaves the
// acute in tail. These assertions record what the shipped code DOES so a future
// change is visible; they do not claim it is correct.
//
// FIXABLE HERE (AD31). This was originally flagged rather than fixed because
// bionic.ts was treated as byte-pinned src/core/ shared surface. AD31 ended
// that: src/core/ is forked and Android-owned, and AD31 explicitly nominates
// web issue #110 -- this defect -- as "the fork's first real exercise". Fixing
// it is a three-file change, not a two-repo negotiation: bionic.ts, the pin
// below, and bionic.ts's row in CORE-DIVERGENCE.md, all in the same PR.
//
// NOT A PORT REGRESSION: the web implementation has the identical defect. The
// only normalize() call anywhere in web src/ outside its headless tests is
// orp.ts:137, and web's BionicText.tsx:11 calls splitBionic with nothing in
// between — confirmed by the project owner, who is filing it as an issue in
// the web repo. The behaviour is shared, and is tracked there.

// Written as explicit \u escapes rather than literal characters: a formatter
// that normalized this file would otherwise turn the NFD cases into NFC ones,
// and the assertions would keep passing while testing nothing.
split('NFD combining mark on the head/tail boundary is orphaned into tail',
  'e\u0301', MED, ['', 'e', '\u0301']);
split('NFC precomposed equivalent keeps the accent bolded',
  '\u00e9', MED, ['', '\u00e9', '']);
// When the mark is NOT on the boundary it rides along inside the head, so the
// artifact is boundary-specific rather than general to NFD input.
split('NFD mark away from the boundary rides inside the head',
  'e\u0301clair', MED, ['', 'e\u0301cl', 'air']);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
