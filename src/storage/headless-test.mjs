/**
 * Headless checks for reading-position persistence + the content fingerprint
 * (the eleventh suite). Ported from the web repo's src/storage/headless-test.mjs,
 * with the fingerprint half rewritten — see "What differs from web" below.
 *
 * Tests 1-4, 10 and 15 exercise the REAL src/storage/readingPosition.ts
 * (saveReadingPosition / loadBookRecord), esbuild-bundled, not a hand-copied
 * restatement. readingPosition.ts is a BYTE-IDENTICAL port of the web file
 * (sha256 3385b12b1a6d8e4a6190bbbe53fed40505d028a7ec74794125fab5776a73e5fb on
 * both sides), so these are the same assertions against the same code.
 *
 * That requires a `react-native-mmkv` stub, since Node has no native module.
 * It is injected as an esbuild RESOLVE PLUGIN serving a virtual in-memory
 * module — the same technique AD8 records the web repo's pdf suite using to
 * stub pdfjs-dist, and it means no stub file is written to disk. storage.ts
 * creates its MMKV instance LAZILY inside the accessors (never at module load),
 * which is what makes the substitution safe; the web original relies on the
 * identical property for its localStorage stub.
 *
 * `resolveResumeTarget` is NOT mirrored here, unlike in the web suite. Web has
 * that logic inline in App.tsx's handleResume() (lines 250-280), where nothing
 * can import it; the Android port extracts it to src/storage/resumeTarget.ts,
 * so this suite bundles and tests the REAL shipped function. A mirror would
 * have tested nothing about shipped code — the AD2 / AF8 duplication trap.
 *
 * One mirror does remain, deliberately: `resolveResumeTargetOldBuggy` is the
 * PRE-#76 logic, which exists nowhere in either codebase any more. It is kept
 * only to demonstrate concretely that it gets test 15 wrong.
 *
 * ─── What differs from web, and why ──────────────────────────────────────────
 *
 * The web suite's fingerprint tests (6-9) call a hand-mirrored
 * `fingerprintFromBytes` built on Node's crypto, because the real
 * `computeFingerprint` needs `crypto.subtle` and a `File`. Web issue #102 names
 * that exact situation as the problem — the implementation is "proven only
 * against itself" — and asks for "a headless conformance test with hard-coded
 * expected hashes for known inputs, so any implementation on any platform can
 * be checked against the same fixtures rather than against itself".
 *
 * So here the fingerprint tests bundle the REAL src/storage/fingerprint.ts and
 * assert LITERAL hashes. Nothing in this file recomputes an expected value with
 * the code under test.
 *
 * PROVENANCE OF EVERY EXPECTED HASH — all independently reproducible:
 *   1. The two NIST vectors ('' and 'abc') are the canonical published SHA-256
 *      test vectors, from the standard, not from this project.
 *   2. Every other hash was produced by running the REAL, UNMODIFIED web
 *      `computeFingerprint` under Node v26 — which has a global `File` and
 *      `crypto.subtle`, so the web function runs as-is with no mirror — against
 *      the byte inputs constructed below. Command shape:
 *        esbuild-bundle "<web repo>/src/parsers/index.ts" with
 *        external: ['pdfjs-dist','jszip','./pdf','./epub'], then
 *        await computeFingerprint(new File([bytes], 'x.md'))
 *   3. They were additionally cross-checked against Node's own
 *      crypto.createHash('sha256') for the full-hash path.
 *
 * Byte inputs are given as LITERAL CODE, never prose, so any reader can
 * regenerate them without access to the web repo.
 */

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Virtual `react-native-mmkv`: a Map-backed singleton exposing just the four
 * methods storage.ts touches (set / getString / remove) plus clearAll for test
 * isolation. getString returns `undefined` for an absent key, matching real
 * MMKV — which is precisely the behaviour storage.ts has to translate to null.
 */
const mmkvStubPlugin = {
  name: 'mmkv-stub',
  setup(b) {
    b.onResolve({ filter: /^react-native-mmkv$/ }, () => ({
      path: 'react-native-mmkv',
      namespace: 'mmkv-stub',
    }));
    b.onLoad({ filter: /.*/, namespace: 'mmkv-stub' }, () => ({
      contents: `
        const map = new Map();
        const instance = {
          set(k, v) { map.set(k, String(v)); },
          getString(k) { return map.has(k) ? map.get(k) : undefined; },
          remove(k) { return map.delete(k); },
          contains(k) { return map.has(k); },
          clearAll() { map.clear(); },
          get length() { return map.size; },
        };
        export function createMMKV() { return instance; }
      `,
      loader: 'js',
    }));
  },
};

// A synthetic entry point (esbuild `stdin`) re-exports everything the tests
// need from the two real modules, so no temporary .ts is written into the tree.
const result = await build({
  stdin: {
    contents: `
      export { saveReadingPosition, loadBookRecord } from './readingPosition';
      export { storageGet, storageSet, storageRemove, STORAGE_PREFIX } from './storage';
      export {
        fingerprintBytes, fingerprintText, sha256Hex, utf8Encode,
        SAMPLE_BYTES, FULL_THRESHOLD,
      } from './fingerprint';
      export { resolveResumeTarget } from './resumeTarget';
      import { createMMKV } from 'react-native-mmkv';
      export function __clearAll() { createMMKV().clearAll(); }
    `,
    resolveDir: __dirname,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  target: 'node18',
  platform: 'node',
  plugins: [mmkvStubPlugin],
});

const tmpPath = path.join(__dirname, `.headless-storage-${process.pid}.mjs`);
const { writeFile, unlink } = await import('node:fs/promises');
await writeFile(tmpPath, result.outputFiles[0].text);

let M;
try {
  M = await import(`${tmpPath}?t=${Date.now()}`);
} finally {
  await unlink(tmpPath);
}

const {
  saveReadingPosition, loadBookRecord,
  storageGet, storageSet, storageRemove, STORAGE_PREFIX,
  fingerprintBytes, fingerprintText, sha256Hex, utf8Encode,
  SAMPLE_BYTES, FULL_THRESHOLD,
  resolveResumeTarget,
  __clearAll,
} = M;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

// ─── Resume-target mapping (issues #48, #76) ─────────────────────────────────
// resolveResumeTarget is IMPORTED from the real src/storage/resumeTarget.ts
// above. Only the pre-#76 buggy version is mirrored — see the docblock.

function resolveResumeTargetOldBuggy(recordWordCount, snapshot, currentWordCount) {
  const len = currentWordCount;
  let target;
  if (recordWordCount !== len) {
    target = len > 1 ? Math.round(snapshot.percent * (len - 1)) : 0;
  } else {
    target = snapshot.wordIndex;
  }
  return Math.max(0, Math.min(target, len - 1));
}

// ─── Byte-input constructors — LITERAL CODE, so vectors are reproducible ────

/** The sampled-path input. bytes[i] = i % 251 for i in 0..len-1.
 *  251 is prime and coprime with the 32 KB region size, so the three sampled
 *  regions differ from one another rather than repeating on a power-of-two
 *  cycle. */
function patternBytes(len) {
  const b = new Uint8Array(len);
  for (let i = 0; i < len; i++) b[i] = i % 251;
  return b;
}

console.log('\nReading-position persistence + fingerprint — headless checks\n');

// ─── 1-4, 10, 15: the REAL readingPosition.ts ───────────────────────────────

// 1. History rolls at 5 — oldest entry dropped when 6th is added.
test('history caps at 5 entries', () => {
  __clearAll();
  const fp = 'fp-cap';
  const TOTAL = 1000;
  for (let i = 1; i <= 6; i++) saveReadingPosition(fp, 'Book', i * 100, TOTAL);
  const record = loadBookRecord(fp);
  assert.equal(record.history.length, 5, `expected 5, got ${record.history.length}`);
});

// 2. >2 % gate: saves within 2 % of last history entry do NOT add new entries.
test('>2 % gate prevents redundant history entries', () => {
  __clearAll();
  const fp = 'fp-gate';
  const TOTAL = 10000;
  saveReadingPosition(fp, 'Book', 0, TOTAL);
  const countAfterFirst = loadBookRecord(fp).history.length;
  saveReadingPosition(fp, 'Book', 1, TOTAL);
  assert.equal(loadBookRecord(fp).history.length, countAfterFirst,
    'history grew despite <2 % movement');
});

// 3. latest is ALWAYS updated, even when the history gate suppresses a snapshot.
test('latest is updated on every save regardless of gate', () => {
  __clearAll();
  const fp = 'fp-latest';
  const TOTAL = 10000;
  saveReadingPosition(fp, 'Book', 100, TOTAL);
  const historyLengthBefore = loadBookRecord(fp).history.length;
  saveReadingPosition(fp, 'Book', 150, TOTAL);
  const record = loadBookRecord(fp);
  assert.equal(record.latest.wordIndex, 150, 'latest.wordIndex not updated');
  assert.equal(record.history.length, historyLengthBefore, 'history should not have grown');
});

// 4. Position round-trips through real storage (MMKV stub set/get, JSON fidelity).
test('position round-trips through storage', () => {
  __clearAll();
  saveReadingPosition('fp-rt', 'Book B', 42, 1000);
  const restored = loadBookRecord('fp-rt');
  assert.equal(restored.latest.wordIndex, 42);
  assert.equal(restored.fingerprint, 'fp-rt');
  assert.equal(restored.wordCount, 1000);
  assert.equal(restored.latest.wordCount, 1000,
    'snapshot should carry its own wordCount (issue #76)');
});

// 10. History entries are newest-first (most recent is index 0).
test('history is stored newest-first', () => {
  __clearAll();
  const fp = 'fp-newest';
  const TOTAL = 1000;
  for (let i = 0; i < 3; i++) saveReadingPosition(fp, 'Book', (i + 1) * 100, TOTAL);
  const record = loadBookRecord(fp);
  assert.ok(record.history[0].savedAt >= record.history[1].savedAt,
    'history[0] should be more recent than history[1]');
});

// 15. Issue #76: a history snapshot saved under an older tokenization must
// resolve by ITS OWN wordCount even after a LATER save re-converges the
// record-level wordCount.
test('issue #76: history snapshot drift survives record-level wordCount re-converging', () => {
  __clearAll();
  const fp = 'fp-76';
  saveReadingPosition(fp, 'Book', 1000, 10000); // tokenization A, 10 %
  saveReadingPosition(fp, 'Book', 4000, 8000);  // tokenization B, 50 %
  saveReadingPosition(fp, 'Book', 9000, 10000); // reconverged to A, 90 %

  const finalRecord = loadBookRecord(fp);
  assert.equal(finalRecord.wordCount, 10000, 'record-level wordCount re-converged');
  assert.equal(finalRecord.history.length, 3, 'all three saves should clear the 2 % gate');

  const middleSnapshot = finalRecord.history.find((s) => s.wordIndex === 4000);
  assert.ok(middleSnapshot, 'save 2 snapshot should still be present');
  assert.equal(middleSnapshot.wordCount, 8000, 'save 2 retains its own wordCount');

  const currentLiveWordCount = 10000;

  const oldBuggyTarget = resolveResumeTargetOldBuggy(
    finalRecord.wordCount, middleSnapshot, currentLiveWordCount);
  assert.equal(oldBuggyTarget, middleSnapshot.wordIndex,
    'sanity: the old record-level-only comparison reuses the stale index — the bug');

  const target = resolveResumeTarget(middleSnapshot, finalRecord.wordCount, currentLiveWordCount);
  const expectedByPercent = Math.round(middleSnapshot.percent * (currentLiveWordCount - 1));
  assert.equal(target, expectedByPercent, `expected ${expectedByPercent}, got ${target}`);
  assert.notEqual(target, middleSnapshot.wordIndex, 'must not reuse the stale raw wordIndex');
});

// ─── The storage seam itself (Android-only: web had no equivalent) ──────────
// The web original wrapped localStorage, which signals an absent key with
// null; MMKV signals it with undefined. storage.ts translates, and the seam's
// contract is `T | null`, so these pin the translation.

test('seam: absent key reads back as null, not undefined', () => {
  __clearAll();
  const v = storageGet('definitely-absent');
  assert.equal(v, null);
  assert.ok(!Object.is(v, undefined), 'must be null, not undefined (MMKV sentinel leaked)');
});

test('seam: set/get round-trips a structured value', () => {
  __clearAll();
  assert.equal(storageSet('k', { a: 1, b: [2, 3], c: 'x' }), true);
  assert.deepEqual(storageGet('k'), { a: 1, b: [2, 3], c: 'x' });
});

test('seam: remove makes a key read back as null', () => {
  __clearAll();
  storageSet('k', 1);
  storageRemove('k');
  assert.equal(storageGet('k'), null);
});

test('seam: STORAGE_PREFIX is the v1 namespace, unchanged from web', () => {
  assert.equal(STORAGE_PREFIX, 'readingaid_v1:');
});

// ─── 5, 11-14: mirrored pure logic ──────────────────────────────────────────

// 5. Useful-history filter: entries within 5 % of latest are excluded.
test('useful-history filter excludes entries within 5 % of latest', () => {
  const latest = { wordIndex: 700, percent: 0.70, savedAt: 5 };
  const history = [
    { wordIndex: 640, percent: 0.64, savedAt: 4 }, // 6 % away — included
    { wordIndex: 680, percent: 0.68, savedAt: 3 }, // 2 % away — excluded
    { wordIndex: 300, percent: 0.30, savedAt: 2 }, // 40 % away — included
    { wordIndex: 100, percent: 0.10, savedAt: 1 }, // 60 % away — included
  ];
  const useful = history.filter((s) => Math.abs(s.percent - latest.percent) > 0.05);
  assert.equal(useful.length, 3, `expected 3 useful entries, got ${useful.length}`);
  assert.ok(useful.every((s) => s.wordIndex !== 680), 'entry at 68 % should be excluded');
});

// 11. No drift: wordCount matches → raw wordIndex is used, unchanged.
test('no wordCount drift: resumes at the raw saved wordIndex', () => {
  const snapshot = { wordIndex: 4200, percent: 0.42, savedAt: 1, wordCount: 10000 };
  assert.equal(resolveResumeTarget(snapshot, 10000, 10000), 4200);
});

// 12. Drift: wordCount mismatch → falls back to round(percent * (len - 1)).
test('wordCount drift: resumes by percent instead of raw wordIndex', () => {
  const snapshot = { wordIndex: 4200, percent: 0.42, savedAt: 1, wordCount: 10000 };
  const target = resolveResumeTarget(snapshot, 10000, 8000);
  const expected = Math.round(0.42 * 7999);
  assert.equal(target, expected, `expected ${expected}, got ${target}`);
  assert.notEqual(target, 4200, 'should not have used the stale raw wordIndex');
});

// 13. Clamp holds at the low end.
test('drift fallback clamps at the low end', () => {
  const snapshot = { wordIndex: 0, percent: 0, savedAt: 1, wordCount: 500 };
  assert.equal(resolveResumeTarget(snapshot, 500, 300), 0);
});

// 14. Clamp holds at the high end across all three paths.
test('clamp holds at the high end for non-drift, own-wordCount-drift, and fallback-drift paths', () => {
  const atEnd = { wordIndex: 299, percent: 1, savedAt: 1, wordCount: 300 };
  assert.equal(resolveResumeTarget(atEnd, 300, 300), 299, 'non-drift high end');

  const driftedOwn = { wordIndex: 299, percent: 1, savedAt: 1, wordCount: 250 };
  assert.equal(resolveResumeTarget(driftedOwn, 500, 300), 299, 'drift (own wordCount) clamps');

  const legacyNoOwnWordCount = { wordIndex: 299, percent: 1, savedAt: 1 };
  assert.equal(resolveResumeTarget(legacyNoOwnWordCount, 500, 300), 299,
    'drift (record fallback) clamps');

  const corrupted = { wordIndex: 99999, percent: 1.5, savedAt: 1, wordCount: 500 };
  assert.equal(resolveResumeTarget(corrupted, 500, 300), 299, 'clamps a corrupted percent');
  assert.equal(resolveResumeTarget({ ...corrupted, wordCount: 300 }, 300, 300), 299,
    'non-drift path clamps a stale wordIndex');
});

// ─── FINGERPRINT CONFORMANCE — fixed hashes (web issue #102) ────────────────
// Every expected value below is a LITERAL. See the docblock for provenance.

// The two canonical published NIST SHA-256 vectors. These come from the
// standard itself, so they anchor sha256Hex to FIPS 180-4 rather than to this
// project's own output.
test('sha256Hex: NIST vector for the empty input', () => {
  assert.equal(sha256Hex(new Uint8Array(0)),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('sha256Hex: NIST vector for "abc"', () => {
  assert.equal(sha256Hex(utf8Encode('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

// Multi-block NIST vector (56 bytes — crosses the one-block padding boundary,
// where a length-encoding mistake shows up).
test('sha256Hex: NIST multi-block vector (56 bytes)', () => {
  assert.equal(
    sha256Hex(utf8Encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
});

// utf8Encode must agree with the WHATWG encoding, byte for byte, or every
// fingerprint of non-ASCII content diverges.
test('utf8Encode: multi-byte and astral code points', () => {
  assert.deepEqual([...utf8Encode('a')], [0x61]);
  assert.deepEqual([...utf8Encode('\u00e9')], [0xc3, 0xa9]);            // U+00E9 e-acute
  assert.deepEqual([...utf8Encode('\u0905')], [0xe0, 0xa4, 0x85]);      // U+0905 Devanagari A
  assert.deepEqual([...utf8Encode('\u{1f600}')], [0xf0, 0x9f, 0x98, 0x80]); // U+1F600 astral
  assert.deepEqual([...utf8Encode('\ufeff')], [0xef, 0xbb, 0xbf]);      // U+FEFF BOM
});

test('utf8Encode: an unpaired surrogate becomes U+FFFD, per WHATWG', () => {
  assert.deepEqual([...utf8Encode('\ud800')], [0xef, 0xbf, 0xbd]);
  assert.deepEqual([...utf8Encode('\udc00')], [0xef, 0xbf, 0xbd]);
  assert.deepEqual([...utf8Encode('a\ud800b')], [0x61, 0xef, 0xbf, 0xbd, 0x62]);
});

// The full-hash path (size <= 96 KB), against the real web implementation.
test('fingerprint conformance: full-hash path, fixed hashes', () => {
  assert.equal(fingerprintText(''),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(fingerprintText('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(fingerprintText('hello world'),
    'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  // NFC 'eclair' (U+00E9 + 'clair'), written as an escape so a source
  // formatter cannot renormalize the vector out from under the hash.
  assert.equal(fingerprintText('\u00e9clair'),
    '0ebe6cb10ee48b340d8c35152b94cdedcd0f8d6a8ebaeeab1a2dfefc2e6b187c');
});

// The threshold. 98304 bytes is exactly 96 KB and takes the FULL path
// (`size <= FULL_THRESHOLD`); 98305 takes the SAMPLED path. Off-by-one here
// would silently change identity for every document near the boundary.
test('fingerprint conformance: 96 KB threshold boundary, fixed hashes', () => {
  assert.equal(FULL_THRESHOLD, 98304);
  assert.equal(SAMPLE_BYTES, 32768);
  assert.equal(fingerprintBytes(patternBytes(98304)),
    'f39e9f45bf8c7f0acf2b3ec3c812290a6d97f47b5606780cdbd728c348e54758');
  assert.equal(fingerprintBytes(patternBytes(98305)),
    '38d51ac5605761997c914d3127cf7b89d19ee461608e354c496fe8804a772ebe');
});

// The sampled path (3 regions + 8-byte big-endian size).
test('fingerprint conformance: sampled path, fixed hash', () => {
  assert.equal(fingerprintBytes(patternBytes(200000)),
    'ab4a551e0dea3dd7a6351dffde4a1e0785a969e18f3b14b9a613db09d6220b46');
});

// ─── THE CROSS-PLATFORM DIVERGENCE (AD27) ───────────────────────────────────
// Web hashes RAW FILE BYTES; this implementation hashes a STRING re-encoded to
// UTF-8. Re-encoding is faithful, so identical bytes give identical hashes.
// The hazard is a DECODE PATH that differs between platforms: the fingerprint
// is sensitive to a BOM and to CRLF, so a reader that strips a BOM or
// normalizes line endings on one platform and not the other loses every saved
// position, silently. These pin both sensitivities with fixed hashes so the
// divergence is caught here rather than discovered by a user.

test('divergence: a UTF-8 BOM CHANGES the fingerprint (fixed hashes)', () => {
  assert.equal(fingerprintText('hello world'),
    'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  assert.equal(fingerprintText('\ufeffhello world'),
    '30fd833cee9e20df3791bea8a1990acea6ef2b4765f4986663fea56297449933');
  assert.notEqual(fingerprintText('hello world'), fingerprintText('\ufeffhello world'));
});

test('divergence: CRLF vs LF CHANGES the fingerprint (fixed hashes)', () => {
  assert.equal(fingerprintText('a\nb'),
    '7e18f737311b2dc3b2f269dd78396b0351f14fb66efa879f768cb23181883c78');
  assert.equal(fingerprintText('a\r\nb'),
    '18745f36a05e29072709042d6062ce54f1b08ff36c27ba80c39f81fb010c8ce2');
  assert.notEqual(fingerprintText('a\nb'), fingerprintText('a\r\nb'));
});

// ─── General fingerprint properties (web tests 6-9, against the real module) ─

test('same content → same fingerprint (deterministic)', () => {
  const bytes = utf8Encode('Hello, world! This is a test document.');
  assert.equal(fingerprintBytes(bytes), fingerprintBytes(bytes));
});

test('different content → different fingerprint', () => {
  assert.notEqual(fingerprintBytes(utf8Encode('Book A content')),
    fingerprintBytes(utf8Encode('Book B content')));
});

test('large-file sampling is deterministic', () => {
  const a = patternBytes(200 * 1024);
  assert.equal(fingerprintBytes(a), fingerprintBytes(patternBytes(200 * 1024)));
});

test('large files differing only in the MIDDLE are distinguished', () => {
  const LARGE = 200 * 1024;
  const a = new Uint8Array(LARGE).fill(0xaa);
  const b = new Uint8Array(a);
  b[Math.floor(LARGE / 2)] ^= 0xff;
  assert.notEqual(fingerprintBytes(a), fingerprintBytes(b));
});

test('large files of different SIZE but identical sampled regions differ', () => {
  // What the 8-byte size suffix exists to prevent. Both are all-0xAA, so all
  // three sampled regions are byte-identical; only the length differs.
  const a = new Uint8Array(200 * 1024).fill(0xaa);
  const b = new Uint8Array(200 * 1024 + 1).fill(0xaa);
  assert.notEqual(fingerprintBytes(a), fingerprintBytes(b));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
