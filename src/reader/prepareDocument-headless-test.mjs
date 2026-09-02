/**
 * Headless checks for prepareDocument (the twelfth suite).
 *
 * esbuild-bundles the REAL src/reader/prepareDocument.ts. It is a React-free
 * module precisely so this suite needs no React Native or Reanimated stub.
 *
 * WHY THIS SUITE EXISTS. prepareDocument holds the two places where a
 * regression would be SILENT — it would render a plausible-looking document
 * that paces or spaces wrongly, with nothing throwing:
 *
 *   1. The `Word.id` -> number conversion. `Word.id` is a STRING holding the
 *      decimal flat index (types.ts:16, AF29). The highlight compares a
 *      Reanimated shared value (a number) against it, and `number === string`
 *      is always false in JS. If this conversion is dropped, moved into a
 *      worklet, or replaced by a fresh counter, the highlight either never
 *      appears or drifts out of step with the pacer — and no test that only
 *      checks word COUNTS would notice.
 *   2. `Word.spaceBefore`. types.ts:26-29 requires renderers that re-insert
 *      inter-token whitespace to honour it. Dropping it produces a stray space
 *      inside a split `word-word`, which looks like a typo, not a bug.
 *
 * The last two checks run the REAL parseMarkdown over the REAL seeded sample,
 * so the conversion is exercised against genuine parser output rather than
 * hand-built fixtures — that is what ties this to CLAUDE.md invariant 1
 * (`Word.id` === flat word index, parsers call reindexWords last).
 */

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const result = await build({
  stdin: {
    contents: `
      export { prepareDocument, buildWordBlockMap, countWords } from './prepareDocument';
      export { parseMarkdown } from '../core/parsers/markdown';
      export { SAMPLE_MARKDOWN } from '../core/ui/sample';
      export { BIONIC_RATIO } from '../core/reader/bionic';
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

const tmpPath = path.join(__dirname, `.headless-preparedoc-${process.pid}.mjs`);
const { writeFile, unlink } = await import('node:fs/promises');
await writeFile(tmpPath, result.outputFiles[0].text);

let prepareDocument, buildWordBlockMap, countWords, parseMarkdown, SAMPLE_MARKDOWN, BIONIC_RATIO;
try {
  ({ prepareDocument, buildWordBlockMap, countWords, parseMarkdown, SAMPLE_MARKDOWN, BIONIC_RATIO } =
    await import(`${tmpPath}?t=${Date.now()}`));
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

const MED = 0.5;

/** Build a Document from block specs; ids are the flat index, as reindexWords guarantees. */
function doc(blockSpecs) {
  let id = 0;
  return {
    blocks: blockSpecs.map((spec, bi) => ({
      id: `b${bi}`,
      type: spec.type ?? 'paragraph',
      ...(spec.level === undefined ? {} : { level: spec.level }),
      words: (spec.words ?? []).map(([text, isWordlike, spaceBefore]) => ({
        id: String(id++),
        text,
        isWordlike: isWordlike ?? true,
        spaceBefore: spaceBefore ?? true,
      })),
    })),
  };
}

console.log('\nprepareDocument — headless checks\n');

// ─── 1. The Word.id -> number conversion ────────────────────────────────────

{
  const d = doc([{ words: [['alpha'], ['beta'], ['gamma']] }]);
  const p = prepareDocument(d, MED);
  check('Word.id string -> numeric index', p[0].words.map((w) => w.index), [0, 1, 2]);
  ok('index is a NUMBER, not a string',
    p[0].words.every((w) => typeof w.index === 'number'),
    `got types ${p[0].words.map((w) => typeof w.index).join(',')}`);
  ok('index is not NaN',
    p[0].words.every((w) => Number.isInteger(w.index)),
    'a non-integer index would silently never match the shared value');
}

{
  // Multi-digit and multi-block: ids must be taken from Word.id, never from a
  // per-block counter that would restart at 0 in every block.
  const d = doc([
    { words: [['a'], ['b']] },
    { words: [['c'], ['d']] },
    { words: [['e']] },
  ]);
  const p = prepareDocument(d, MED);
  check('indices continue ACROSS blocks (not per-block counters)',
    p.flatMap((b) => b.words.map((w) => w.index)), [0, 1, 2, 3, 4]);
}

{
  // A large id proves the conversion is a real parse, not a character read.
  const d = { blocks: [{ id: 'b0', type: 'paragraph', words: [
    { id: '175', text: 'last', isWordlike: true, spaceBefore: true },
  ] }] };
  check('multi-digit Word.id converts correctly', prepareDocument(d, MED)[0].words[0].index, 175);
}

{
  // prepareDocument must NOT renumber. Given non-contiguous ids (as a filtered
  // document would produce), it reports what Word.id says.
  const d = { blocks: [{ id: 'b0', type: 'paragraph', words: [
    { id: '4', text: 'x', isWordlike: true, spaceBefore: true },
    { id: '9', text: 'y', isWordlike: true, spaceBefore: true },
  ] }] };
  check('does NOT renumber — reports Word.id as given',
    prepareDocument(d, MED)[0].words.map((w) => w.index), [4, 9]);
}

// ─── 2. Word.spaceBefore (types.ts:26-29) ───────────────────────────────────

{
  const d = doc([{ words: [['word'], ['flush', true, false], ['spaced', true, true]] }]);
  const p = prepareDocument(d, MED);
  check('spaceBefore is carried through verbatim',
    p[0].words.map((w) => w.spaceBefore), [true, false, true]);
}

{
  // The real shape this exists for: a split `word-word` whose right-hand piece
  // must render flush. Losing the false here inserts a stray space.
  const d = doc([{ words: [['word—', true, true], ['word', true, false]] }]);
  const p = prepareDocument(d, MED);
  check('split dash run: right-hand piece keeps spaceBefore false',
    p[0].words[1].spaceBefore, false);
}

// ─── 3. Bionic is applied once, here ────────────────────────────────────────

{
  const d = doc([{ words: [['quick'], ['(e.g.'], ['2026']] }]);
  const p = prepareDocument(d, MED);
  const w = p[0].words;
  check('bionic split: plain word', [w[0].lead, w[0].head, w[0].tail], ['', 'qui', 'ck']);
  check('bionic split: leading punctuation', [w[1].lead, w[1].head, w[1].tail], ['(', 'e', '.g.']);
  check('bionic split: no-letter token has empty head',
    [w[2].lead, w[2].head, w[2].tail], ['', '', '2026']);
  ok('raw text is retained alongside the split (used when head is empty)',
    w[2].text === '2026', 'text must survive for the no-head render path');
}

{
  // The ratio is a parameter, not baked in.
  const d = doc([{ words: [['quick']] }]);
  check('ratio is honoured: low 0.3', prepareDocument(d, 0.3)[0].words[0].head, 'qu');
  check('ratio is honoured: high 0.6', prepareDocument(d, 0.6)[0].words[0].head, 'qui');
  check('BIONIC_RATIO.medium is the default used by ReaderSurface', BIONIC_RATIO.medium, 0.5);
}

// ─── 4. Block type and level (web Reader.tsx:95 clamp) ──────────────────────

{
  const levels = [undefined, 0, -3, 1, 3, 6, 7, 99];
  const d = doc(levels.map((level) => ({ type: 'heading', level, words: [['h']] })));
  check('heading level clamped to 1..6 exactly as web does',
    prepareDocument(d, MED).map((b) => b.level), [1, 1, 1, 1, 3, 6, 6, 6]);
}

{
  const d = doc([{ type: 'paragraph', words: [['p']] }, { type: 'heading', level: 2, words: [['h']] }]);
  const p = prepareDocument(d, MED);
  check('block type is preserved', p.map((b) => b.type), ['paragraph', 'heading']);
  check('block id is preserved', p.map((b) => b.id), ['b0', 'b1']);
  check('paragraph level defaults to 1 (unused, but never out of range)', p[0].level, 1);
}

// ─── 5. Degenerate documents must not throw ─────────────────────────────────

check('empty document -> no blocks', prepareDocument({ blocks: [] }, MED), []);
check('word-less block -> empty word list',
  prepareDocument(doc([{ words: [] }]), MED)[0].words, []);
check('countWords on an empty document is 0', countWords(prepareDocument({ blocks: [] }, MED)), 0);
check('buildWordBlockMap on an empty document is empty',
  buildWordBlockMap(prepareDocument({ blocks: [] }, MED)), []);

// ─── 6. The auto-scroll support maps ────────────────────────────────────────

{
  const d = doc([{ words: [['a'], ['b']] }, { words: [['c']] }, { words: [['d'], ['e']] }]);
  const p = prepareDocument(d, MED);
  check('buildWordBlockMap: flat index -> block index', buildWordBlockMap(p), [0, 0, 1, 2, 2]);
  check('countWords: highest flat index + 1', countWords(p), 5);
}

{
  // A word-less block in the middle must not corrupt the map — the same hazard
  // CLAUDE.md invariant 1 describes for blockStarts.
  const d = doc([{ words: [['a']] }, { words: [] }, { words: [['b']] }]);
  const p = prepareDocument(d, MED);
  check('mid-document word-less block: map still correct', buildWordBlockMap(p), [0, 2]);
  check('mid-document word-less block: count still correct', countWords(p), 2);
}

// ─── 7. Against the REAL parser and the REAL seeded sample ──────────────────

{
  const parsed = parseMarkdown(SAMPLE_MARKDOWN);
  const p = prepareDocument(parsed, MED);
  const flatOriginal = parsed.blocks.flatMap((b) => b.words);
  const flatPrepared = p.flatMap((b) => b.words);

  ok('real sample: every word is prepared',
    flatPrepared.length === flatOriginal.length,
    `prepared ${flatPrepared.length} vs parsed ${flatOriginal.length}`);

  // THE central regression guard: every prepared index must equal the numeric
  // value of the parser's own Word.id. Nothing renumbered, nothing offset.
  const mismatches = flatPrepared.filter((w, i) => w.index !== Number(flatOriginal[i].id));
  ok('real sample: prepared index === Number(Word.id) for EVERY word',
    mismatches.length === 0,
    `${mismatches.length} mismatched`);

  // CLAUDE.md invariant 1: contiguous 0..N-1.
  ok('real sample: indices are contiguous 0..N-1 (CLAUDE.md invariant 1)',
    flatPrepared.every((w, i) => w.index === i),
    'indices are not the contiguous flat sequence');

  check('real sample: countWords agrees with the flat length',
    countWords(p), flatOriginal.length);

  ok('real sample: spaceBefore round-trips from the parser',
    flatPrepared.every((w, i) => w.spaceBefore === flatOriginal[i].spaceBefore),
    'spaceBefore was altered');

  ok('real sample: block types are only heading or paragraph',
    p.every((b) => b.type === 'heading' || b.type === 'paragraph'),
    'unexpected block type');

  ok('real sample: every heading level is within the size table 1..6',
    p.every((b) => b.level >= 1 && b.level <= 6),
    'a level would index outside LAYOUT.headingFontSize');

  ok('real sample: buildWordBlockMap covers every flat index',
    buildWordBlockMap(p).length === flatOriginal.length,
    'the Y map would have holes and auto-scroll would no-op');

  console.log(`        (real sample: ${p.length} blocks, ${flatOriginal.length} words)`);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
