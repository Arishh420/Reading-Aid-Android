# Findings (Android)

> Things **learned by building and testing in this repo** (ReadingAidAndroid)
> — distinct from [DECISIONS.md](DECISIONS.md) (choices made). Append-only:
> new entries go at the bottom; nothing here is rewritten in place, only
> superseded by a later entry that says what it corrects.
>
> **Numbering convention:** entries here are `AF1`, `AF2`, … — the `A` marks
> this as the **Android** log. CLAUDE.md's back-references to `F1`/`F16`/`F41`
> etc. (bare, unprefixed) point at the **web repo's** (Reading Aid Tool)
> `FINDINGS.md`, a separate, older, and much larger log, kept read-only from
> here. The two numbering spaces are intentionally disjoint so a bare `F#` is
> never mistaken for an `AF#`.

## Verification legend

- 🧪 **Measured** — an actual command was run and its exit code / output
  observed (a `tsc` invocation, a diff, a hash comparison). Includes measurements
  recorded from prior sessions or inferred from commit/PR history; prose notes
  whether re-run this session or inherited.
- 📐 **Structural** — follows directly from reading the repo's own files
  (config content, directory contents), without running anything beyond that.
- 👁 **Observed** — seen working end-to-end in the running app. None of the
  entries below currently carry this tag — the app barely runs yet.
- ❓ **Unverified** — believed true (often inherited from the web repo) but
  not exercised in this repo at all.

---

## core/ portability guard

- **AF1** 🧪 — `expo/tsconfig.base` sets `lib: ["DOM", "ESNext"]` (confirmed
  by reading `node_modules/expo/tsconfig.base.json` in this repo), so the
  main `tsc` program is blind to DOM usage inside `core/`. Per PR #1's
  description, this was measured directly: the web repo's fully DOM-typed
  `keyboard.ts`, dropped into `core/` under the pre-guard config, typechecked
  at exit 0. That specific probe was run in a prior session as part of PR #1,
  not re-executed by me in this one.

- **AF2** 🧪 — The guard demonstrably works. Per PR #1: the same
  `document.querySelector` probe placed in a `core/` file gave exit 0 under
  the old (pre-guard) build and exit 2 under the new one
  (`tsc -p tsconfig.core.json`); the probe was then reverted and the file's
  hash confirmed to match the original. Recorded from the PR #1 record, not
  re-run by me this session — re-running it would require temporarily
  reintroducing a DOM call into a `core/` file, which is out of scope here
  (files-in-scope for this task are `DECISIONS.md`/`FINDINGS.md` only).

- **AF3** 🧪 — TypeScript **replaces**, rather than merges, an inherited
  `exclude` array; a child `tsconfig.json` that declares its own `exclude`
  gets *only* that array, not the base's plus its own. Verified directly this
  session by comparing `node_modules/expo/tsconfig.base.json`'s `exclude`
  (6 entries, all `${configDir}/…`-prefixed) against this repo's
  `tsconfig.json` `exclude` (8 entries: the same 6, plus `example` and
  `types/hermes-globals.d.ts`) — the 6 base entries had to be restated
  verbatim, `${configDir}` prefix included, or they would have silently
  dropped out when `example` was added.

- **AF4** 🧪 — The `android`/`ios` exclusion was verified (per PR #1) by
  creating both directories with deliberately broken probe files, confirming
  they stayed out of the typecheck program, with a negative control
  (compiling the probes directly) proving they were genuinely uncompilable
  and not merely coincidentally passing. Recorded from the PR #1 record, not
  reproduced by me this session.

- **AF5** ❓ — "`console` exists as a global under Hermes" is an **inherited**
  belief, not verified in this repo. No Hermes binary has been run here at
  all. What would confirm it: running `expo run:android` (or an equivalent
  Hermes-targeted build) and exercising a `core/` module that calls
  `console.log` on-device, or checking the specific Hermes version's global
  list directly.

- **AF6** ❓ — Nothing in `src/core/` has been *executed* under Hermes in this
  repo — only typechecked. The web repo's F41 Hermes evidence (back-reference,
  not a live pointer) covers `splitOrp` alone; it says nothing about the other
  11 seeded modules (`blocks.ts`, `delimiterSpans.ts`, `tokenize.ts`, `types.ts`,
  `dwell.ts`, `epubStructure.ts`, `markdown.ts`, `pdfText.ts`, `bionic.ts`,
  `sample.ts`, `theme.ts`). What would confirm it: a headless Hermes run (the
  web repo's own ad-hoc esbuild → Node pattern, adapted to Hermes) exercising
  each module's actual logic, not just its types.

- **AF7** 🧪 — The 12 seeded files are byte-identical to their web-repo
  originals. Hash-verified at seed time (commit `1cd60e2`) and re-verified
  after the guard work, per PR #1 ("Probe reverted, hash confirmed
  byte-identical"). Recorded from that history, not independently re-hashed
  by me this session — this task's scope was read-only on the web repo for
  doc-header conventions only, which doesn't extend to diffing source files
  against it.

- **AF8** 📐 — This repo's `tsconfig.json` `exclude` list is now a **manual
  copy** of `expo/tsconfig.base`'s (see AF3), not an inheritance — so a future
  Expo SDK bump that adds an entry to the base's `exclude` (a new generated
  directory, say) will not be picked up here automatically; someone has to
  notice and copy it over by hand. Standing note, not a bug: there's no
  mechanism in TypeScript's `extends` model that would keep it in sync.

## Change log
- Created 2026-08-31, alongside [DECISIONS.md](DECISIONS.md), to make
  CLAUDE.md §2 satisfiable for this repo. Seeded with AF1–AF8, covering what
  was learned during the `core/` seed (commit `1cd60e2`) and the tsconfig
  guard fix (commit `ce3d2ed`/PR #1) that had gone unrecorded until now.
