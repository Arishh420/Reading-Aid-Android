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

## Headless suite port — `core/` executed under Node

- **AF9** 🧪 — **The port needed zero path edits.** The premise going in was
  that the suites bundle source by path and those paths would have to be
  repointed at `src/core/`; they did not. Every entry point is
  `path.join(__dirname, <relative>)` — `'tokenize.ts'`, `'../pacer/orp.ts'`,
  `'../model/delimiterSpans.ts'`, `'../model/tokenize.ts'` — so once a suite
  sits beside its subject under `src/core/`, AD1's preserved directory shape
  makes those relative paths resolve unchanged. Verified two ways this session:
  `diff` reported all eight copies identical to their web-repo originals, and a
  SHA-256 comparison of all eight matched (e.g. `model/headless-test.mjs`
  `f62741ffd0fa60a3…` on both sides). Zero lines differ — assertions, fixtures,
  expected values, and formatting included.

- **AF10** 🧪 — **All eight suites pass here.** Run individually and via
  `npm run test:core`, each exited 0: tokenize 17/17, delimiterSpans 18/18,
  orp 14/14, dwell 9/9, markdown 15/15, pdfText 14/14, epubStructure 12/12,
  spine-integrity 26/26 — **125 checks, 0 failures**. Toolchain: Node v26.7.0,
  esbuild 0.28.2, macOS arm64 (Darwin 25.6.0). Not claimed: that these produce
  identical output to the web repo's own runs. The suites are byte-identical
  and the sources are byte-identical, but the web-repo runs were **not**
  executed for comparison, because running a suite writes a temporary
  `.headless-*.mjs` beside its subject and the web repo was read-only for this
  task.

- **AF11** 🧪❓ — **AF6 is now partially closed, and precisely which part
  matters.** Seven of the twelve seeded modules have had their real runtime
  logic executed here: `model/tokenize.ts`, `model/delimiterSpans.ts`,
  `pacer/orp.ts`, `pacer/dwell.ts`, `parsers/markdown.ts`,
  `parsers/pdfText.ts`, `parsers/epubStructure.ts` (enumerated from the
  suites' own entry points, not assumed). `model/types.ts` has nothing to
  execute — it is four type declarations, erased by esbuild. Four remain
  **unexecuted in this repo**: `model/blocks.ts`, `reader/bionic.ts`,
  `ui/sample.ts`, `ui/theme.ts`; no ported suite bundles any of them.
  The Hermes half of AF6 is **untouched and stays ❓**. These runs are Node
  v26.7.0, not Hermes; no Hermes binary has been run in this repo yet. A green
  Node run is evidence about the *logic*, not about the *engine*, and must not
  be read as Hermes coverage.

- **AF12** 🧪❓ — **Node is not Hermes, and here is the concrete gap this run
  does not cover.** (Mixed tag on purpose: the feature inventory below was
  grepped out of the source and is measured; every claim about what Hermes
  does or does not support is inherited belief, unverified here.) Grepping the
  seven now-executed modules for engine-sensitive features turns up four
  classes, each satisfied by Node v26 and each unverified on Hermes here:
  1. **Regex lookbehind** — `parsers/markdown.ts:62–71` uses `(?<!\w)` and
     `(?<!\s)` in all four emphasis regexes. Structurally the sharpest risk of
     the four regardless of what Hermes turns out to support: a regex *literal*
     that the engine cannot parse fails at **module load**, not at call time —
     it would take out the whole markdown parser rather than one edge case.
     Whether this specific Hermes build accepts lookbehind was not tested.
  2. **Unicode property escapes** — `\p{L}`/`\p{N}` in `model/tokenize.ts:26,30`
     and `\p{M}` in `pacer/orp.ts:36`. `orp.ts`'s own comment asserts `\p{M}`
     is available on Hermes (citing the web repo's F41 — back-reference, not a
     live pointer); `\p{L}` and `\p{N}` carry no such note and are unverified.
  3. **`String.prototype.normalize('NFC')`** — `pacer/orp.ts:137`, on the hot
     path of every ORP split. Unicode normalization tables are a common
     omission in embedded engines.
  4. **`String.prototype.matchAll`** — `parsers/epubStructure.ts:90,99,160,183`.
  Notably *not* a risk: `Intl.Segmenter`. `orp.ts` hand-rolls grapheme
  clustering specifically because Hermes has it on a permanent test262 skip
  list — the avoidance is deliberate and documented in the source.

- **AF13** 🧪 — **esbuild works here despite its `postinstall` never running.**
  `npx expo install --dev esbuild` emitted
  `npm warn install-scripts esbuild@0.28.2 (postinstall: node install.js)` —
  npm's `allowScripts` gate left it unapproved. `require('esbuild').version`
  nonetheless returns `0.28.2` and all eight suites bundle successfully. The
  reason was checked rather than assumed: `node_modules/@esbuild/darwin-arm64/`
  is installed and `node_modules/esbuild/bin/esbuild` is a hardlink to its
  10,590,882-byte binary — the platform binary arrives via the optional
  platform dependency, and the `postinstall` script is not load-bearing here.
  Standing caveat, not a fix: on a fresh clone in a different environment this
  is the most likely reason `npm run test:core` would fail for reasons
  unrelated to the code — which is part of AD10's argument against putting it
  inside `npm run build`.

- **AF14** 🧪 — **The `.mjs` suites are invisible to both `tsc` programs, and
  `npm run build` is still clean.** The main `tsconfig.json` `include` lists
  only `**/*.ts` / `**/*.tsx`, and `tsconfig.core.json` sets no `allowJs`, so
  adding eight `.mjs` files under `src/core/` changes neither program. `npm run
  build` (`tsc --noEmit && tsc -p tsconfig.core.json`) exits 0 with no output
  after the port. Consequence worth naming: the suites themselves are **not**
  typechecked or DOM-guarded by anything — they are plain `.mjs` with no
  coverage from either config.

- **AF15** 🧪 — **esbuild version drift between the two repos is real and
  currently unmeasured.** This repo resolved `0.28.2`; the web repo's
  transitive copy (via Vite) is `0.25.12`. Both bundle the same byte-identical
  sources, but no run under `0.25.12` was performed *here* and no run at all
  was performed *there* (AF10), so "the same tests give the same results under
  both bundlers" is asserted by construction, not measured. If a suite ever
  disagrees between the repos, this is the first variable to eliminate.

- **AF16** 📐 — **The suites write into `src/core/` while running.** Each one
  writes a temporary `.headless-<name>-<pid>.mjs` beside its subject and
  `unlink`s it in a `finally`. Verified after every run this session:
  `find src/core -name ".headless-*"` returned nothing, and `git status
  --porcelain` showed only the eight intended new files. But the pattern is
  **not** in `.gitignore` (nor is it in the web repo's), so a suite killed
  mid-run leaves an untracked file inside `src/core/` — the one directory this
  repo treats as byte-pinned. Flagged, not fixed: adding the ignore rule is a
  separate change from this port.

- **AF17** 🧪 — **The `test:core` runner is non-fail-fast and still propagates
  failure.** `fail=0; … node "$f" || fail=1; …; exit $fail` was proven on three
  scratch scripts where the middle one exited 1: the third still ran and the
  aggregate exited 1. This matters for CLAUDE.md §3 — a `&&` chain would have
  hidden suites 2–8 behind the first failure, which is the opposite of an
  honest verification report.

## `check` script + gitignore hardening

- **AF18** 🧪 — **`npm run check` passes on the real suites and fails when
  `test:core` fails, propagating through the `&&`.** Run against the actual
  eight suites (`build` then `test:core`), `check` exited 0 with the same
  125/125-pass tally as AF10 (tokenize 17/17, delimiterSpans 18/18, orp 14/14,
  dwell 9/9, markdown 15/15, pdfText 14/14, epubStructure 12/12,
  spine-integrity 26/26). `test:core` was then temporarily repointed at a
  scratch script (outside the repo, in the session scratchpad) that runs
  `console.log(...); process.exit(1)`; re-running `npm run check` printed the
  `build` output (clean), then the scratch script's line, then exited 1 —
  confirming `&&` does not swallow a `test:core` failure. `package.json` was
  restored immediately after and `git diff package.json` was inspected to
  confirm `test:core` matched its pre-change text exactly and the only
  remaining diff was the new `check` line.

- **AF19** 🧪 — **The `.gitignore` rule added for AF16 (`.headless-*.mjs`)
  ignores the real temp-file pattern without touching the committed suites.**
  The pattern was re-derived from source, not from AF16's prose: grepping
  `tmpPath = path.join` across all eight suites shows every one builds a name
  of the form `` `.headless-<literal-or-var>-${process.pid}[[-${random}]].mjs` ``
  — e.g. `src/core/model/headless-test.mjs:35` is literally
  `` `.headless-tokenize-${process.pid}.mjs` ``, and
  `src/core/model/delimiterSpans-headless-test.mjs:38-40` additionally appends
  a `Math.random().toString(36).slice(2)` segment — but all eight share the
  same `.headless-` prefix and `.mjs` suffix. Verified with real commands, not
  assumed: `touch src/core/model/.headless-tokenize-99999.mjs` then
  `git check-ignore -v` on that path reported it matched by
  `.gitignore:40:.headless-*.mjs`; `git ls-files src/core | grep mjs` still
  listed all eight `*-headless-test.mjs` suites (unaffected, since none starts
  with a leading dot); the scratch file was then deleted and `git status
  --porcelain` showed only the intended `.gitignore` edit.

## Change log
- Created 2026-08-31, alongside [DECISIONS.md](DECISIONS.md), to make
  CLAUDE.md §2 satisfiable for this repo. Seeded with AF1–AF8, covering what
  was learned during the `core/` seed (commit `1cd60e2`) and the tsconfig
  guard fix (commit `ce3d2ed`/PR #1) that had gone unrecorded until now.
- 2026-08-31 — appended AF9–AF17 for the headless-suite port on
  `test/port-headless-suites`. AF11 partially closes AF6 (7 of 12 modules now
  executed under Node) and explicitly leaves its Hermes half ❓; AF12 records
  the specific engine features that gap now hangs on.
- 2026-08-31 — appended AF18–AF19 on `chore/check-script-and-gitignore`:
  `npm run check`'s pass/fail propagation verified with a real scratch
  failure, and the `.headless-*.mjs` `.gitignore` rule verified against the
  real temp-file pattern and all eight committed suites.
