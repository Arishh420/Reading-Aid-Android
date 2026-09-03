# CORE-DIVERGENCE.md — the fork manifest

> **Purpose.** [AD31](DECISIONS.md) settles `D-D` by **forking** `src/core/`:
> the files this repo received as copies from the web repo (Reading Aid Tool)
> are now **Android-owned**. There is no cross-repo obligation, no
> back-propagation, and no freeze exception is needed to edit any of them.
> This file is the **record** of that fork — a baseline, and a row per file
> saying whether it has moved off that baseline since.
>
> **This file is MUTABLE**, unlike its append-only neighbours
> [DECISIONS.md](DECISIONS.md) and [FINDINGS.md](FINDINGS.md). It is rewritten
> in place as files diverge, because a record of *current* state cannot live in
> a file that is never rewritten. It is modelled on
> [MVP-PLAN.md](MVP-PLAN.md) — a purpose-built companion to the canonical four
> — per AD18's precedent, and on [RELEASE-SIGNING.md](RELEASE-SIGNING.md),
> which AD30 created for the same reason.
>
> **What this file is NOT.** It is **the record of a divergence, never its
> rationale**. Rationale lives in an `AD` or `AF` entry and **nowhere else** —
> that is AD18's anti-duplication rule, and it exists because this repo has
> documented value-duplication drift three times already (AD2's
> `settings-defaults.ts` false positive, AF8's hand-copied `exclude` list, and
> AD26's hand-copied theme values). A `Record` cell below is a **pointer**, not
> a summary. This file also carries **no web hashes**: byte-identity to web is
> not maintained, not checked, and not recoverable from here.
>
> **This file is CHECKED, not merely written.** `scripts/check-core-baseline.mjs`
> parses the table below and runs inside `npm run check`. A manifest nobody
> enforces is exactly what the web repo's PORT-PLAN.md §5.1 diagnoses in
> F-PRESETS-5 — two copies "diffed by eye", with "no automated guard". The
> manifest and its check are one thing, not two.

---

## 1. The baseline

**Web HEAD at the moment the fork was declared:**

```
15b6ca34e050f28eb1aacacaeaeabc8ef7584e28  (15b6ca3)
2026-08-31
docs: make CLAUDE.md §3's verification target platform-neutral (#107)
```

**This hash is a HISTORICAL MARKER, not a live pointer.** The web repo is not
consulted after this, by this file or by the check. It is recorded so that a
future reader — or a future reconciliation, should the freeze ever lift — can
say precisely which web revision this fork left from.

At that commit, all twenty Tier 1 files below were verified **byte-identical**
to their web counterparts 🧪 (measured 2026-09-03, re-confirming AF7 for the
twelve sources and AF9 for the eight suites). **That verification is the last
one that will ever be made.**

Fork declared **2026-09-03**, on branch `feature/ad31-core-fork`.

---

## 2. The manifest

Twenty-five files. **Tier 1** (rows 1–20) is what was seeded byte-identical
from web — the twelve `src/core/` sources and the eight `src/core/` headless
suites, which are as duplicated by value as the sources they bundle and which
AF14 records as invisible to both `tsc` programs. **Tier 2** (rows 21–25) is
what was hand-copied or ported with deliberate changes.

`Baseline sha256` is the hash at the fork point and is **never edited**.
`Current sha256` is what the file hashes to now, and is what the check compares
against disk. `Record` names the `AD`/`AF` entry accounting for the row's
current state; for an undiverged Tier 1 file there is nothing beyond §1 to
point at, so it reads `—`.

**Deliberately excluded**, so their absence is not read as an oversight:
`src/storage/resumeTarget.ts` and `src/storage/fingerprint.ts` derive their
*logic* from web but are not *copies* — their own docblocks say "Reimplemented
rather than ported" and "This is NOT a port" — so there is no byte-relationship
to a web file and no baseline that would mean anything. Android-original files
(`src/app/*`, `src/reader/ReaderSurface.tsx`, `src/reader/WordBox.tsx`,
`src/reader/prepareDocument.ts`, and the four Android-written suites) are
excluded for the stronger form of the same reason. AD31 records why the
manifest is scoped rather than exhaustive.

<!-- BEGIN MANIFEST -->

| # | Path | Origin at fork | Baseline sha256 | Current sha256 | Diverged? | Record |
|---|---|---|---|---|---|---|
| 1 | `src/core/model/blocks.ts` | seeded byte-identical | `863905dab44ae3c4b0ec9a8da4b5d442a722d0fe01af153ebd7c5ffa2956bd9a` | `863905dab44ae3c4b0ec9a8da4b5d442a722d0fe01af153ebd7c5ffa2956bd9a` | n | — |
| 2 | `src/core/model/delimiterSpans.ts` | seeded byte-identical | `9f421e214db1b8a2d0b3444ac1ad2381d03119c84db42099a4ad9d7403892b07` | `9f421e214db1b8a2d0b3444ac1ad2381d03119c84db42099a4ad9d7403892b07` | n | — |
| 3 | `src/core/model/tokenize.ts` | seeded byte-identical | `cb95f6606de6853fe422eb6c745be8343632bfe1b7c0bf863334b2157199a69a` | `cb95f6606de6853fe422eb6c745be8343632bfe1b7c0bf863334b2157199a69a` | n | — |
| 4 | `src/core/model/types.ts` | seeded byte-identical | `488cccc2d30d9ed51ded1ccd865846fc1d37217644891a104dcaa462221ac336` | `488cccc2d30d9ed51ded1ccd865846fc1d37217644891a104dcaa462221ac336` | n | — |
| 5 | `src/core/pacer/dwell.ts` | seeded byte-identical | `266aa720c8d70a38e5445c9993d52d65f868f9253dcce9a9a5786d4be73c0469` | `266aa720c8d70a38e5445c9993d52d65f868f9253dcce9a9a5786d4be73c0469` | n | — |
| 6 | `src/core/pacer/orp.ts` | seeded byte-identical | `8aff4d3ba5bc37a43145e63f65f7145acfb91e6b3e845110ea56fcc648cb7620` | `8aff4d3ba5bc37a43145e63f65f7145acfb91e6b3e845110ea56fcc648cb7620` | n | — |
| 7 | `src/core/parsers/epubStructure.ts` | seeded byte-identical | `1cb14ebe90efbf720c35cc5fdf08196b4632eefdd2e5614bd6739f88a0483122` | `1cb14ebe90efbf720c35cc5fdf08196b4632eefdd2e5614bd6739f88a0483122` | n | — |
| 8 | `src/core/parsers/markdown.ts` | seeded byte-identical | `45ce1deebe2242b05a8217d73393442f46c651663ef9eb08636831fc64f681b3` | `45ce1deebe2242b05a8217d73393442f46c651663ef9eb08636831fc64f681b3` | n | — |
| 9 | `src/core/parsers/pdfText.ts` | seeded byte-identical | `d60264498d041e7df84a5a22441b6b72e1583ed871f0644366c5c0a296b66dda` | `d60264498d041e7df84a5a22441b6b72e1583ed871f0644366c5c0a296b66dda` | n | — |
| 10 | `src/core/reader/bionic.ts` | seeded byte-identical | `57c45eff6aee921cd43020d52b3f97a8718f2ec9880aa2c993ee56cfd9fdd9a2` | `57c45eff6aee921cd43020d52b3f97a8718f2ec9880aa2c993ee56cfd9fdd9a2` | n | — |
| 11 | `src/core/ui/sample.ts` | seeded byte-identical | `c0875ba4a36a1aed5d82da8136564c601884204036148c3f56a0d6f42dcce0b2` | `c0875ba4a36a1aed5d82da8136564c601884204036148c3f56a0d6f42dcce0b2` | n | — |
| 12 | `src/core/ui/theme.ts` | seeded byte-identical | `ee8dbd2ee80e50dc5aa681d50d7690a4ae6c660e5223bd551b1b582f943fb981` | `ee8dbd2ee80e50dc5aa681d50d7690a4ae6c660e5223bd551b1b582f943fb981` | n | — |
| 13 | `src/core/model/headless-test.mjs` | seeded byte-identical | `f62741ffd0fa60a3c8f7600214d98fa1df36da4a1c1db9819fff96857e663a32` | `f62741ffd0fa60a3c8f7600214d98fa1df36da4a1c1db9819fff96857e663a32` | n | — |
| 14 | `src/core/model/delimiterSpans-headless-test.mjs` | seeded byte-identical | `0762ce5fb20e102e8f8b0dc2a7baa2ee473796c26e8deea90e7dd03f92c4c133` | `0762ce5fb20e102e8f8b0dc2a7baa2ee473796c26e8deea90e7dd03f92c4c133` | n | — |
| 15 | `src/core/pacer/orp-headless-test.mjs` | seeded byte-identical | `31a09a7d9014dbc51203287804a1052798419319c62b90993efbd52e1717f75f` | `31a09a7d9014dbc51203287804a1052798419319c62b90993efbd52e1717f75f` | n | — |
| 16 | `src/core/pacer/dwell-headless-test.mjs` | seeded byte-identical | `3c82524c658de7d998c1122d3a976cbe62ca7216072d33949b8f1e3b4eda393f` | `3c82524c658de7d998c1122d3a976cbe62ca7216072d33949b8f1e3b4eda393f` | n | — |
| 17 | `src/core/parsers/headless-test.mjs` | seeded byte-identical | `b5373895c4d78f6b20c6a616941377d15e5b4e35c2e140a00b21aa76da7f2b3c` | `b5373895c4d78f6b20c6a616941377d15e5b4e35c2e140a00b21aa76da7f2b3c` | n | — |
| 18 | `src/core/parsers/pdfText-headless-test.mjs` | seeded byte-identical | `7be3efbcc11337905084f373c09e1ec8c1c0f99aab8f6703d307986f03cf512f` | `7be3efbcc11337905084f373c09e1ec8c1c0f99aab8f6703d307986f03cf512f` | n | — |
| 19 | `src/core/parsers/epubStructure-headless-test.mjs` | seeded byte-identical | `0f79057277ad2b04a4d7fbdfdf6fd4a0a05a3060e02829113334422df5ee015e` | `0f79057277ad2b04a4d7fbdfdf6fd4a0a05a3060e02829113334422df5ee015e` | n | — |
| 20 | `src/core/parsers/spine-integrity-headless-test.mjs` | seeded byte-identical | `61ef0a74d2213d19177752f68cd4b2ca9b63f24cb54f408c53420f2c0f3d57e0` | `61ef0a74d2213d19177752f68cd4b2ca9b63f24cb54f408c53420f2c0f3d57e0` | n | — |
| 21 | `src/pacer/usePacer.ts` | port, 4-line diff from web | `c68ebe4a0d116175db4391710fff49e4c59499d60692d8a29231c34dd1dce8b8` | `c68ebe4a0d116175db4391710fff49e4c59499d60692d8a29231c34dd1dce8b8` | n | AD22, AD25 |
| 22 | `src/reader/palette.ts` | hand-copy of web `index.css` values | `8a6913dec6de470f955e74139c8b390e554b7a082673c85ed42b1f0fe315055e` | `8a6913dec6de470f955e74139c8b390e554b7a082673c85ed42b1f0fe315055e` | n | AD26, AD29 |
| 23 | `src/storage/storage.ts` | port, platform-swapped to MMKV | `d354bb665358fa0b60255158c9d7a4a2907188f14182ced9514adea206e64315` | `d354bb665358fa0b60255158c9d7a4a2907188f14182ced9514adea206e64315` | n | AD6 |
| 24 | `src/storage/readingPosition.ts` | port, byte-identical to web | `3385b12b1a6d8e4a6190bbbe53fed40505d028a7ec74794125fab5776a73e5fb` | `3385b12b1a6d8e4a6190bbbe53fed40505d028a7ec74794125fab5776a73e5fb` | n | AD25 |
| 25 | `src/storage/headless-test.mjs` | adapted copy of web's suite | `2e35f2d20b79bc12c78af9728ed1a45ad7673386047315a1892c6121d784e692` | `2e35f2d20b79bc12c78af9728ed1a45ad7673386047315a1892c6121d784e692` | n | AD27 |

<!-- END MANIFEST -->

The fence comments above are **load-bearing**: the check locates the table by
them rather than by heading text, so renaming a heading cannot silently empty
it. Do not remove them, and do not add a seven-column pipe table between them
that is not a manifest row.

---

## 3. Procedure

**Any change to a listed file, in the SAME PR as the file edit:**

1. Update that row's **`Current sha256`** to the new hash
   (`shasum -a 256 <path>`).
2. Flip **`Diverged?`** to `y`.
3. Fill **`Record`** with the `AD` or `AF` entry that says *why* — write that
   entry too, if it does not exist yet.

**Never one without the other. Never in a follow-up PR.** That simultaneity is
the whole mechanism: it is what makes this a fork with an audit trail rather
than drift with a document attached.

**`Baseline sha256` is never edited.** It is the fork point. A file that has
diverged and then been reverted goes back to `Diverged? = n` with its `Current`
equal to its `Baseline` again — the baseline itself does not move.

**Adding a file under `src/core/` requires adding a row**, or the check fails.
That is deliberate: it closes, for the core directory, the weakness the web
repo's PORT-PLAN.md §5.2 names against option (c) — "it only guards files on
the manifest, so a new pure module added here is invisible to it until someone
remembers to add it." Outside `src/core/` the manifest is opt-in, and AD31
records that residue.

**A red baseline check is not a bug report.** Under a fork, divergence is
expected. The fix is almost always "write the row", not "revert the edit".

---

## 4. Running the check

```
npm run check:baseline     # this check alone
npm run check              # build, then this check, then all 13 suites
```

It is pure Node — `node:crypto`, `node:fs/promises`, `node:path`, `node:url` —
with no network, no web checkout, no esbuild and no dependencies. It is **not**
a test suite and is not counted as one: the repo's tally is **13 suites plus 1
baseline check**. See AD31 for why that distinction is kept.
