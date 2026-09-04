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
- 👁 **Observed** — seen working end-to-end in the running app; for a
  device/emulator run, this means observed on a running device by the
  project owner and reported to Claude — not reproducible from a Claude
  Code session, which cannot run an emulator itself. First used by
  AF27/AF29 below.
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

## Hermes CLI feature probe — AF12's four questions answered

> Scope warning that governs this whole section: everything below is
> **CLI-level** evidence. No emulator, device, or `expo run:android` build was
> involved, and **no claim here is a claim about device behaviour.**

- **AF20** 🧪 — **Two Hermes binaries were needed, because the one that matches
  what this app would ship cannot execute.** RN 0.86.3 pins its own compiler:
  `node_modules/react-native/package.json` line 179 reads
  `"hermes-compiler": "250829098.0.17"`, and that version is corroborated by
  `sdks/.hermesv1version` (`hermes-v250829098.0.17`) and
  `sdks/hermes-engine/version.properties`
  (`HERMES_V1_VERSION_NAME=250829098.0.17`). Hermes V1 is the default, not an
  opt-in: `hermes-utils.rb`'s `hermes_v1_enabled()` is
  `ENV['RCT_HERMES_V1_ENABLED'] != "0"`. The binary is at
  `node_modules/hermes-compiler/hermesc/osx-bin/hermesc`; `--version` reports
  `Hermes release version: 250829098.0.17`, `HBC bytecode version: 98`, and a
  `Features:` list whose first entry is `Unicode RegExp Property Escapes`.
  It is **compile-only**: `-exec` appears in its shared LLVM driver options but
  the binary refuses it — `Please choose output, e.g. -emit-binary. hermesc
  does not support -exec.` So it answers parse/compile-time questions at the
  exact shipping version and *nothing else*.
  For a runtime VM there was no matching option. No Hermes VM exists anywhere
  in `node_modules` or on this machine (checked `node_modules`, `~/.gradle`,
  `~/Library/Caches/CocoaPods`, Homebrew, `PATH`); RN's prebuilt artifacts come
  from Maven as `hermes-ios` tarballs and Android `.so`/AAR, neither runnable as
  a macOS CLI. The newest standalone `facebook/hermes` release carrying a VM is
  **v0.13.0** (2024-08-16), asset `hermes-cli-darwin.tar.gz`, sha256
  `f16b0214f7b96eccbd47766f5a3914e847a4387649b2f6b60820d309879200bd`. It is a
  universal binary (x86_64 + arm64), so it ran natively without Rosetta.
  Quirk recorded rather than smoothed over: that **v0.13.0** asset's
  `hermes --version` self-reports `Hermes release version: 0.12.0`, HBC 96.
  **The version gap is real and was measured, not estimated:** the v0.13.0 VM
  refuses bytecode emitted by RN's own hermesc —
  `Error deserializing bytecode: Wrong bytecode version. Expected 96 but got 98`,
  exit 5. So the compiler evidence is at the shipping version and the runtime
  evidence is roughly a year behind it; the two cannot be bridged by running
  the shipping compiler's output on the available VM.
  Neither binary was installed via npm, added to `package.json`, or placed
  inside the repo (see AD15, AD16).

- **AF21** 🧪 — **The probe harness was validated against four negative controls
  before any green result was trusted, and the masking hazard was demonstrated
  rather than assumed.** AF12 #1 warns that an unparseable regex *literal* fails
  at module load, not at call time. That makes a single combined probe file
  actively misleading, so **each feature got its own file**; a compile failure
  can then only destroy its own probe. NC4 proves this is not a theoretical
  concern: a file containing two genuinely-passing checks (`normalize`,
  `matchAll`) **followed** by an unparseable `/(?<!/` produced **zero output**
  on all three engines — compilation precedes execution, so one bad literal
  erases every sibling's evidence in the same file.
  The controls, all behaving as required:
  `NC1` (malformed `/[a-/`) → exit 2 on both hermesc and the VM, exit 1 on Node.
  `NC2` (**the load-bearing control**: the ES2024 `v` flag,
  `/[\p{L}--[aeiou]]/v` — *valid modern JavaScript*, not garbage) → rejected by
  both Hermes builds with `Invalid regular expression: Invalid flags`, exit 2;
  accepted by Node, exit 0. This is what proves the harness detects a genuine
  "engine too old for this regex feature" condition — precisely AF12 #1's
  failure class — instead of only catching syntax errors, and it proves Hermes
  and Node genuinely diverge here so the comparison is not vacuous.
  `NC3` (ES2024 `String.prototype.toWellFormed`) → absent on the VM (exit 1),
  present on Node: runtime-gap detection is live. Note `NC3` compiled at exit 0
  under hermesc, confirming from the other direction that the compiler cannot
  see runtime gaps at all.

- **AF22** 🧪 — **All four of AF12's questions answer WORKS. None partially
  works. But the four are not equally well covered, and the difference matters.**
  1. **Regex lookbehind — WORKS.** *Compile:* all four `markdown.ts` emphasis
     literals compile under RN's own hermesc at exit 0. *Execute:* 8/8
     behavioural checks on the VM, output byte-identical to Node
     (`snake_case_name` and `a__b__c` untouched, `3 * 4 * 5` untouched,
     `**hi**`→`hi`). **This is the best-covered of the four, and it is the one
     AF12 called the sharpest risk:** the parse-time half is settled at the
     exact version the app would ship, so the "markdown parser entirely absent"
     scenario is ruled out at the compiler that would actually build it.
  2. **Unicode property escapes `\p{L}`/`\p{N}`/`\p{M}` — WORKS.** All compile
     under RN's hermesc at exit 0; 11/11 behavioural checks on the VM identical
     to Node (Latin, accented, Devanagari, CJK, Arabic-Indic digits, combining
     acute, Devanagari matra, and correct negatives). Independently corroborated
     at the shipping version by hermesc's own `Features:` line listing
     `Unicode RegExp Property Escapes`. `orp.ts`'s in-source claim that `\p{M}`
     is available on Hermes (citing web F41) is now confirmed *here*; `\p{L}`
     and `\p{N}`, which AF12 noted carried no such assurance, are confirmed too.
  3. **`String.prototype.normalize('NFC')` — WORKS, but with the weakest
     coverage of the four.** 9/9 on the VM, identical to Node: composition
     (`e`+U+0301 → 1 code point), decomposition (NFD → 2), default-argument NFC,
     Hangul algorithmic composition, ASCII pass-through, Devanagari. An explicit
     anti-stub assertion is included — a no-op pass-through implementation would
     satisfy the "unchanged" cases, so the probe fails if NFC leaves `e`+U+0301
     decomposed; it reported `stub? false`. **Caveat that cannot be removed with
     the binaries available:** `normalize` is a pure runtime builtin, so hermesc
     cannot test it. This is evidence at VM 0.12/0.13 **only**, *not* at the
     shipping 250829098.0.17.
  4. **`String.prototype.matchAll` — WORKS.** 10/10 on the VM, identical to
     Node, covering both call shapes `epubStructure.ts` actually uses (`for..of`
     at lines 90/99/183 and spread at 160), plus capture groups, `.index`,
     re-iteration of a `/g` regex, and the required `TypeError` on a non-global
     regex. Same caveat as #3: runtime-only, older VM.
  Both regex features were additionally confirmed on a second, independent code
  path — runtime construction via `new RegExp(<string>)`, 11/11 on both engines.
  That path is *corroboration only, not a substitute*: the shipped code uses
  literals, and literal vs. runtime regex compilation are different code paths
  an engine could in principle treat differently.

- **AF23** 🧪 — **All 11 executable seeded modules LOAD and RUN under Hermes,
  and every one produced output byte-identical to Node.** Each was
  esbuild-bundled from the **real, unmodified** `src/core/*.ts` into a single
  IIFE at `--target=esnext` (deliberately no downlevelling, so the engine is
  tested rather than handed Babel-rescued output), then (a) compiled by RN's own
  hermesc, (b) executed on the VM, (c) executed on Node, and (b) `diff`ed
  against (c). The oracle is Node's output, not a hand-predicted expectation.
  Per module — `hermesc` exit / VM exit / Node exit / diff:
  `model/tokenize` 0/0/0/identical · `model/delimiterSpans` 0/0/0/identical ·
  `model/blocks` 0/0/0/identical · `pacer/orp` 0/0/0/identical ·
  `pacer/dwell` 0/0/0/identical · `parsers/markdown` 0/0/0/identical ·
  `parsers/pdfText` 0/0/0/identical · `parsers/epubStructure` 0/0/0/identical ·
  `reader/bionic` 0/0/0/identical · `ui/sample` 0/0/0/identical ·
  `ui/theme` 0/0/0/identical. **11 modules, 0 failures, 0 diffs.**
  `model/types.ts` is excluded as having nothing to execute (AF11).
  Substantive behaviour exercised, not just loading: `markdown` parsed an
  11-block document with 69 words, ids contiguous from 0; `orp` split ZWJ emoji,
  regional-indicator flags and Devanagari clusters, and gave *identical* splits
  for decomposed vs. precomposed `éclair` — which is `normalize('NFC')` doing
  its job inside the real module; `blocks` produced `blockStarts [0,3,3,5,5]`
  from a document with two mid-document empty blocks — non-decreasing, no
  `MAX_SAFE_INTEGER` sentinel, i.e. CLAUDE.md invariant 1's in-range encoding
  holding under Hermes.
  **Not claimed:** that the eight ported headless suites were run under Hermes.
  They cannot be — they `import` `node:assert/strict`, `node:path`, `node:url`
  and `esbuild`, none of which the Hermes CLI provides. The module probes are
  separate harness code written for this task, so they are *new* evidence, not
  the suites re-run on a second engine.

- **AF24** 🧪 — **The green results in AF22/AF23 are not an artefact of the
  bundler erasing the very features under test.** This was checked, because a
  bundler that downlevelled the regexes or tree-shook an unused module away
  would produce a confident, meaningless pass. Two guards: every entry prints
  `Object.keys(M)` first, which forces esbuild to retain all exports; and the
  emitted bundles were grepped. `m06_markdown.js` lines 86–89 contain all four
  emphasis regexes character-for-character as in source, `(?<!` appearing 4
  times; `\p{L}`/`\p{N}` survive in `m01_tokenize.js`, `\p{M}` in `m04_orp.js`,
  `\p{L}` in `m09_bionic.js`; `normalize("NFC")` in `m04_orp.js`; 4 `matchAll`
  occurrences in `m08_epubStructure.js`. esbuild does not rewrite regex literals
  at any target, and this confirms it empirically rather than on that assumption.

- **AF25** 🧪 — **AF11's Node-side gap is now fully closed, as a side effect.**
  AF11 recorded 7 of 12 modules executed and named four never executed in this
  repo on any engine: `model/blocks.ts`, `reader/bionic.ts`, `ui/sample.ts`,
  `ui/theme.ts`. All four were executed here under **both** Node and Hermes
  (AF23). So all 11 executable seeded modules have now run under Node, and all
  11 under the Hermes CLI. `npm run check` still exits 0 — 125/125 across the
  eight suites, unchanged (17+18+14+9+15+14+12+26), confirming nothing in this
  task disturbed the existing gate.

- **AF26** ❓ — **AF11's Hermes half is NARROWED, NOT CLOSED. The precise
  residue, stated so it cannot be misread as device coverage:**
  1. **The desktop Hermes CLI is not the Hermes that ships in an Android app.**
     The web repo's F41 (back-reference, not a live pointer) recorded that the
     CLI has **no platform `Intl` backend**, whereas Android's `Intl` is
     ICU-backed via JNI. Nothing here touched `Intl` — deliberately, since
     `orp.ts` hand-rolls grapheme clustering precisely to avoid
     `Intl.Segmenter` — but it means a green CLI run is evidence about the
     **engine's language features**, not proof the app works on a device.
  2. **The runtime evidence is a year behind the shipping engine.** Features 3
     and 4 (`normalize`, `matchAll`) were verified only on VM 0.12/0.13, never
     at 250829098.0.17, because RN's hermesc cannot execute and the VM cannot
     load HBC 98 (AF20). That these builtins survive into 0.17 is an
     **assumption** (engines rarely remove builtins), not a measurement.
  3. **No Android build, emulator, device, or `expo prebuild` was run**, so
     nothing here speaks to JSI/bridge behaviour, release-mode bytecode
     precompilation, Metro+Babel's actual transform output (this probe used
     esbuild at `--target=esnext`, which is *not* what Metro emits), Proguard/R8
     interaction, or ABI-specific `libhermes.so` behaviour.
  4. **`console` under Hermes (AF5) is still unverified** — the probes route
     output through the CLI's `print`, falling back to `console.log` only on
     Node, so no `core/` module's `console` call was exercised on Hermes.
  What would close the remainder: an `expo run:android` build exercising these
  modules on-device or on an emulator, which is exactly the commitment this
  task existed to de-risk first.

## On-device Hermes probe (Android emulator) — first real device evidence

> Scope warning that governs this whole section: everything below was
> directly witnessed by the project owner on a running Android emulator and
> reported to me. I did not run an emulator myself and could not reproduce
> any of it in this session — recorded the same way AF1/AF2/AF4/AF7 record
> PR-record evidence not re-run by the recording session.

- **AF27** 👁 — **AF5 is RESOLVED: `console` exists and functions as a
  global under device Hermes on Android, in a debug development build.**
  On an Android emulator (AVD `Pixel_9_API36`, API 36, arm64-v8a, Google
  APIs image; Expo SDK 57 / React Native 0.86.3; debug development build),
  running the probe screen added to `src/app/index.tsx` on this branch, the
  Metro terminal showed exactly one line —
  `LOG  [hermes-probe] blocks: 12 words: 176` — appearing once, matching the
  single `console.log` call in that screen's source.
  Concrete consequence: `src/core/parsers/epubStructure.ts` has two
  `console.warn` calls — line 104 (`manifest item not found for idref…` —
  chapter skipped) and line 193 (`chapter "…" used unclosed-tag fallback…`),
  confirmed by reading the file this session; these are the chapter-skip
  warnings referenced elsewhere as web-repo decisions D63/D93
  (back-reference, not a live pointer — the labels themselves were not
  independently verified in this repo, consistent with how AF12 treats F41).
  Those two calls will now reach the Metro terminal in development, per this
  evidence.
  Not claimed: anything about release builds. This was exclusively a debug
  development build; Hermes' release-mode console strategy (stripped,
  redirected, or unchanged) is untested. This entry supersedes AF5; AF5's
  text above is left unedited, per this file's append-only convention.

- **AF28** 🧪👁❓ — **AF26 is PARTIALLY ADVANCED, NOT CLOSED.**
  `parsers/markdown.ts` and its runtime dependency `model/tokenize.ts` have
  now executed under the real Android Hermes engine — same emulator/build
  as AF27 (AVD `Pixel_9_API36`, API 36, arm64-v8a, Google APIs image; Expo
  SDK 57 / React Native 0.86.3; debug development build) — producing
  `blocks: 12`, `words: 176`, and the first 12 words' ids/texts matching the
  sample document exactly. A Node-side comparator (esbuild-bundling the same
  two modules and running `parseMarkdown(SAMPLE_MARKDOWN)` under Node, the
  same pattern as the existing headless suites) printed byte-identical
  output: `blocks: 12 words: 176` and the same first-12 id:text list. The
  comparator script was temporary and has been deleted — unlike AF9/AF10's
  committed suites, this comparison is not independently reproducible from
  the repo as it stands.
  This is evidence of a different kind than AF22/AF23 (desktop Hermes CLI)
  and AF9/AF10 (Node headless suites): it is the actual shipping engine on
  an actual Android runtime, for the first time, for these two modules.
  What it does NOT cover, stated plainly: **none** of AF12's four
  engine-sensitive features (regex lookbehind, `\p{L}`/`\p{N}`/`\p{M}`
  property escapes, `String.prototype.normalize('NFC')`, `matchAll`) — those
  live principally in `pacer/orp.ts` (and `epubStructure.ts` for
  `matchAll`), neither of which has run on-device. AF26 stays **open**; this
  entry advances only its point 3 (no Android build/emulator run), and only
  for `markdown.ts`/`tokenize.ts`. AF26's point 4 (console) is now
  separately closed by AF27; points 1 (CLI has no `Intl` backend) and 2 (VM
  version gap) are untouched by this entry.

- **AF29** 👁📐 — **CLAUDE.md invariant 1 (`Word.id === flat word index`)
  observed holding on a real device**, for the first 12 words of the sample
  document produced by the AF28 run: ids read `"0"`..`"11"`, contiguous, no
  gaps. `Word.id` is a **string** (`src/core/model/types.ts:16`,
  `id: string;` — confirmed by reading the file this session), the decimal
  form of the flat index, not a number — so this is a string-sequence match
  (`"0"`, `"1"`, … `"11"`), not a numeric-equality check. This extends
  AF23's Hermes-CLI `blockStarts`-non-decreasing finding (itself a check of
  the same invariant, on desktop Hermes, for a different document) to a real
  Android device, for this one document's first 12 words.

- **AF30** 🧪📐 — **Negative result: the `android`/`ios` tsconfig excludes
  were NOT exercised by the first real `expo prebuild`, and must not be
  read as newly confirmed.** When `npx expo prebuild --platform android`
  was run on this repo, `find android -name '*.ts' -o -name '*.tsx'`
  returned **nothing** — a real generated `android/` directory contains no
  TypeScript files at all. So there was nothing under `android/` for
  `tsconfig.json`'s `${configDir}/android` exclude (AF3, AF4) to actually
  have to exclude; the subsequent clean typecheck after prebuild proves only
  that prebuild did not break the build pipeline, not that the exclude glob
  does anything on real generated content. (This run was Android-only — no
  `ios/` directory was generated, so the `${configDir}/ios` exclude is
  addressed even less by this evidence than `android` is.) **AF4's
  synthetic-probe-file evidence — deliberately broken `.ts` files created
  inside `android/`/`ios/`, confirmed excluded, with a negative control —
  remains the ONLY evidence that these excludes function**; AF4's status is
  not upgraded, restated, or otherwise touched by this entry.

## MVP planning — scope correction to the on-device evidence

- **AF31** 📐👁 — **Scope correction to AF28: two of AF12's four
  engine-sensitive feature classes WERE partly exercised on-device, by the very
  run AF28 itself records.** AF28 states that "**none** of AF12's four
  engine-sensitive features (regex lookbehind, `\p{L}`/`\p{N}`/`\p{M}`
  property escapes, `String.prototype.normalize('NFC')`, `matchAll`)" was
  covered. That is too strong for the first two. **Nothing new was executed for
  this entry** — it is a re-reading of `src/core/` source against AF28's
  already-recorded output. The device run is AF28's, on the same emulator and
  build (AVD `Pixel_9_API36`, API 36, arm64-v8a, Google APIs image; Expo SDK 57
  / RN 0.86.3; debug development build), witnessed by the project owner and
  **not by me**. The 👁 half of this tag is inherited from AF28; the 📐 half —
  the line numbers, the sample's contents, the call paths — is this session's,
  from reading the files. AF28's text is left unedited, per this file's
  append-only convention.

  **Three levels of evidence, kept apart on purpose.** They are not equally
  strong, and collapsing them is how this correction would become an overclaim:
  **(A) parse/compile on-device** — proven; **(B) invocation on-device** —
  proven from the code path; **(C) a correct match isolated in AF28's recorded
  output** — *not* witnessed, for either feature, for the reason given under
  each below.

  **(1) Regex lookbehind (AF12 #1) — level A proven for all four literals,
  level B proven for the two asterisk literals.**
  *Level A.* `markdown.ts`'s four emphasis regexes are module-level `const`s —
  `BOLD_UNDERSCORE`/`ITALIC_UNDERSCORE` at lines **62–63** (`(?<!\w)`) and
  `BOLD_ASTERISK`/`ITALIC_ASTERISK` at lines **70–71** (`(?<!\s)`), read from
  the file this session. AF12 #1 is what makes this load-bearing: a regex
  literal the engine cannot parse fails at **module load**, not at call time.
  AF28 records `parseMarkdown` returning a 12-block, 176-word document, and the
  probe screen wraps that call in a `try`/`catch` that renders "parseMarkdown
  threw" on failure (`src/app/index.tsx`) — the success branch is what was
  observed. So `markdown.ts` loaded, so device Hermes **parsed all four
  lookbehind literals**, the two `(?<!\w)` forms included. This retires exactly
  the hazard AF12 #1 named as the sharpest of the four — "it would take out the
  whole markdown parser rather than one edge case."
  *Level B.* `src/core/ui/sample.ts` was checked directly rather than assumed:
  its template literal contains five asterisk emphasis spans — `**Reader**`,
  `*plain Markdown*`, `**Bionic rendering**`, `**A WPM pacer**`, `**Presets**`
  — and `stripInline` is called on every block's text (`markdown.ts:121` for
  body text, `:158` for headings), running the four `.replace()` calls at
  **98–101**. So `BOLD_ASTERISK` and `ITALIC_ASTERISK` were **invoked on-device
  against input containing valid spans**, and their `(?<!\s)` assertion was
  evaluated there.
  *Level C — what was NOT witnessed.* AF28's recorded observables are block
  count (12), word count (176), and the first twelve words' ids and texts.
  **None of them can distinguish a correct emphasis match from a failed one**:
  stripping changes a word's *text*, never the token count (`**Reader**` is one
  whitespace-delimited token either way), and the first twelve words —
  `The Reading Aid Tool A short sample so you can see the` — contain no
  emphasis. What Node-identity does show is weaker but real: `markdown.ts`
  pushes a block only `if (text)` (lines 122, 145, 160), so `stripInline` ran to
  completion twelve times without throwing and without emptying a block. "The
  asterisk lookbehinds matched correctly on-device" is therefore an
  **inference**, not an observation.
  *The underscore variants reached level A only.* The sample's template literal
  contains **no underscore at all** — the single `_` in `sample.ts` is in the
  identifier `SAMPLE_MARKDOWN` on line 2, to the left of the opening backtick,
  outside the string. `BOLD_UNDERSCORE` and `ITALIC_UNDERSCORE` were invoked
  (lines 98 and 100 run unconditionally per block) but had nothing to match, so
  their `(?<!\w)` assertion is confirmed **parsed**, not confirmed **satisfied**.

  **(2) Unicode property escapes (AF12 #2) — PARTIALLY exercised, and the three
  escapes did not fare alike.** AF12 #2 is a single bullet covering three
  distinct escapes; treating it as one unit is what makes a flat "two of four"
  misleading.
  - **`\p{L}` — levels A and B.** `model/tokenize.ts:26` is
    `const WORDLIKE = /[\p{L}\p{N}]/u;` and `tokenize.ts:80` evaluates
    `WORDLIKE.test(piece)` for **every** piece of every token — the every-word
    path, confirmed by reading `tokenize()`, not assumed from AF28's prose. AF28
    records 176 words, so that test ran at least 176 times on device Hermes.
    Level C is again absent: `isWordlike` is consumed only by `pacer/dwell.ts`
    (lines 69, 72, 81), which did not run on-device, and the probe screen prints
    only `{id, text}` — so the boolean `WORDLIKE` produced was never observed,
    and it does not affect the word count either (every piece is pushed
    regardless).
  - **`\p{N}` — level A only, and the miss is total.** The sample's template
    literal contains **zero digit characters** (checked this session), so the
    `\p{N}` half of `WORDLIKE`'s character class never classified anything.
    `DIGIT` (`tokenize.ts:30`, `/\p{N}/u`) fared worse still: it is reached only
    at `tokenize.ts:53`, inside `splitDashRuns`, and only once a dash run is
    found with non-empty text on **both** sides. All five em-dashes in the
    sample are standalone whitespace-delimited tokens, so `runStart === 0`,
    `hasBefore` is false, and the loop `continue`s before line 53 — **`DIGIT`
    was almost certainly never invoked at all** on the AF28 run. `\p{N}` is
    confirmed parseable by device Hermes and nothing more.
  - **`\p{M}` — not exercised at any level.** `pacer/orp.ts:36`
    (`const COMBINING_MARK = /\p{M}/u;`); `orp.ts` has never run on-device.

  **(3) `normalize('NFC')` and (4) `matchAll` — untouched by AF28, exactly as
  AF28 says.** `pacer/orp.ts:137` (`text.normalize('NFC')`) and
  `parsers/epubStructure.ts:90, 99, 160, 183` (`matchAll`); neither module has
  run on-device. Line numbers confirmed from the files this session.

  **Residue after this correction — three of AF12's four still unexercised
  on-device, plus two adjacent gaps named so they are not lost:**
  1. `\p{M}` — `src/core/pacer/orp.ts:36`.
  2. `String.prototype.normalize('NFC')` — `src/core/pacer/orp.ts:137`.
  3. `String.prototype.matchAll` — `src/core/parsers/epubStructure.ts:90, 99,
     160, 183`.
  4. *(adjacent — not one of AF12's four)* `\p{L}` in
     `src/core/reader/bionic.ts:31` (`const LETTER = /\p{L}/u;`) is likewise
     unexercised on-device. It is the same feature class as item 1 above and
     sits in a seeded module, so a device probe covering `orp.ts` should not
     stop short of it. That `\p{L}` works in `tokenize.ts` on-device is strong
     evidence it works in `bionic.ts` too — but that is inference, not a run.
  5. *(adjacent)* `\p{N}`'s **matching** behaviour, per (2) above: compiled
     on-device, never handed a digit. Any device probe fed a document
     containing digits closes this incidentally.

  **Grapheme clustering is NOT one of AF12's four and must not be counted as
  residue.** AF12 names `Intl.Segmenter` as explicitly *not* a risk: `orp.ts`
  hand-rolls its own grapheme clustering precisely because Hermes keeps
  `Intl.Segmenter` on a permanent test262 skip list, and the avoidance is
  deliberate and documented in that source file. There is no `Intl` dependency
  to verify on-device because there is no `Intl` call to make.

  **What this entry does not do.** It adds no device coverage, upgrades no
  earlier entry's status, and leaves AF28 as written. AF26 stays open on its
  points 1 and 2 (the desktop CLI has no platform `Intl` backend; the runtime
  evidence sits on a VM about a year behind the shipping engine) — neither is
  touched here.

## Stage 1 acceptance probe — AD21, AD22 and AD23's pending device evidence

> Scope warning that governs this whole section: **two distinct surfaces
> produced these numbers and they are NOT merged into ranges.** Every figure
> is attributed to the surface that produced it. The physical-device and
> emulator runs are reported separately throughout, because AF35 below
> establishes that for frame timing they are not interchangeable.
>
> All device and emulator observations were witnessed by the project owner on
> running hardware and reported to me. **I did not run either surface** and
> cannot reproduce any of it from a Claude Code session — recorded the same
> way AF27/AF28/AF31 record owner-witnessed evidence. The 👁 half of each tag
> below is inherited; any 🧪 half is mine, from this session.
>
> The instrument was a throwaway probe screen at `src/app/index.tsx`, built
> for this purpose: no parser, no `usePacer`, no `ScrollView`, no storage, so
> that a failure could only be attributed to the highlight mechanism itself.
> It was replaced by the reader screen in stage 4.

- **AF32** 👁 — **AD21's per-tick highlight mechanism is PROVEN ON PHYSICAL
  HARDWARE: the highlight advances with ZERO React re-renders.** This is the
  acceptance probe AD21 recorded as pending, and AD21 explicitly stated "The
  mechanism is chosen, not proven. … Nothing in AD21 was executed." It is now
  executed.
  The probe rendered ~20 word boxes — a `flexWrap` `View` of `Animated.Text`
  nodes, each deriving its background from one Reanimated shared value on the
  UI thread — and advanced that value on a `requestAnimationFrame` loop. A
  `useRef` counter incremented in the component body was displayed on screen.
  **Physical device, two independent runs:** run A, **960 frames / 47 word
  advances**; run B, **379 frames / 19 word advances** — **1339 frames and 66
  advances in total**. In both runs the render counter **never moved on its
  own**, and moved by **exactly one per tap** of the negative-control button.
  **Emulator, second run:** 126 frames / 7 advances, one render per tap.
  **Run B's render total was 7, and that is not a regression.** The counter is
  a *tap* count, not a reconciliation count: the negative control was tapped
  seven times and the counter read seven. Run A's total of 1 corresponds to one
  tap. A future reader comparing "1" against "7" across the two runs would
  otherwise reasonably suspect the mechanism had started re-rendering.
  **Why the negative control matters.** A counter frozen at 1 is consistent
  with two very different situations — the mechanism working, or the counter
  being broken. The button forces exactly one render, so the frozen reading is
  only trusted because the same instrument was shown to be capable of moving.
  This follows AF21's precedent of validating a probe against controls before
  trusting a green result.
  **Direct hardware evidence, not inference.** This is not the emulator result
  extended to the device by engine equivalence — the counter was read on the
  phone, in both runs.

- **AF33** 🧪👁 — **AF31 residue item 4 is CLOSED: `\p{L}` at
  `src/core/reader/bionic.ts:31` works under device Hermes.** AD23 promoted
  this from "adjacent" to MVP-blocking when bionic returned to scope, and
  required the acceptance probe to exercise bionic rendering on a real device.
  The evidence is deliberately split by level, following AF31's own
  three-level discipline, because the two surfaces did not produce the same
  kind of evidence:
  **Emulator — level C (a correct match observed).** All five split samples
  matched the expected `lead`/`head`/`tail` decomposition **exactly**,
  confirmed by screenshot: `quick`→`«»/«qui»/«ck»`, `(e.g.`→`«(»/«e»/«.g.»`,
  `éclair`→`«»/«écl»/«air»`, `अक्षर`→`«»/«अक»/«्षर»`,
  `2026`→`«»/«»/«2026»`. Those five expectations were computed **by me** this
  session by esbuild-bundling the real `src/core/reader/bionic.ts` and running
  `splitBionic` under Node (🧪), then printed on the probe screen, so the
  device comparison was against a pre-committed value rather than a judgement
  made after seeing the output.
  **Physical device — level A (parsed) and visible bionic rendering only.**
  The screen rendered and bionic bolding was visible in the word-box layout.
  Because an unparseable regex *literal* fails at **module load** rather than
  at call time (AF12 #1), a rendered screen is proof that `/\p{L}/u` **parsed**
  on hardware, and visible bolding is proof `splitBionic` ran and produced a
  non-empty `head`. **The device split table was NOT transcribed, so it is not
  claimed that the device reproduced the five-way table.**
  **Why the emulator match carries.** The two surfaces run the same arm64
  Hermes build from the same Expo SDK 57 / RN 0.86.3 project, so a Unicode
  property-escape match is an engine-level behaviour, not a
  hardware-dependent one — stated explicitly rather than elided, because the
  inference is what does the work here.
  **`अक्षर` is the strongest of the five**, and the reason is worth recording:
  its virama (U+094D) is Unicode category **Mn**, a combining mark, not a
  letter. `head=«अक»` therefore proves `\p{L}` correctly returned **false**
  for a combining mark sitting adjacent to letters — not merely that it
  matched *something*. A `\p{L}` that over-matched would have produced a
  different, longer head.

- **AF34** 👁 — **NEGATIVE RESULT: `requestAnimationFrame`'s callback
  timestamp and `performance.now()` share a time base on real hardware, so
  the anticipated clock skew DOES NOT OCCUR and AD22's ported clock needs no
  patch.** Recorded as a negative result following **AF30**'s precedent, so
  it is not mistaken for a fix or for a hazard that was found.
  The concern was specific and structural, not hypothetical: the ported
  `usePacer` seeds `lastRef` from `performance.now()` (web line 175) and then
  differences it against rAF's `now` argument (web line 130). If those were
  different time bases, the **very first frame delta** would be garbage — a
  large jump or a stall — and AD22 stated that "if React Native's timing
  source or backgrounding behaviour differs materially from the browser's …
  the port becomes a rewrite." AD22 asserted both primitives from vendor
  documentation and measured neither.
  The probe sampled both clocks at the same instant on the first frame and
  reported the difference. **Physical device: −0.12 ms (run A) and −0.13 ms
  (run B).** **Emulator: −0.07 ms.** Sub-millisecond on every surface, i.e.
  the same time base. Both primitives were also confirmed present rather than
  assumed: the probe printed their availability and reported
  `clock in use: performance.now()`, meaning its `Date.now()` fallback was
  never taken.
  **Consequence:** AD22's seeding assumption is verified rather than silent,
  and the four-line port stands as ported. Nothing about the clock needed
  changing.

- **AF35** 👁 — **Emulator frame timing is NOT a proxy for device frame
  timing. This is the measurement that establishes it for this project.**
  Recorded as a finding in its own right because it changes how every future
  performance observation in this repo must be read.
  **Physical device — essentially locked 60 fps.** Run A: mean **16.62 ms**,
  min 4.34, max **31.03**. Run B: mean **16.82 ms**, min 3.85, max **33.98**.
  A 60 fps frame is 16.67 ms, so both means sit on it, and both maxima are
  roughly **one dropped frame**.
  **Emulator — a stall that never occurred on hardware.** Second run: mean
  **19.93 ms**, min 8.33, max **120.82 ms**. That maximum is about **seven
  frames** at 60 fps, and nothing like it appeared in either device run.
  **Why this matters beyond one number.** AD24 `D-G` settled "no
  virtualization for the MVP" with an explicit revisit trigger — "the first
  document that visibly stutters on scroll, or takes more than a moment to
  mount." A 120 ms stall observed on an emulator would trip that trigger and
  would be **the wrong signal**: it is an artifact of the surface, not of the
  document or the mechanism. The trigger must be evaluated on hardware.
  **Device figures are the operative ones** for every frame-timing claim in
  this repo; emulator figures are recorded separately and must stay separate.
  Note the direction of the asymmetry: the emulator is *pessimistic* here, so
  it can raise false alarms but is unlikely to hide a real device stall.

- **AF36** ❓ — **Probe question (d), word-box layout acceptability, is
  DEFERRED — not failed, and not passed.** No tuning ruling has been made, and
  the reason is that the instrument is not the artifact.
  The probe was **22 hard-coded words at 19 px on an otherwise empty screen**,
  with no headings, no paragraph spacing, no scroll and no reading density.
  The reader surface is a **full document** with heading sizes 36/27/21/18/15/12
  against a 19 px body, web's block margins (28.8 / 9.6 / 17.6), a
  `ScrollView`, and auto-scroll following the active line. Judging the second
  against measurements taken on the first would be guessing at a visual
  question, so no ruling was made rather than a weak one being recorded.
  **Stage 4 therefore ships with the current `LAYOUT` values unchanged**, and
  tuning happens once the real reader is on screen. That is a one-place edit:
  `src/reader/palette.ts`'s `LAYOUT` export is the single source of every
  spacing and type value the surface uses, which is why the probe's `TUNING`
  block was carried forward into it rather than scattered across `WordBox` and
  `ReaderSurface`.
  One value is already knowingly divergent from web and is the most likely
  first thing to revisit: `LAYOUT.bodyFontSize` is **19**, whereas web's
  `index.css:629` is `1.125rem` = **18**. 19 was chosen so that the probe's
  pending (d) ruling would transfer to the surface without a translation step.

## Process — concurrent-session incident

- **AF37** 🧪📐 — **Two Claude Code sessions wrote this branch simultaneously
  and each destroyed the other's work. Recorded as an observation, not a
  decision: nothing was chosen here, something happened.**

  **Cause.** Two prompts intended for two different windows were issued in a
  single chat message, without labels that unambiguously assigned each to a
  window. Both were acted on, in the same working directory, on the same
  branch, at the same time.

  **What each session destroyed.**
  - The other session **deleted the stage 1 acceptance probe**
    (`src/app/index.tsx`), replacing it with a 15-line stage 4 wiring. That
    probe was the *only* instrument for collecting the (c) and (d) device
    readings, which at that moment were still outstanding.
  - This session **truncated a `src/reader/palette.ts` it had not created**, by
    writing with `cat >` without first checking whether the path existed.
    `cat >` truncates in place. This was my error, not a collision artifact.

  **A third failure, and the most serious of the three.** The other session
  appended an **AD entry to `DECISIONS.md` asserting that the layout values
  "was hand-tuned on-device and represent the MVP's accepted visual
  baseline."** No device tuning had occurred: probe question (d) was — and per
  AF36 still is — **deferred with no ruling made**. It also cited
  `index.css:634-643` where the rule runs to 644. That entry was **reverted
  rather than merged**, and a corrected AD26 written in its place.

  **Three operational lessons.**
  1. **One Claude Code session per repository at a time.** Two agents in one
     working tree have no shared lock, no awareness of each other, and no merge
     step — the tree is the only shared state, and last write wins.
  2. **Check whether a path exists before writing to it.** `cat >` truncates
     silently, and an untracked file has no git history to recover from. Both
     halves matter: the redirect is destructive, and `??` in `git status` means
     there is no safety net.
  3. **A decision-log entry asserting an event that did not happen is the most
     corrosive possible failure in an append-only file.** Code that is wrong
     gets caught by `npm run check`. A false `AD`/`AF` entry is caught by
     nothing, is never rewritten by convention, and is treated as ground truth
     by every later reader — including by future sessions reconstructing why a
     choice was made. The invented device-tuning claim would have justified
     skipping the real (d) ruling forever.

  **How it was detected**, recorded because neither signal is obvious: `ps`
  showed a **second `claude` process (PID 25107)** started roughly three
  minutes before the foreign files appeared, and `stat` **birth times** proved
  truncation rather than creation — `src/reader/palette.ts` reported
  `birth=09:08:01` against `mod=09:13:55` on the same inode, i.e. the file
  pre-existed the write that emptied it. Modification times alone would not
  have shown this; a same-inode birth/modify mismatch is what distinguishes "I
  created this" from "I overwrote someone".

  **What made the revert reversible.** Every foreign artifact — the deleted
  `ReaderSurface.tsx`, the foreign `index.tsx`, and the foreign AD entry as a
  patch — was **copied into the session scratchpad before anything was
  reverted**, so the revert destroyed no information and remained undoable.
  Nothing was discarded on the assumption it was wrong.

  **Not claimed:** that any of this reached a commit. Both sessions' work was
  uncommitted throughout, which is why the foreign `DECISIONS.md` entry could
  be reverted with `git checkout --` rather than needing an append-only
  correction entry of its own.

## Auto-scroll, and the AF36 ruling

> Scope warning that governs this whole section: **every device and emulator
> observation below was witnessed by the project owner on running hardware and
> reported to me. I ran no device and no emulator at any point**, and cannot
> reproduce any of it from a Claude Code session — recorded the same way
> AF27/AF28/AF31/AF32-AF36 record owner-witnessed evidence. The 👁 half of each
> tag is inherited; any 📐 or 🧪 half is mine, from this session.

- **AF38** 👁📐 — **Auto-scroll: the mechanism, and its acceptance. Written
  because this is the only MVP mechanism whose acceptance lived in a change-log
  sentence rather than an entry of its own**, and it has no headless coverage at
  all — it is pure UI-thread behaviour, so there is nothing a Node suite can
  bundle. Absent this entry, the one mechanism with no test would also have been
  the one with no finding.

  **The mechanism, read from `src/reader/ReaderSurface.tsx` and
  `src/reader/WordBox.tsx` this session** 📐:
  - **Per-word Y from `onLayout`, and Y ONLY.** Each word box reports its
    **block-relative** Y; each block reports its own Y. No x, no width, no rect
    is ever read — deliberately, and the restraint has a consequence recorded in
    AD28: click-to-jump's rejected mechanism (b) would need x and width, so it
    has no existing data to reuse.
  - **Absolute Y = block Y + word-relative Y**, resolved through
    `buildWordBlockMap` (`prepareDocument.ts`), which is keyed by the same flat
    `Word.id` index and introduces no second numbering scheme.
  - **`useAnimatedReaction` on `currentIndex`** — the shared value, and nothing
    else, is what can trigger a scroll.
  - **`scrollTo` through `useAnimatedRef`**, so the scroll is issued on the UI
    thread without round-tripping through React.

  **The line-change test, and why `lastScrolledY` was chosen over comparing
  against the previous index.** A line change is "the active word's absolute Y
  differs from the Y we last scrolled for". Words on one line share a Y, so a
  same-line advance compares equal and does not scroll. The rejected
  alternative — remember the previous index and compare its Y — fails on a
  **seek**, which AD28 has now made a first-class gesture: after a tap the
  previous index can be anywhere in the document, possibly off-screen, so "did
  the line change relative to the previous word" is not the question worth
  asking. `lastScrolledY` asks the one that is: **is the viewport already
  anchored on this line?** It is initialised to `-1` so the first positioned
  word does scroll.

  **The four no-op guards**, each covering a way the Y map can be unusable, and
  each required to no-op rather than scroll somewhere wrong — layout arrives
  asynchronously, so a partially measured document must never jump 📐:
  1. `index < 0` — an empty document, where `nearestWordlike` yields -1.
  2. `index >= ys.length` — the map absent or shorter than the index, the
     mount-time race.
  3. `y === undefined` — a hole in the array.
  4. `y < 0` — the `-1` "measured yet?" sentinel the map is filled with.

  **CLAUDE.md guard 3 holds STRUCTURALLY, not by discipline — and that is the
  strongest thing this entry records.** Guard 3 says a mounted-range or
  viewability callback may never trigger a scroll, and names it "the constraint
  most likely to be violated silently during a port, because the callback has a
  different name and an innocent-looking signature." Here there is **no such
  callback to violate**: a grep across all of `src/` for
  `onViewableItemsChanged`, `viewabilityConfig`, `onRangeChange`, `onScroll`,
  `onMomentumScroll`, `onContentSizeChange` and `useScrollViewOffset` returns
  **nothing** 📐 (run this session). The only input that can cause a scroll is
  `currentIndex`. Web's `onRangeChange` — which carries the identical hazard and
  is why guard 3 is worded as it is — has no counterpart in this code.

  **Coalescing, and the quadratic reason for it.** Mounting a document fires one
  layout event per word **plus** one per block, and each arrival could rebuild
  the absolute-Y array; rebuilding per event would be **O(n) work n times, i.e.
  quadratic** in word count. So a rebuild is coalesced behind a single
  `setTimeout(0)` guarded by a `publishPendingRef` flag: many layout events
  collapse into a handful of O(n) passes. The raw layout inputs are held in
  **refs**, not state, so React does not re-render on layout either 📐.

  **Acceptance.** The project owner ran the built app on a **physical device**
  and on an **emulator** and reported **auto-scroll following the active line**,
  alongside reading position resuming across a full app close, Restart working
  at end of document, the paste box parsing, and the WPM control functioning.
  **I witnessed neither run.** That report is the whole of the 👁 evidence here,
  and it is qualitative — "it follows the active line" — not a measurement.

  **What is NOT established, stated plainly:**
  1. **No measurement of scroll behaviour at book length.** The seeded sample is
     **176 words** (AF28, AF31); AD24 `D-G` estimates a book chapter at roughly
     **3,000-5,000**, itself an estimate rather than a measurement. `D-G`'s
     revisit trigger — "the first document that visibly stutters on scroll, or
     takes more than a moment to mount" — has **never been evaluated**, and per
     **AF35** it must be evaluated on **hardware**: the emulator produced a
     120.82 ms frame (about seven dropped frames at 60 fps) that no device run
     came near, so an emulator stall would trip the trigger for the wrong
     reason.
  2. **No rotation or font-scale re-measurement testing.** Every Y in the map
     comes from an `onLayout` at mount. Rotation and a system font-scale change
     both reflow the surface, and nothing here has been exercised across either.
  3. **No evidence about whether it fights manual scrolling**, beyond the
     structural argument above that nothing but `currentIndex` drives it. The
     argument is strong — there is no callback that *could* fire on a user
     scroll — but it is an argument, not an observation.
  4. **One residual the code makes visible on inspection** 📐, recorded here
     rather than fixed: manually scroll the anchored line off-screen, then seek
     to a word **on that same line** (AD28's tap makes this reachable), and the
     Y compares equal to `lastScrolledY`, so **no scroll fires** and the
     highlight stays off-screen until the next line change. Also
     `lastScrolledY` is not reset when the document changes, so a stale Y from
     the outgoing document is compared against the incoming one's first word;
     in practice the two differ and a scroll to the top does fire, but that is
     an argument about likely values, not a guarantee. Both are fixable only by
     letting something other than `currentIndex` influence scrolling, which is
     what guard 3 forbids.

- **AF39** 👁 — **AF36's deferred ruling is RESOLVED: the project owner judged
  the real reader surface acceptable for the MVP on a physical device and an
  emulator. SHIP AS IS.** AF36 recorded stage 1 probe question (d) — word-box
  layout acceptability — as "DEFERRED — not failed, and not passed", with no
  tuning ruling made, on the explicit grounds that "the instrument is not the
  artifact": the probe was 22 hard-coded words at 19 px on an otherwise empty
  screen, while the reader is a full document with heading sizes, block margins,
  a `ScrollView` and auto-scroll. AF36 said the ruling waits for the real
  surface. The real surface has now been on screen.

  **What was judged**, as reported: **word gaps, line spacing, highlight
  strength and body size**, all acceptable for the MVP. So `bodyFontSize` stays
  **19** — the value AF36 flagged as knowingly divergent from web's 18 and "the
  most likely first thing to revisit" — and `wordGapH`/`wordGapV`,
  `wordPadH`/`wordPadV`, `bodyLineHeight`, `highlightOpacity`,
  `highlightRadius`, the block margins and `scrollTopInset` all stay as they
  are. **Nothing was retuned.** The only `LAYOUT` values that change in the same
  session are the heading sizes, and those change to fix AD26's shipped defect
  rather than as tuning; that decision is **AD29**, and the ruling recorded here
  is what let it proceed without a translation step.

  **Why this is an AF and not part of AD29.** The ruling is owner-witnessed
  device evidence — something that *happened* on hardware — whereas the values
  that change as a result are a choice. Keeping them apart follows this file's
  own precedent for status changes to earlier entries: AF27 supersedes AF5's
  belief with a device observation, and AF31 corrects AF28's scope without
  editing it. **AF36's text is left unedited**, per this file's append-only
  convention.

  **Not claimed, and the limits are the same ones AF32-AF36 carry.** This is a
  **qualitative aesthetic judgement**, not a measurement: no frame timings, no
  layout metrics and no screenshots were transcribed for it, and I saw neither
  surface. It covers the **seeded sample document only** — 176 words, one `#`
  and one `##` and no deeper heading (`sample.ts:2`, `:8` 📐) — so it says
  nothing about how the surface reads at book length, nor about the heading
  levels AD29 changes, **none of which the sample renders**. And every device
  observation this repo holds remains a **debug** build observation: AF27 and
  AD24 `D-L` both record that nothing here speaks to release-mode behaviour.

## Click-to-jump acceptance

- **AF40** 👁📐 — **AD28's pending acceptance check is CLOSED: the structural
  prediction about responder transfer was borne out on both surfaces.** AD28
  recorded the drag-scrolls-rather-than-seeks property as "a STRUCTURAL claim,
  not a device observation" and named the on-device drag test as its pending
  acceptance check. That check has now been run. **AD28 is not edited** — this
  entry closes its pending item the way AF31 corrected AF28's scope without
  touching AF28's text, and the cross-reference runs in this direction only.

  **What the structural read predicted, and exactly what kind of claim it was.**
  Two lines of `react-native`, read out of **this repo's own `node_modules/`**
  rather than from vendor documentation:
  `Pressability.js:526-529`'s `onResponderTerminationRequest` returns
  `cancelable ?? true`, and `Text.js:449-452` passes a `Text`'s own
  `onResponderTerminationRequest` through to it, falling back to Pressability's
  handler when none is supplied 📐. The predicted consequence: because the
  default is to permit termination, the enclosing `ScrollView` can take the
  responder **mid-touch**, so a drag that begins on a word becomes a scroll and
  the press is cancelled — i.e. AD28's mechanism (a), one touch responder per
  word box, does not break scrolling. **That was a read of source code. It was
  never a device observation, and this entry does not retroactively make it
  one** — what changed is that a device observation now exists alongside it.

  **The prediction was borne out.** The responder transfer behaves as the source
  implied, on **both** the physical Android device and the emulator. A drag
  beginning on a word scrolls; it does not seek.

  **Scope — the four checks, and they are not all about the same thing.** That
  distinction matters, because only the first closes the structural prediction:
  1. **A drag starting on a word scrolls rather than seeking.** This is the
     responder-transfer prediction above, and the one AD28 flagged as pending.
  2. **A tap on the last word leaves the transport reading Restart.**
  3. **A tap backwards from the end restores Play without Restart.**
  4. **A tap while playing changes position without stopping.**

  Checks 2 and 3 exercise the end-of-document behaviour AD28 chose to let fall
  out of `usePacer` unchanged — `startedRef` deliberately not cleared in `seek`
  (F23/D89, `usePacer.ts:94-99`), `play()`'s guard at `:190`, and `commit`'s
  `atEnd` recomputation at `:111-119`. AD28 predicted both from **reading** that
  file, not from running it, so these are two more structural predictions
  confirmed rather than a single one. Check 4 confirms the seek-only ruling
  holds in the playing state, which is the direction of it that is easiest to
  get wrong.

  **GRANULARITY — the honest limit of this evidence, stated rather than
  elided.** What was reported is that **testing passed on both surfaces**
  against the four named checks. It was **not** a per-check transcript: no
  individual observation, no timing, no frame figure, no counter reading and no
  screenshot was reported for any of the four, and **none is invented here**.
  Two consequences follow and are recorded rather than smoothed over. First,
  this evidence is **materially weaker than AF32's and AF33's**, which carried
  transcribed counter readings and an exact five-way split table respectively;
  this is a pass/fail report, not an instrumented one. Second, because there is
  no per-surface breakdown, this entry **cannot say which surface exhibited
  what** — only that both were reported passing. Anyone later needing per-check
  or per-surface detail must re-run; it does not exist.

  **Attribution.** The project owner ran the built app on the physical Android
  device and on the emulator and reported the result. **I witnessed neither run
  and ran no device or emulator at any point.** The 👁 half of this tag is
  therefore inherited, exactly as in AF27/AF28/AF31/AF32-AF36/AF38/AF39; the 📐
  half is mine, from reading `Pressability.js` and `Text.js` in this tree.

  **What is NOT established:**
  1. **No measurement at book length.** The seeded sample is **176 words**
     (AF28, AF31). Mechanism (a) mounts **one Pressability instance per word**,
     and that per-word cost is precisely what web's single delegated handler
     avoided and what AD28's rejected mechanism (b) would avoid — so it is the
     one property of this choice that most needs a large document, and it has
     never seen one. AD24 `D-G`'s revisit trigger applies here as much as to
     scrolling, and per **AF35** it must be evaluated on **hardware**, not on
     the emulator.
  2. **No rotation or font-scale testing.** Same gap AF38 records for
     auto-scroll: word boxes are measured by `onLayout` at mount, and neither
     reflow has been exercised — nor has tapping after one.
  3. **Nothing about tap behaviour under a document larger than the seeded
     sample**, including whether hit accuracy or mount cost changes with word
     count. Relatedly, AD28's recorded touch-target limitation — a body word box
     is about **32 dp** tall against Android's 48 dp guidance, with no `hitSlop`
     because slop would overlap adjacent words — is **not addressed by this
     evidence**. No mis-taps were reported, but nothing was measured, and the
     absence of a complaint is not a measurement.
  4. **Still a debug build.** Every device observation this repo holds is a
     debug development build (AF27), and AD24 `D-L` records that the MVP's
     delivery artifact is a **release** APK on a configuration nothing has
     verified. This entry does not narrow that gap.

  The AF38 residuals are untouched by this run: the seek-to-a-word-on-a-
  manually-scrolled-away-line no-op, and `lastScrolledY` not being reset on
  document change, were neither exercised nor reported on.

## Second prebuild — app identity, and zero template drift

- **AF41** 🧪📐 — **The repo's SECOND `expo prebuild` ran deliberately clean,
  destroyed and regenerated all 54 files under `android/`, and produced ZERO
  drift in `android/app/build.gradle` against the copy AD17's prebuild left
  behind on 2026-09-01.** Recorded because a prebuild is a destructive,
  rarely-run action whose outputs nothing in this repo tracks — `android/` is
  gitignored — so if it is not written down here it is not written down
  anywhere. Unlike almost every device-flavoured entry above, **this one was
  executed by me**, in this session, on this machine; no emulator, device or
  Gradle build was involved, and none is claimed.

  **Pre-flight: `android/` held no hand edits, established mechanically rather
  than assumed.** Before running anything, every non-build file under
  `android/` was stat'd for modification time:

  ```
  $ find android -type f -not -path '*/build/*' -not -path '*/.gradle/*' \
      -not -path '*/.cxx/*' -exec stat -f "%Sm %N" -t "%Y-%m-%d %H:%M" {} \; \
    | grep -v "^2026-09-01 09:47 "
  (no output)
  in-window: 54    total non-build: 54
  ```

  All 54 files sit inside a **two-second window** (09:47:18-09:47:19), which is
  the signature of a single machine-generated write. **The method is the point:
  a hand edit carries an isolated, later mtime**, so a clean 54/54 is positive
  evidence of absence rather than merely a failure to find something. This is
  what made a destructive regeneration safe to run.

  **The command, and what it did.** `npx expo prebuild --platform android
  --no-install`, run once. Output verbatim:

  ```
  - Clearing android
  ✔ Cleared android code
  - Creating native directory (./android)
  ✔ Created native directory
  - Updating package.json
  ✔ Updated package.json | no changes
  - Running prebuild
  ✔ Finished prebuild
  ```

  `clean` is the **default** in SDK 57 (`prebuild/index.js:112`,
  `clean: !args['--no-clean']` 📐), so this deleted `android/` outright —
  including the `build/` and `.gradle` caches — and regenerated it. The
  regenerated tree again contains **54** non-build files. This is the **second**
  prebuild this repo has ever had; AD17's, on 2026-09-01, was the first.

  **`applicationId` survived the regeneration**, verified from the regenerated
  file rather than from `app.json`: `android/app/build.gradle:92` is
  `applicationId 'com.arishh.readingaid'`, with `namespace 'com.arishh.readingaid'`
  at `:90`, `versionCode 1` at `:95` and `versionName "1.0.0"` at `:96` 🧪. So
  AD17's package rename is reproduced by prebuild from `app.json` and is not an
  artifact of the first generation that could have been lost here.

  **The display name landed in both places the `withName` plugin writes.**
  `app.json`'s `name` was changed from `ReadingAidAndroid` to `Reading Aid`
  (one line; `slug`, `scheme`, `version` and `android.package` untouched), and
  the regenerated tree shows:
  - `android/app/src/main/res/values/strings.xml` → `<string name="app_name">Reading Aid</string>` 🧪
  - `android/settings.gradle:34` → `rootProject.name = 'Reading Aid'` 🧪

  Both are predicted by `@expo/config-plugins/build/android/Name.js` —
  `applyNameFromConfig` writes `app_name` verbatim (line 65), and
  `applyNameSettingsGradle` rewrites `rootProject.name` through
  `sanitizeNameForGradle`, which strips only `/ \ : < > " ? * |`, so the space
  survives (lines 43-49, 84-88) 📐. **The APK output filename is unaffected**:
  AGP names the artifact from the **module** (`app-release.apk`), not from
  `rootProject.name`. Not verified by a build — no Gradle was run — so that last
  clause is 📐 reasoning about AGP's naming, not an observed filename.

  **NULL RESULT — zero template drift in `build.gradle`, recorded explicitly per
  AF30's precedent.** The pre-prebuild `android/app/build.gradle` was snapshotted
  to the session scratchpad before the run and compared afterwards. `diff`
  produced **no output**, and both sides hash
  `9eb4b9c8e1c34b6dbf1b3fceeddf8772a4eb0f1f180beb288d322ca129919a4a` 🧪 — **byte
  identical**, line numbers included. So no Expo/RN template change between
  2026-09-01 and 2026-09-02 touched this file, and the signing edit applied
  afterwards sits on exactly the text AD17's prebuild produced. **This is a
  finding, not an absence of one:** had it drifted, the verbatim blocks recorded
  in `RELEASE-SIGNING.md` would have been anchored against stale text on their
  first day. The only two generated files that differ from their snapshots are
  `strings.xml` and `settings.gradle`, each by exactly the one predicted line.

  **NULL RESULT — `package.json` was not modified.** `prebuild` can rewrite it
  (`prebuild/updatePackageJson.js:129-132` writes when dependencies or scripts
  changed 📐), and the plan was to **stop** if it did. It did not: the file
  hashes `ad57f71c252e12bbfa9869f63fbab981de767b68754f017c5dccfd1dd8605d7f`
  both before and after 🧪, matching the CLI's own `Updated package.json | no
  changes`.

  **CORRECTION to a prediction made earlier in this same session: the dirty-git
  guard did not merely fail to block — it never even logged.** The prediction
  was that `maybeBailOnGitStatusAsync` would print `Git status is dirty…` and
  then continue, because `utils/git.js:91` detects a non-interactive terminal
  and returns `false` without prompting. The warning is **absent** from the run
  output above. The reason is one line further up: `utils/git.js:84` returns
  immediately when `env.EXPO_NO_GIT_STATUS` is set, and
  `utils/env.js:87` defines it as `boolish('EXPO_NO_GIT_STATUS', true)` — it
  **defaults to true** 📐, so the function short-circuits before the `warn` and
  before any status check at all. The guard is therefore even more inert than
  described. It could not have protected `android/` in any case: `android/` is
  gitignored (`.gitignore:46`) and so never appears in `git status --porcelain`,
  which is the only signal that function consults. The working tree was in fact
  dirty throughout (`.gitignore`, then `app.json`).

  **What is NOT established.**
  1. **Nothing about the signing configuration was executed.** No Gradle build,
     no `assembleRelease`, no emulator, no device — by direction. The
     `signingConfigs.release` block, the `taskGraph.whenReady` hard-fail and the
     `signingConfig null` fail-safe added to `build.gradle` after this prebuild
     are a **source-level design that has never run**. AD30's acceptance check
     is pending, and it needs both halves: a release build producing a
     certificate other than `CN=Android Debug`, and the negative control of a
     build with `keystore.properties` absent failing with the `GradleException`
     instead of emitting an artifact.
  2. **Nothing about the app on a device.** The display name `Reading Aid` was
     read out of `strings.xml`; **it has not been seen under a launcher icon**,
     so whether it truncates on the project owner's launcher is untested.
  3. **Still no release-mode evidence.** AF26 point 3 and AF27 are untouched by
     this entry — every device observation this repo holds remains a debug
     development build.
  4. **The regenerated tree was not otherwise audited.** Only `build.gradle`,
     `settings.gradle`, `strings.xml` and the file count were compared against
     the snapshots; the other 50 files were not diffed, so "zero drift" is
     claimed **for `build.gradle` specifically**, not for the tree.

## Release signing acceptance — and the first release-mode evidence

> Scope warning that governs this whole section: **the project owner ran every
> command below on their own machine and physical phone and reported the
> results. I ran no Gradle build, no device and no emulator, and I did not see
> the `apksigner` output.** The 👁 half of the tag is inherited, exactly as in
> AF27/AF28/AF31/AF32-AF36/AF38/AF39/AF40; the 📐 half is mine, from reading
> this tree. **AD30 is not edited** — this entry closes its pending acceptance
> check by cross-reference, the way AF40 closed AD28's, and the cross-reference
> runs in this direction only.

- **AF42** 👁📐 — **AD30's pending acceptance check is CLOSED. Both halves ran:
  the negative control failed the build at the right phase, and the real build
  produced a correctly release-signed APK that was installed and exercised on a
  physical phone.**

  **THE NEGATIVE CONTROL FIRST, because it is the stronger of the two results.**
  With `keystore.properties` renamed away, `cd android && ./gradlew
  assembleRelease` reported:

  ```
  BUILD FAILED in 16s
  28 actionable tasks: 28 up-to-date
  ```

  and, at `android/app/build.gradle` **line 124**:

  ```
  Release signing is not configured: keystore.properties not found at
  /Users/dev/.../keystore.properties. See RELEASE-SIGNING.md for the
  keystore.properties template. Refusing to fall back to debug signing --
  that would produce an installable but wrongly-signed APK.
  ```

  **`28 actionable tasks: 28 up-to-date` is the load-bearing line, and it is
  what makes this a stronger result than the successful build.** Zero tasks
  *executed*. Gradle configured the project, built the task graph, threw, and
  stopped — it never compiled, never bundled JS, never packaged, and **never
  produced an artifact of any kind**. That is precisely the phase behaviour the
  guard was designed for.

  **It validates the relocation from a configuration-time throw specifically.**
  AD30 records that the hard-fail was *specified* as a `throw` inside
  `signingConfigs { release { … } }` and was moved to
  `gradle.taskGraph.whenReady` because configuration runs for **every** task, so
  a configuration-time throw would have broken `assembleDebug` and
  `npx expo run:android` on any machine without a keystore. The relocation was
  reasoning, not measurement. It is now measured from three independent
  observations in this one run: the guard **fired at all** (so the
  `/(?i)release/` task-name match found the release tasks in the graph), it
  fired **after configuration and before execution** (28 up-to-date, nothing
  ran), and it **named the missing file by absolute path** (so the
  `keystorePropertiesFile.canonicalPath` interpolation resolved to the repo root
  as designed — `rootProject` being `<repo>/android`). Line 124 corroborates:
  reading the tree, `build.gradle:124` is the first line of the
  `GradleException` message string, inside the `whenReady` closure that opens at
  `:121` 📐.

  **What the template default would have done at this exact moment is the whole
  point.** With `keystore.properties` absent, Expo's shipped
  `release { signingConfig signingConfigs.debug }` would have **succeeded** and
  emitted an installable **debug-signed** "release" APK. Instead the build
  refused. The silent-wrong-artifact failure AD30 exists to prevent was
  reproduced in its trigger condition and did not occur.

  **THE THREE-LEVEL FAIL-SAFE IS NOW MEASURED AT LEVEL ONE ONLY.** AD30 records
  three levels and this run exercised the first two of the three *mechanisms*
  but only the first *failure level*:
  - **Level 1 — the `taskGraph.whenReady` guard throws before execution:
    MEASURED**, by the run above.
  - **Level 2 — `signingConfigs.release` stays unpopulated when the config is
    absent: NOT independently observable here.** It was necessarily in that
    state during the failed run, but the guard threw first, so nothing depended
    on it and nothing about it was witnessed.
  - **Level 3 — `signingConfig null` yielding an UNSIGNED APK that Android
    refuses to install: UNEXERCISED.** Reaching it requires the guard *not* to
    fire while the config is still absent, which did not happen and cannot be
    provoked without deliberately breaking the guard. It remains a
    source-level property 📐, not a measured one.

  So "never a wrong artifact" is now **one-third measured and two-thirds
  structural**, which is stronger than AD30 could claim but weaker than fully
  verified. Stated this way rather than as a blanket pass.

  **THE REAL BUILD.** With `keystore.properties` restored and filled in,
  `./gradlew assembleRelease` **succeeded**, and
  `apksigner verify --print-certs` on the resulting APK confirmed the signing
  certificate is **the project owner's own release key and NOT the Android
  debug key** (`CN=Android Debug`). **No certificate field value is recorded
  here, and none was transmitted to me** — the reported result is the
  identification itself, which is the only part that constitutes evidence.

  **AD24 `D-L`'s delivery requirement is satisfied IN FULL.** The APK was
  **copied manually to a physical Android phone, installed, and tested**, and
  all MVP behaviour worked. `D-L` framed this as a requirement rather than a
  preference — an artifact the project owner **built themselves**, not
  downloaded and not shared, running with **no laptop attached**. A debug APK
  cannot satisfy that, because it expects Metro to serve it JS; `D-L` recorded
  that as ❓ at the time. Every clause is now met, and the ❓ is retired by the
  successful standalone run.

---

  ### This is the FIRST release-mode evidence this repo has ever held

  **AF26 point 3 and AF27 are PARTIALLY SUPERSEDED.** AF26 point 3 states that
  nothing in this repo speaks to "release-mode bytecode precompilation,
  Metro+Babel's actual transform output …, Proguard/R8 interaction, or
  ABI-specific `libhermes.so` behaviour", and AF27 states "Not claimed: anything
  about release builds. This was exclusively a debug development build." AD24
  `D-L` restated the gap and called the first release build "itself a finding
  that will need its own `AF` entry." **This is that entry.** Neither AF26's nor
  AF27's text is edited, per this file's append-only convention.

  **Release-mode Hermes bytecode precompilation WORKS on this device.** The app
  was built with `hermesEnabled=true` (`android/gradle.properties:42` 📐),
  precompiled to bytecode as part of a release build, installed from a manually
  copied APK, and exercised — and all MVP behaviour worked. Every prior device
  observation in this file (AF27, AF28, AF31, AF32-AF36, AF38, AF39, AF40) was a
  **debug development build** with JS served or bundled unoptimised. This is the
  first time the seeded `src/core/` modules, the ported `usePacer`, the word-box
  reader surface and the storage layer have run from **precompiled release
  bytecode** at all.

  **BOUND IT PRECISELY — the Proguard half of AF26 point 3 is UNTOUCHED, and a
  green release build must not be read as covering it.** AD30 pinned this in
  advance and the tree still confirms it: `android/app/build.gradle:69` derives
  `enableMinifyInReleaseBuilds` from
  `findProperty('android.enableMinifyInReleaseBuilds') ?: false`, and that
  property is **absent** from `android/gradle.properties` 📐, so `minifyEnabled`
  at `:178` is **false**. **R8/Proguard did not run.** AF26 point 3 names both
  concerns in one sentence; **this entry closes the Hermes half and leaves the
  Proguard half exactly as it was.** If minification is ever enabled, that is a
  new configuration with no evidence behind it.

  **Also NOT established:**
  1. **No ABI coverage beyond the one device.** The APK is universal across four
     ABIs — `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`
     (`android/gradle.properties:31` 📐) — and exactly **one** of them was
     exercised, whichever the project owner's phone uses. AF26 point 3's
     "ABI-specific `libhermes.so` behaviour" is therefore narrowed to a single
     architecture, not closed. The other three shipped in the artifact untested.
  2. **No measurement of release-mode performance against debug.** Nothing
     comparable to AF32's frame counters or AF35's frame timings was collected,
     so whether release bytecode is faster, slower or indistinguishable here is
     unmeasured. Per **AF35**, any such comparison must be made on hardware
     rather than the emulator.
  3. **No book-length document.** The revisit trigger AD24 `D-G` set — "the
     first document that visibly stutters on scroll, or takes more than a moment
     to mount" — is **still unevaluated**, in release mode as in debug. The
     seeded sample remains 176 words (AF28, AF31). AF38's and AF40's identical
     gaps are unchanged by this run.
  4. **Granularity.** "All MVP behaviour worked" is a **pass/fail report**, not
     a per-behaviour transcript — no timing, counter reading or screenshot was
     reported, and none is invented here. This is the same limitation AF40
     records, and it is weaker evidence than AF32's transcribed counters or
     AF33's split table.
  5. **Metro+Babel's transform output** is exercised in the sense that a release
     bundle was produced and ran, but nothing was inspected or compared, so
     AF26 point 3's mention of it is advanced only incidentally and is not
     claimed as closed.

## Stage 1 probe — the first emulator run, recovered

- **AF43** 👁 — **COMPLETENESS CORRECTION TO AF32: the stage 1 acceptance
  probe's FIRST emulator run is recorded here. AF32 recorded the emulator's
  SECOND run and omitted the first, so until now those figures existed only on
  a screenshot and in a code comment, traceable to no entry in this file.**
  AF32's text is **not edited**, per this file's append-only convention; AF43
  cross-references AF32 and the cross-reference runs in this direction only,
  exactly as AF31 corrected AF28's scope without touching AF28.

  **The reading, as reported.** On an Android emulator, running the stage 1
  acceptance probe screen — the same instrument AF32 describes: roughly twenty
  word boxes in a `flexWrap` `View`, each an `Animated.Text` deriving its
  background from one Reanimated shared value on the UI thread, advanced on a
  `requestAnimationFrame` loop, with a `useRef` render counter incremented in
  the component body and displayed on screen.

  | Figure | Value |
  |---|---|
  | frames | **3557** |
  | ticks (word advances) | **179** |
  | index at tap | **3** |
  | renders at tap | **1** |

  **What "renders at tap: 1" means, because a render count of 1 is easy to
  misread as an instrument that measured nothing.** The on-screen counter is a
  **tap** count, not a reconciliation count. AF32 establishes this explicitly
  when it explains that its own device run B read **7** because the
  negative-control button was tapped seven times — and records that a future
  reader comparing "1" against "7" would otherwise reasonably suspect the
  mechanism had started re-rendering. Here the counter reads **1** against
  **one** tap. So across 3557 frames and 179 word advances the render count
  **never moved on its own**, and moved by **exactly one** when the negative
  control was pressed. That is the same frozen-counter-plus-working-control
  pattern AF32 records, and it carries weight for the same reason AF32 gives: a
  counter that never moves is only trustworthy once the same instrument has
  been shown to be capable of moving.

  **Why these figures were missing, stated precisely so it is not read as an
  error by AF32's author.** The reading was relayed into the instruction AF32
  was written from, and the emulator figures that reached that instruction were
  the **second** run's — 126 frames / 7 advances. **The omission was in the
  instruction, not in AF32's reading of it.** AF32 is accurate about every run
  it describes; it is simply not exhaustive about the emulator, and it never
  claims to be. Nothing in AF32 is wrong and nothing in it needs correcting —
  what was missing was an entry for this run, and this is that entry.

  **Attribution.** The reading was **witnessed by the project owner on a
  running Android emulator and reported from a screenshot**. **I did not run an
  emulator or a device, and I did not see the screenshot** — these figures
  reach this entry as a relayed report, which is one step weaker than the
  transcribed counter readings AF32 carries for its physical-device runs.
  Recorded the same way AF27/AF28/AF31/AF32-AF36/AF38/AF39/AF40/AF42 record
  owner-witnessed evidence: 👁 is inherited, and this entry has **no** 🧪 or 📐
  half — nothing in it was measured, run, or derived by me.

  **SURFACE — this is the EMULATOR, and it is NOT merged with AF32's device
  figures.** AF32's physical-hardware total is **1339 frames and 66 advances**
  across two device runs, and **AF35** establishes for this project that
  emulator and device frame timing are **not** interchangeable — an emulator
  maximum of 120.82 ms against device maxima of 31.03 and 33.98 ms. So the
  3557-frame figure is **not** a larger version of AF32's device evidence and
  must never be quoted as one: it is a longer run on a **different, more
  pessimistic** surface. What it does add is **duration** on the one property
  here that is not timing-sensitive — that no React render occurs on the tick
  path — where a longer run is straightforwardly more of the same evidence than
  a shorter one.

  **What this does NOT establish.**
  1. **No frame timings were reported for this run** — no mean, no minimum, no
     maximum. It therefore contributes **nothing** to AF35, and AF35's
     device-versus-emulator asymmetry is untouched by it.
  2. **Debug build**, like every device or emulator observation in this file
     except AF42's release build.
  3. **Nothing about book length.** The probe rendered roughly twenty
     hard-coded word boxes on an otherwise empty screen, not a document — the
     same limit AF36 states when it records that the instrument is not the
     artifact. AD24 `D-G`'s revisit trigger is untouched here.

  **Where these figures are cited.** `src/reader/WordBox.tsx`'s docblock quotes
  them to justify the static-nested-`Text`-inside-an-animated-box choice. Before
  this entry that citation pointed at no finding; it now points here, and the
  docblock names the surface explicitly so the emulator run and AF32's device
  runs cannot be confused for one another.

## Lint arrives — what it actually found, and what it does not cover

> Scope note that governs this whole section: **unlike almost every entry
> above, everything here was executed by me**, in this session, on this
> machine. No emulator, device or Gradle build was involved and none is
> claimed. The one thing that was **not** run is the CI workflow — see the
> last block.

- **AF44** 🧪📐 — **ESLint's first run on this repo, measured. Three of the
  premises the work was scoped under were false, and the corrections are the
  useful part.** The decisions taken in response are **AD34**; nothing from
  that entry is restated here (AD18).

  **Toolchain, resolved by `npm install --save-dev eslint@^9
  eslint-config-expo` and read out of `node_modules` afterwards** 🧪:

  | Package | Version | How it arrives |
  |---|---|---|
  | `eslint` | **9.39.5** | direct devDependency |
  | `eslint-config-expo` | **57.0.2** | direct devDependency |
  | `eslint-plugin-react-hooks` | **7.1.1** | transitive, `eslint-config-expo` declares `^7.0.0` |
  | `@typescript-eslint/eslint-plugin` | 8.69.0 | transitive |
  | `eslint-plugin-import` | 2.32.0 | transitive |
  | `eslint-plugin-react` | 7.37.5 | transitive |
  | `eslint-plugin-expo` | 1.1.0 | transitive |

  Node v26.7.0, npm 11.19.0, macOS arm64 (Darwin 25.6.0) — the same toolchain
  AF10 records for the suites.

  **CORRECTION 1 — the repo had EIGHT stock-config errors, not seven.** Seven
  are in `src/pacer/usePacer.ts` and every line number given to me was exact,
  confirmed rather than assumed 🧪:

  ```
  ERROR src/pacer/usePacer.ts:78:3    react-hooks/refs
  ERROR src/pacer/usePacer.ts:80:3    react-hooks/refs
  ERROR src/pacer/usePacer.ts:82:3    react-hooks/refs
  ERROR src/pacer/usePacer.ts:84:3    react-hooks/refs
  ERROR src/pacer/usePacer.ts:86:3    react-hooks/refs
  ERROR src/pacer/usePacer.ts:164:46  react-hooks/immutability
  ERROR src/pacer/usePacer.ts:183:5   react-hooks/set-state-in-effect
  ERROR types/hermes-globals.d.ts:19:1  no-var        <-- the eighth
  ```

  The eighth is `declare var console` — **AD4**'s five-method ambient
  declaration. It is **not** in [CORE-DIVERGENCE.md](CORE-DIVERGENCE.md), so
  it could have been edited; it was not, for the reason AD34 gives.

  **CORRECTION 2 — the React Compiler rules do NOT fire because of
  `app.json`.** The scoping stated they fire because `app.json` sets
  `"experiments": { "reactCompiler": true }`. Measured: **`eslint-config-expo`
  contains no reference to `app.json`, `reactCompiler` or `experiments`
  anywhere** 🧪 (swept the whole package, excluding its own
  `node_modules`). The rules come from `eslint-plugin-react-hooks@7.1.1`'s
  `configs.recommended`, which was loaded and read directly: sixteen rules, of
  which `react-hooks/refs`, `react-hooks/immutability` and
  `react-hooks/set-state-in-effect` are each `"error"` **unconditionally** 🧪.
  `eslint-config-expo` spreads that preset wholesale at
  `flat/utils/react.js:27` 📐. `app.json`'s opt-in is real and governs the
  **Metro/Babel build**; there is simply no path from it to ESLint. Recorded
  because **AF37** names a log entry asserting an event that did not happen as
  the one failure mode nothing in this repo can catch.

  **CORRECTION 3 — `no-console`'s real subject is the `.mjs` harnesses, not
  `epubStructure.ts`.** With `allow: ['warn']`, the two intentional warns at
  `src/core/parsers/epubStructure.ts:104` and `:193` (manifest row 7) are
  silenced and **never appear**: measured **zero** `no-console` hits in any
  `.ts`/`.tsx` file 🧪. The real count is **61**, every one a `console.log` or
  `console.error` in the fourteen `.mjs` files — the calls that print each
  `PASS`/`FAIL` line and every tally `npm run check` reports.

  **Full Level 2 measurement before any override was applied — 82 problems**
  🧪:

  ```
    61  no-console        (61 in .mjs, 0 in .ts/.tsx)
    13  import/order      (all 13 in .mjs; identical idiom, `esbuild` before `node:path`)
     5  react-hooks/refs
     1  react-hooks/immutability
     1  react-hooks/set-state-in-effect
     1  no-var
  ```

  **Nine of the thirteen `import/order` files are manifest-pinned** (rows
  13–20 and row 25) 📐, which is what made a config override the only
  available answer rather than the convenient one.

  **A hard config constraint, measured rather than reasoned about.**
  `eslint-config-expo` registers the `@typescript-eslint` plugin only inside a
  `files: ['**/*.ts', '**/*.tsx', '**/*.d.ts']` block 📐, so naming one of its
  rules in an unscoped block does not degrade — ESLint refuses to start:
  *"A configuration object specifies rule
  `@typescript-eslint/no-unused-vars`, but could not find plugin
  `@typescript-eslint`"* 🧪. Also worth recording: stock sets
  `@typescript-eslint/no-unused-vars` to **`warn`**, so escalating it to
  `error` is a real change, not a restatement.

  ### The result, and its coverage

  **`npm run lint` exits 0 with 0 errors and 0 warnings across 39 files** 🧪
  (`eslint . --max-warnings 0`). The count is **39, not the 38** measured
  before the config existed — `eslint.config.js` lints itself once it is on
  disk.

  **`eslint.config.js` needed no CommonJS-scoped block, and that this is a
  genuine pass rather than a dormant rule was established by control.**
  `package.json` declares no `"type": "module"`, so the config is CJS, while
  flat config's default `sourceType` for `.js` is `module` — the setup in
  which `require`/`module.exports` would ordinarily trip `no-undef`. They do
  not, because `eslint-config-expo`'s core config already declares `module`,
  `require`, `exports`, `global` and `console` as globals 📐. **Negative
  control:** a never-called function referencing an undefined identifier was
  appended to the config, and ESLint reported
  `'someUndefinedGlobal' is not defined  no-undef` plus a `no-unused-vars`
  warning 🧪 — so both rules are live on that file and the clean run means the
  globals are declared, not that the rules are off. The file was restored and
  confirmed byte-identical by `diff`.
  *A first attempt at that control was invalid and is recorded rather than
  discarded:* the undefined reference was placed at top level, where ESLint —
  which **executes** a flat config to load it — threw `ReferenceError` at load
  time and exited 2 with no diagnostic at all. A control has to leave the
  module loadable, or it measures the loader instead of the linter.

  **THE `.mjs` STATIC-ANALYSIS GAP IS NARROWED, NOT CLOSED — and the
  distinction is the point of this block.** **AF14** recorded that the `.mjs`
  files "are **not** typechecked or DOM-guarded by anything", and that is still
  true of `tsc`; what changed is that ESLint now sees them. But AD34's
  `**/*.mjs` override turns two rules off there, so "ESLint closes the gap" is
  an overclaim and is not made.

  Resolved from the real config with ESLint's `calculateConfigForFile` against
  `src/core/model/headless-test.mjs` rather than assumed 🧪: **67 rules remain
  active — 46 at error, 21 at warn.**

  - **Error-level, live:** `no-undef`, `no-dupe-args`, `no-dupe-keys`,
    `no-dupe-class-members`, `no-duplicate-case`, `use-isnan`, `valid-typeof`,
    `no-var`, `prefer-const`, `eqeqeq`, `import/export`, `import/namespace`,
    `import/no-unresolved`, plus the `react-hooks/*` and `react/*` families.
  - **Warn-level, live:** `no-unused-vars`, `no-unreachable`,
    `no-unsafe-negation`, `no-unused-expressions`, `no-unused-labels`,
    `no-redeclare`, `no-empty-character-class`, `no-empty-pattern`,
    `no-extend-native`, `no-extra-bind`, `no-with`, `unicode-bom`,
    `import/first`, `import/no-duplicates`, `import/no-named-as-default`,
    `import/no-named-as-default-member`, and three `react-hooks` advisories.
  - **Off:** exactly two, `no-console` and `import/order` — **both
    stylistic**.
  - Of the six Level 2 rules, `prefer-const` and `eqeqeq` remain at **error**
    on `.mjs`; `no-unused-vars` remains live at **warn** through the base rule,
    since the TS-plugin block does not apply there.

  **Because `npm run lint` carries `--max-warnings 0`, the warn-level rules
  fail the run too** — so the practical gate on a `.mjs` file is all 67, not
  just the 46. **Correctness rules now cover these files where nothing covered
  them before; formatting rules do not.**

  **CONTROL — ESLint really does cover `.mjs` where `tsc` cannot see it.**
  Run against `scripts/check-core-baseline.mjs`, chosen because it is
  unpinned, sits outside `src/`, and is the one file `expo lint`'s
  `DEFAULT_INPUTS` would never have reached. First, the negative half:
  `tsc --noEmit --listFilesOnly` includes it **zero** times 🧪. Then a
  deliberate violation was appended and ESLint reported 🧪:

  ```
    186:10  warning  '__controlProbe' is defined but never used  no-unused-vars
    186:36  error    Expected '===' and instead saw '=='         eqeqeq
    186:39  error    'undefinedGlobalForControl' is not defined  no-undef
  ```

  Reverted with `git checkout --`, and the file re-hashed
  `4583e26a67c38b3c10daf1007b07158280ea0982f4758fb41f0a1c3717733e36`,
  identical to its pre-control hash 🧪; `npm run lint` returned to exit 0.

  ### Cleanups, measured

  - **`npm ci` cleared 201 extraneous top-level packages** — 229 entries
    before, **28** after, **0** extraneous, no `eslint` present 🧪. The residue
    was a full `eslint`/`eslint-config-expo` dependency tree from a reverted
    `expo lint` run, which is why `expo lint` behaved differently here than it
    would on a fresh clone. Notably the versions a clean install then resolved
    are **identical** to the residue's (`eslint@9.39.5`,
    `eslint-config-expo@57.0.2`, `eslint-plugin-react-hooks@7.1.1`).
  - **`example/`** — 20 files, 84K, untracked and ignored by `.gitignore:42`,
    **zero tracked files** 🧪. It held the **only** references to the assets
    below: eleven `require('@/assets/images/…')` call sites across
    `explore.tsx`, `animated-icon.tsx`, `animated-icon.web.tsx`,
    `web-badge.tsx` and `app-tabs.tsx` 🧪 — which is precisely why those assets
    looked used.
  - **Fourteen tracked assets deleted, totalling exactly 446,089 bytes** 🧪 —
    the figure was summed from `stat`, not accepted. `logo-glow.png` alone is
    331,624 of it. Each was confirmed to appear in **none** of the fifty-five
    tracked non-asset files before deletion, re-run immediately prior as a
    guard 🧪. Nine tracked assets remain: `assets/expo.icon/` (3),
    `favicon.png`, and the five `app.json` references.

  ### NOT ESTABLISHED

  1. **THE WORKFLOW HAS NEVER RUN.** No GitHub Actions execution took place.
     `.github/workflows/static-and-suites.yml` was parsed locally with the
     `yaml@2.9.0` already in `node_modules` and its structure asserted:
     it is valid YAML; the single job key is `static-and-suites` and the job
     carries **no `name:` override**, so the required-check name is the job
     key; `runs-on: ubuntu-latest`; triggers are `pull_request` (unfiltered)
     and `push` to `[main]`; **no `paths`/`paths-ignore` key exists under any
     trigger** — the only occurrence of the string in the file is the comment
     forbidding it; `node-version: '26'` with `cache: npm`; eight steps in the
     intended order ending with lint 🧪. **That establishes the file's shape
     and NOTHING about whether GitHub accepts the schema, resolves Node 26 on
     the runner, or renders the check name as expected.** It is unproven until
     the first pull request runs it, and that run will be worth its own entry.
  2. **Nothing here is behavioural evidence.** ESLint is static analysis. A
     clean lint says nothing about the device coverage ARCHITECTURE.md §6
     enumerates, and adding a second green command does not narrow that gap by
     one line. Every 👁 limit recorded in AF32–AF43 stands untouched.
  3. **No type-aware linting.** Level 2 uses no `parserOptions.project`, so
     rules requiring type information never ran. What lint covers is a
     syntactic and scope-level subset of what `tsc` covers, on `.ts`; on `.mjs`
     it is the only coverage there is.
  4. **`npm run check` is unchanged and lint is not part of it** — verified
     still exit 0 at 13 suites and 310 checks after every edit in this change
     🧪. A contributor who runs only `check` gets no lint, which is the
     deliberate arrangement AD34 explains and ARCHITECTURE.md §6 now names.
  5. **A latent editor hazard, recorded so it is discoverable from the repo
     rather than only from a conversation.** `.vscode/settings.json` sets an
     unqualified `"source.fixAll": "explicit"` on save. It does nothing today:
     VS Code dispatches that code-action kind to installed **extensions**, and
     `dbaeumer.vscode-eslint` is **not installed** — the extensions directory
     holds seven entries, none of them ESLint 🧪 — so the npm devDependency
     alone cannot autofix on save. If that extension is ever installed, ESLint
     autofix becomes live on save for every file including the twenty-six
     pinned in CORE-DIVERGENCE.md, and an autofix there would break
     `check:baseline` with no accompanying row update. **The backstop is
     `check:baseline`, which this change puts on every pull request.** No
     mitigation was added, deliberately: the hazard is latent rather than live,
     and `.vscode/extensions.json` was left recommending only
     `expo.vscode-expo-tools`. Adjacent and pre-existing, noted rather than
     acted on: `"source.organizeImports"` is **already** live through VS Code's
     built-in TypeScript service, independent of ESLint.

## The workflow's first run — AF44's last open item, closed

> Scope note that governs this section: **everything below was measured by me**,
> in this session, from the run log of PR #23 (`gh run view 33886447430 --log`)
> and from live registry and GitHub API queries. **No device, emulator or Gradle
> build was involved and none is claimed** — so, unlike AF27-AF43, this section
> carries **no 👁 at all**. Nothing here was owner-witnessed, and nothing here is
> behavioural evidence about the app.

- **AF45** 🧪📐 — **AF44's "THE WORKFLOW HAS NEVER RUN" is CLOSED: it ran, and
  it was green.** AF44 stated the file "was parsed locally and nothing more",
  which "establishes the file's shape and **NOTHING** about whether GitHub
  accepts the schema, resolves Node 26 on the runner, or renders the check name
  as expected", and said the first run "will be worth its own entry". This is
  that entry. **AF44's text is not edited**, per this file's append-only
  convention; AF45 cross-references it and the cross-reference runs in this
  direction only, exactly as AF43 did to AF32. The decisions taken in response
  are **AD35**; nothing from that entry is restated here (AD18).

  **The run.** Workflow `static-and-suites`, run **33886447430**, event
  `pull_request`, head branch `feature/lint-and-ci`, PR #23, **conclusion
  `success`**. Runner **2.337.0**, image `ubuntu-24.04` version
  `20260831.293.1` 🧪. Wall clock **14:54:42Z → 14:55:23Z**, about **41
  seconds**. A second run (**33886890855**) fired on the `push` to `main` at
  merge and also succeeded; every figure below is from the **pull-request** run.

  ### What the green tick actually establishes

  **1 · The required-check name renders as `static-and-suites`.** This was the
  single highest-risk property, because the job key **is** the identifier a
  branch-protection rule binds to. The jobs API reports `"name":
  "static-and-suites"` 🧪 — the job key verbatim, with no `name:` override to
  displace it, exactly as AF44 asserted from the parsed file. GitHub accepts the
  schema, which local parsing could not establish.

  **2 · All eight authored steps executed, in the intended order**, each
  `success` 🧪: checkout, setup-node, `npm ci`, `npm run build`, `npm run
  check:baseline`, `test:core`, `test:local`, `npm run lint` — steps 2 through 9
  of the job, the remainder being the runner's own `Set up job`, two `Post`
  steps and `Complete job`. AD34's separate-steps design survives contact: the
  step boundaries are visible in the log, so a failure would be attributable
  without reading a chained `&&`.

  **3 · The suites agree with the local run EXACTLY.** Baseline printed
  `26 files checked, 20 under src/core/, 0 mismatches` 🧪. The suites printed
  **17 + 18 + 14 + 9 + 15 + 14 + 12 + 26 = 125** for `test:core` and
  **20 + 73 + 27 + 35 + 30 = 185** for `test:local`, **310 checks across 13
  suites, 0 failures** — the same tally AF10, AF18 and AF44 record locally,
  summed from the log rather than taken from a summary line. AD31's reporting
  form survives too: the baseline check has its own step and is not folded into
  the suite count.

  ### CI and local are not byte-identical environments — recorded as a fact

  **`node-version: '26'` resolved to v26.8.1 on the runner; local is v26.7.0**
  🧪. The log reads `Attempting to download 26...`, then
  `Acquiring 26.8.1 - x64`, then `node: v26.8.1`.

  **This is the pin behaving as designed, not a defect.** AD34 pinned the
  **major** deliberately, and a major pin floats the patch by construction —
  the alternative, an exact pin, would have to be bumped by hand forever and
  would drift from whatever the development machine happens to have. The point
  worth recording is the consequence: **the two environments are not
  byte-identical**, so a result reproducible on one is not thereby proven on the
  other. It has cost nothing so far — the 310 checks matched exactly across the
  patch gap — but a future disagreement between a local run and a CI run should
  look here **first**, before looking at the code.

  ### Install cost — COLD figures, and what they retroactively support

  **These are cold-install numbers and must not be read as steady-state.** The
  log reads `npm cache is not found` 🧪 — this run was a cache **miss**, which
  then saved the cache on the way out. A later run restoring that cache pays
  less; how much less is **unmeasured**.

  | Figure | Value |
  |---|---|
  | packages installed | **818** (`added 818 packages, and audited 819 packages in 19s`) |
  | `npm ci` self-reported | **19s** |
  | install step wall clock | **18s** (14:54:51Z → 14:55:09Z) |
  | cache saved | **186,214,307 bytes** (~186 MB) |

  **This retroactively supports AD34's one-job decision, and the support is
  quantitative rather than rhetorical.** AD34 rejected separate jobs on the
  grounds that each would pay a fresh `npm ci` to parallelise a few seconds of
  compute. Measured: the install is **19s** of a **41s** job, while the four
  behavioural steps together run **14:55:09Z → 14:55:13Z**, about **4 seconds**,
  of which the suites are **~1 second**. **Splitting them would multiply a 19s
  install to parallelise roughly 4s of work** — the trade AD34 predicted, now
  with numbers on it.

  ### New install-time surface, and a correction about who owns it

  **`unrs-resolver@1.12.2` now runs a postinstall script**, alongside the
  pre-existing `esbuild@0.28.2` 🧪:

  ```
  npm warn install-scripts 2 packages have install scripts not yet covered by allowScripts:
  npm warn install-scripts   esbuild@0.28.2 (postinstall: node install.js)
  npm warn install-scripts   unrs-resolver@1.12.2 (postinstall: node postinstall.js)
  ```

  It arrives transitively through `eslint-import-resolver-typescript`, which
  `eslint-config-expo` declares — so **AD34's lint adoption is what introduced
  it**. Both scripts are **unapproved and did not run**, and nothing broke:
  **AF13** already records exactly this for esbuild, whose platform binary
  arrives via an optional platform dependency rather than via its postinstall.
  Whether `unrs-resolver` has the same property was **not** investigated here —
  what is measured is that lint passed without its postinstall having run.

  **`npm ci` also reports 14 moderate severity vulnerabilities. THE SCOPING
  CLAIM THIS WAS RECORDED UNDER — "devDependencies only" — IS FALSE, and was
  measured false rather than inherited** 🧪. `npm audit --omit=dev` still
  reports all **14**: they are in the **production** dependency tree, because
  `expo`, `expo-router` and `expo-splash-screen` are all `dependencies`, not
  `devDependencies`. The 14 fan out from exactly **two** root advisories:

  | Advisory | Path |
  |---|---|
  | `decode-uri-component@0.2.2` — DoS via exponential decoding of malformed percent-encoded input (GHSA-vcc3-ghjq-m6fr) | ← `query-string@7.1.3` ← **`expo-router@57.0.17`** |
  | `uuid@7.0.3` — missing buffer bounds check in v3/v5/v6 when `buf` is provided (GHSA-w5hq-g745-h8pq) | ← `xcode@3.0.1` ← `@expo/config-plugins@57.0.9` ← **`expo-splash-screen@57.0.8`** |

  **Recorded, not actioned. No fix is available to this repo**: both are
  transitive through Expo's own pinned tree, so closing them requires **Expo**
  to bump — `npm audit fix` cannot reach them without `--force`, which would
  mean overriding Expo's pins, and this repo has no mechanism that would keep
  such an override honest. Noted rather than fixed, and it is **not** a
  regression introduced by AD34: `xcode` and `query-string` predate the lint
  work entirely.

  ### An honest limit on what the tick proves — ESLint is SILENT on success

  **The Lint step's entire output is the npm banner. ESLint printed nothing**
  🧪 — the step reads, verbatim and in full:

  ```
  > readingaidandroid@1.0.0 lint
  > eslint . --max-warnings 0
  ```

  **So the CI log contains no positive evidence that ESLint linted 39 files, or
  any files.** A config whose `ignores` accidentally matched the whole tree
  would exit 0 and print exactly this. The green step proves *"eslint exited
  0"*, which is a weaker claim than *"the repo was linted"*.

  **This is a limit on the evidence, not a suspected defect**, and the reason it
  can be stated that firmly is that the gap is closed **locally** rather than in
  CI: AF44 established coverage against two negative controls — an injected
  `no-undef`/`no-unused-vars` violation in `eslint.config.js`, and three
  injected violations in `scripts/check-core-baseline.mjs`, a file
  `tsc --noEmit --listFilesOnly` includes **zero** times — and CI runs the
  identical config bytes from the identical commit.

  **It is the same principle that produced the `static-and-suites` name.** AD34
  named the check for what it actually executes so a green tick could not be
  read as the device coverage this repo does not have. The same discipline
  applies one level down: a green **Lint step** should not be read as coverage
  evidence either. Coverage was established by control, locally, once — and if
  the config's `ignores` are ever widened, **nothing in CI will notice**.

  ### NOT ESTABLISHED

  1. **Nothing here is behavioural evidence about the app.** A runner cannot
     execute a worklet, a shared value, a `ScrollView`, MMKV or release-mode
     Hermes. Every 👁 limit recorded in AF32-AF43 stands untouched, and
     ARCHITECTURE.md §6's list of what has no automated coverage is not
     shortened by one line.
  2. **The action-major bump this branch makes is NOT covered by this run.**
     PR #23 ran `actions/checkout@v4` and `actions/setup-node@v4`, and closed
     with `##[warning]Node.js 20 is deprecated. The following actions target
     Node.js 20 but are being forced to run on Node.js 24` 🧪. **Nothing in this
     entry is evidence that `@v7` works** — no local command can execute a
     runner, so that is this branch's own pending acceptance check, and it will
     need its own entry. AD35 holds the reasoning.
  3. **Cache-restore behaviour is unmeasured.** Only a cold run exists. What a
     warm run costs, and whether the key restores at all, is unknown.
  4. **Only `ubuntu-latest` was exercised**, at image `20260831.293.1`. Nothing
     is established about any other runner image, and `ubuntu-latest` is itself
     a moving target.
  5. **Branch protection was not exercised by this run.** `main` was
     unprotected when PR #23 merged; the protection described in AD35 was
     configured afterwards, so **no run has yet been blocked or gated by it**,
     and that the required check binds to the job key as intended is inferred
     from the rendered name, not observed.

## versionCode mechanism, and a CI blocker found while investigating it

> Scope note: **everything measured below was run by me**, in this session, in
> this tree, against the installed `@expo/config-plugins@57.0.9` /
> `@expo/prebuild-config` packages and the existing generated `android/`
> directory and its built release APK. No prebuild, Gradle build, emulator or
> device was run. **Where a claim is general Android platform behaviour rather
> than something read out of this tree, it is tagged ❓, not 🧪** — per-app
> `versionCode` monotonicity is documented Android `PackageManager` behaviour,
> not a fact this repo's own files could establish either way.

- **AF46** 🧪📐❓ — **The `versionCode` default mechanism, measured directly
  from the installed package.** `getVersionCode` is
  `config.android?.versionCode ?? 1`
  (`node_modules/@expo/config-plugins/build/android/Version.js:74-76`), and
  `setVersionCode` (`:77-80`) writes it into `android/app/build.gradle` with
  the pattern `` new RegExp(`versionCode.*`) `` — **no `g` flag**, so
  `String.replace` touches only the first match in the file. `withVersion`
  (`Version.js:24-28`), which calls `setVersionCode` and the parallel
  `setVersionName`, is wired into the Android default plugin chain at
  `node_modules/@expo/prebuild-config/build/plugins/withDefaultPlugins.js:152`,
  immediately after `Package.withPackageGradle` in that same list. Also
  measured: `expo.android.version` overrides root `expo.version` for the
  Android `versionName`, via `getVersionName`'s
  `config.android?.version ?? config.version ?? null` (`Version.js:63-65`) —
  this repo sets neither `android.version` nor root `version` beyond the
  existing `"1.0.0"`, so the override path is unexercised here but is now on
  record as available.

  **The `applicationId`/`namespace` rewrite pattern, and the asymmetry with
  `versionCode`.** `setPackageInBuildGradle`'s pattern, read at
  `node_modules/@expo/config-plugins/build/android/Package.js:273`, is
  `` new RegExp(`(applicationId|namespace)(\s*=\s*|\s+)['"].*['"]`, 'g') `` —
  **with** the `g` flag, unlike `setVersionCode`'s pattern. **Simulated
  directly**, in this session, against a hand-built `build.gradle` string
  containing both a `defaultConfig` and a `productFlavors { uat { … } }`
  block, each with its own `applicationId`: `String.replace` with this
  pattern rewrote **both** occurrences to the single configured package name,
  reproducing exactly the flavour-applicationId collision the investigation
  had flagged 🧪. A parallel simulation against `applicationIdSuffix
  ".uat"` confirmed it is **not** matched — the pattern's second capture
  group requires `applicationId` to be immediately followed by `=` or
  whitespace, and `applicationIdSuffix` has neither at that position, so the
  literal substring `applicationId` inside it does not satisfy the pattern.
  `versionCode`'s own non-global pattern was likewise simulated against a
  flavour-bearing string and, as expected from the missing `g` flag, only the
  first (`defaultConfig`) occurrence was rewritten; a flavour's own
  `versionCode` line was left untouched.

  **On-disk state, measured rather than assumed.**
  `android/app/build.gradle:142-143` reads `versionCode 1` /
  `versionName "1.0.0"` 🧪.

  **The existing release APK, measured with `aapt` (found at
  `~/Library/Android/sdk/build-tools/36.0.0/aapt`, not on `PATH`).**
  `aapt dump badging android/app/build/outputs/apk/release/app-release.apk`
  reports `package: name='com.arishh.readingaid' versionCode='1'
  versionName='1.0.0' …` 🧪. The file itself is **110,763,372 bytes**, mtime
  **2026-09-02 18:08:07** 🧪 (`stat`). `output-metadata.json` in the same
  output directory — written by the Android Gradle Plugin, not by Expo —
  independently states `"versionCode": 1, "versionName": "1.0.0"` for the
  same artifact 🧪, agreeing with `aapt`. **What this does and does not
  establish:** this is the `versionCode` baked into the **APK file on disk**,
  matching AF42's build (same mtime day, same signing-acceptance entry). **It
  is not a read of what is currently installed on the project owner's phone**
  — nothing in this session queried a device or emulator, so "the phone is
  at `versionCode 1`" is an **inference** from this being the one release APK
  AF42 records as installed, not a device measurement. If a later,
  unrecorded release build reached the phone, this entry would not know.

  **A CI blocker, found while investigating this and unrelated to it —
  recorded because it sits ahead of `versionCode` on the critical path for
  any future UAT pipeline.** `android/` is gitignored (`.gitignore:46`) and
  `keystore.properties` has never existed in a CI checkout — confirmed by
  reading `.gitignore:46-48` and by grepping
  `.github/workflows/static-and-suites.yml` for `gradlew`, `assembleRelease`
  and `android`, all **zero hits** 🧪: the workflow does not invoke Gradle or
  Android at all today. **So this is a latent blocker, not a currently-firing
  one.** But `android/app/build.gradle:121-129`'s `taskGraph.whenReady` guard
  (AD30) throws a `GradleException` on **any** task whose name matches
  `/(?i)release/` when `keystore.properties` is absent — and it would be
  absent in any CI checkout, unconditionally, since it is gitignored
  everywhere, not just locally. **If a future CI job is ever added that runs
  a Gradle task matching that pattern — for a UAT build or otherwise — it
  will hit this guard and fail**, unless CI is given its own
  `keystore.properties` (via a secrets-injection step, not a committed file)
  or the UAT variant's task name is kept clear of the `/(?i)release/` match
  the guard tests against. Flagged here, ahead of `versionCode`, because it
  was discovered as a side effect of reading `build.gradle` for this task and
  would otherwise surface as a surprise on whoever wires up the first CI
  release/UAT build.

## UAT CI feasibility investigation — a corrected premise, and what was measured

> Scope note that governs this section, stated the way the checkpoint that
> opened this PR asked for: **the measurements below originate from a
> read-only UAT-CI-feasibility investigation conducted in an earlier session
> of this conversation, whose transcript did not survive into this one.**
> This session independently **RE-VERIFIED a named subset** of them directly
> against this tree and the public npm registry: `git ls-files android`
> returning **0**; the stock `expo-template-bare-minimum@57.0.22` template,
> pulled fresh via `npm pack` into the scratchpad (nothing installed, nothing
> added to `node_modules`) and read directly, including its
> `signingConfigs.debug` release line and its plaintext debug credentials;
> the local, gitignored `android/app/build.gradle`'s guard re-read at its
> cited anchors (`:97-106`, `:121-129`, the `=~ /(?i)release/` predicate, the
> `:175` fallback to `null`); and `android/app/debug.keystore`'s hash plus its
> `keytool -list -v` Distinguished Name. Each is flagged individually below as
> **re-confirmed this session**. **Everything else — runner viability,
> delivery-mechanism measurements, repo posture, fork-PR and
> `pull_request_target` behaviour, `workflow_dispatch` constraints,
> `app.config.ts` loading, the scheme collision, and the AGP property names —
> is TRANSCRIBED from that earlier session and carries the tag that session
> gave it, unchanged: a tag describes a claim's epistemic status, not who is
> typing it.** No prebuild, Gradle build, emulator, device, or secret
> operation was performed in either session. This section carries **no 👁 at
> all**: nothing here was owner-witnessed, and nothing here is behavioural
> evidence about the app.

- **AF47** 🧪📐❓ — **CORRECTION TO AF46: the CI blocker AF46 names does not
  fire, because CI never has the guard to fire. The real CI failure mode is
  FAIL-OPEN, not fail-closed — the exact silent-wrong-artifact outcome AD30
  exists to prevent.** AF46's own text is **not edited**, per this file's
  append-only convention; this entry corrects it by cross-reference, the way
  AF31 corrected AF28's scope and AF43 completed AF32 without touching
  either.

  **The corrected premise, and why it was wrong.** AF46 states — dictated
  wording, not a discovered defect in the guard itself — that "`android/`'s
  AD30 signing guard (`build.gradle:121-129`) throws on any task matching
  `/(?i)release/` when `keystore.properties` is absent — which it always
  would be in a CI checkout, since it is gitignored. Latent today; will fire
  the first time a Gradle release-or-UAT task is added to CI…" **That is
  false.** `android/` is **entirely gitignored** — `git ls-files android`
  returns **0** 🧪 (re-confirmed this session; also recorded by AF41). A CI
  checkout therefore has no `android/` directory of any kind, guard included.
  When such a checkout runs `npx expo prebuild`, it generates `android/`
  fresh from the **stock** `expo-template-bare-minimum` package — **not**
  from the AD30-edited file, which exists only in the working copy of a
  machine where RELEASE-SIGNING.md §3's manual edit was applied by hand, and
  has never been committed anywhere. This is exactly AF37's failure class
  recurring in a new place: an entry asserting a behaviour of the guard that
  was never checked against what CI actually receives.

  This session pulled that stock template directly from the npm registry —
  `npm pack expo-template-bare-minimum@57.0.22` into the scratchpad, no
  install — and read its `android/app/build.gradle` 🧪: line 115, inside
  `buildTypes { release { … } }`, is `signingConfig signingConfigs.debug`,
  under the same "Caution! In production, you need to generate your own
  keystore file" comment AD30 quotes. **There is no guard in this file. There
  is no `releaseSigningError`. There is no `keystorePropertiesFile` check of
  any kind** — the whole mechanism AD30 built is absent from what a CI
  checkout would actually generate. `assembleRelease` on that tree
  **succeeds** and emits an installable, debug-signed "release" APK —
  precisely the silent-wrong-artifact failure mode AD30's own text names as
  the reason the hard-fail exists.

  **One consequence stated explicitly, because it is the part most likely to
  be assumed away:** materialising `keystore.properties` into a CI checkout
  from repository secrets accomplishes **nothing** on its own, because
  nothing in the stock generated tree reads that file. The AD30 mechanism
  itself — the existence check, the `gradle.taskGraph.whenReady` throw, the
  null-not-debug fallback — would have to be **re-delivered into the
  CI-generated `android/` tree by some other means** before a secret alone
  could do anything (see the four delivery mechanisms below). AF46's "unless
  CI is given its own `keystore.properties`" is therefore **necessary but not
  sufficient**, and AF46's framing that the guard is merely "latent" and will
  "fire" is the part corrected here: **without a delivery mechanism, it never
  exists to fire at all.**

  **Guard mechanics as written, on a machine that HAS the guard** (i.e.
  local, per RELEASE-SIGNING.md's own procedure) — recorded for completeness,
  re-read this session at its cited anchors 🧪: `android/app/build.gradle:
  97-106` computes `releaseSigningError` at **configuration time**, a plain
  top-to-bottom set of `if`/`else` assignments that never throws by itself;
  `:121-129`'s `gradle.taskGraph.whenReady { … }` runs once the task graph is
  fixed and, only if `releaseSigningError != null`, checks
  `taskGraph.allTasks.any { it.name =~ /(?i)release/ }` before throwing a
  `GradleException`. `=~` is Groovy's find operator against a
  case-insensitive regex — it matches on **substring**, not exact task name.
  `:175`'s `signingConfig releaseSigningError == null ? signingConfigs.release
  : null` is the fallback actually in force whenever the guard is somehow
  bypassed: **`null`, never `signingConfigs.debug`**. **AF42's `BUILD FAILED
  in 16s` / `28 actionable tasks: 28 up-to-date`** remains the daemon-log
  corroboration that this sequence — configure, build the graph, throw before
  any task executes — is what happens when the guard **is** present and the
  keystore is absent; nothing here contradicts AF42. What is corrected is
  only the assumption that this file is what CI would generate.

  **Variant asymmetry.** Because `=~ /(?i)release/` matches on substring, the
  task `assembleUatRelease` — which a `uat` product flavour (already rejected
  by AD36 on unrelated `applicationId`-collision grounds) would produce, were
  it ever adopted — **would** trip the same guard, once the guard exists in
  the tree at all. A differently-shaped variant, a separate `buildType`
  literally named `uat` rather than a flavour producing a `…Release` task,
  would **not** match, since the string "uat" contains no substring
  "release". Recorded as a real, independent hazard for anyone designing a
  future CI/UAT pipeline: **the guard's coverage is name-shaped, not
  concept-shaped**, and a differently-named variant can silently walk around
  it.

  **Four delivery mechanisms for a signing config into a CI-generated tree,
  and what was established of each — transcribed from the earlier session,
  original tags kept.** (1) `withAppBuildGradle`, an Expo config-plugin mod
  hook, could inject the AD30 block on every prebuild, CI included — but
  **nothing in the default Android plugin chain touches `signingConfigs`
  today** 📐 (the same `withDefaultPlugins.js` chain AD30/AD36 already read
  has no such mod), so this is a platform capability this repo does not
  exercise anywhere. (2) `configureEasBuildAsync`, an EAS-specific
  config-plugin hook for injecting credentials during an EAS-hosted build,
  **has no caller anywhere in this tree** 📐 — this repo does not use EAS
  Build, so the path is inapplicable as configured, not merely unused. (3)
  Android Gradle Plugin's own `android.injected.signing.*` project properties
  (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`) can be passed on
  the command line or via `-P`/`gradle.properties`, and AGP wires them into a
  build with none of this repo's own Groovy — the property names were
  **measured directly out of the resolved AGP 8.12.0 jar** 🧪 this repo's
  Gradle wrapper pulls, and **they fail open to the declared debug config
  when absent** — i.e. this mechanism carries the identical fail-open
  property as the stock template itself if invoked without all four
  properties set. (4) Committing a signed `android/` tree outright — named
  only as the logical fourth option, not evaluated as a recommendation, since
  it cuts directly against AD30/AD31's rationale for keeping `android/` out
  of git.

  **The debug keystore is FIXED across the whole ecosystem, not generated
  per-project or per-run — and the stock template ships its unlock
  credentials in plain text, which is a stronger rejection ground than "the
  key is published on npm."** `android/app/debug.keystore` in this tree
  hashes `221e0a3106aa4c3ccc154e0a418b55020b3f9ea6e84f92e8749cd9e2f39f5e58` —
  **re-hashed this session** 🧪, matching the earlier investigation exactly —
  and this session additionally hashed the `debug.keystore` bundled inside
  the freshly pulled `expo-template-bare-minimum@57.0.22` package and found
  it **identical** 🧪. `keytool -list -v` against it, run this session,
  reports `Owner: CN=Android Debug, OU=Android, O=Unknown, L=Unknown,
  ST=Unknown, C=US`, `Valid from: … 2013 until: … 2052` 🧪 — the value used to
  correct README.md's and RELEASE-SIGNING.md's DN string below. **This
  refutes a premise I supplied**, that debug-signing was somehow variable or
  freshly generated per checkout — it is the opposite, the same fixed key on
  every Expo project on every machine. And the credentials that unlock it are
  not something anyone has to leak: they ship, in plain text, in the very
  file every `expo prebuild` generates — read directly from the pulled
  template this session 🧪:

  ```gradle
  signingConfigs {
      debug {
          storeFile file('debug.keystore')
          storePassword 'android'
          keyAlias 'androiddebugkey'
          keyPassword 'android'
      }
  }
  ```

  **One file therefore corroborates two separate findings at once**: line
  115's `signingConfig signingConfigs.debug` is the fail-open corrected
  premise above, and these four lines are the rejection ground for
  debug-signing generally — not "the private key is published on npm" (a
  claim from the earlier investigation session, not re-verified here), but a
  stronger and more local one: **the credentials are baked into the exact
  file every `expo prebuild` generates, on every machine**, independent of
  whatever else is published on the registry. Debug-signing is rejected
  because the keystore is not a secret at all, not because it is merely easy
  to obtain — it exercises nothing about the signing path a reviewer would
  actually want tested.

  **Runner viability — transcribed, original tags kept.** SDK platform 36 and
  build-tools 36.0.0 present on the standard GitHub-hosted runner image 📐;
  JDK 17.0.20 an exact match against this project's toolchain 📐; NDK and
  CMake versions **mismatched** against this project's pins 📐; 4 vCPU / 16 GB
  RAM / 14 GB free SSD ❓ — **explicitly flagged as an estimate, not a
  measurement: no job was dispatched to a live GitHub-hosted runner to
  confirm hardware in either session**; free, unlimited Actions minutes on a
  public repository ❓. The measured local-build anchors — wall-clock and task
  counts for a real release build on this machine — are AF42's, unchanged.

  **Delivery-mechanism measurements — transcribed, original tags kept.** A
  GitHub **Release asset** is downloadable **anonymously** (HTTP 206 on a
  range request, no auth) 🧪; a workflow **artifact** returns **401** without
  a repo-scoped token 🧪 — a real distribution difference for handing a UAT
  build to someone outside the organisation. An artifact's download URL
  **expires 1 minute** after being issued via the API 📐 (a documented
  platform limit, not tested at the boundary). A Release asset carries a
  **2 GiB per-file limit** 📐, comfortably above this project's
  **110,763,372-byte** (AF42) release APK.

  **Repo posture — transcribed, original tags kept, all against this
  specific repository's live settings 🧪.** **Public**, **zero forks**, **one
  collaborator**, **no Actions secrets, no repository variables, no
  configured environments**; `default_workflow_permissions` reads **`read`**.
  Names and settings only — **no secret value was read or is recorded,
  because none was readable**: a public repo's secrets are write-only via the
  API regardless of who asks.

  **Fork PRs and the `pull_request_target` exception.** A pull request opened
  from a **fork** of this public repository cannot receive repository secrets
  under the default Actions configuration 📐 (documented platform default,
  not this repo's own file), and there is **no public-repo opt-in available**
  for it — the earlier session's attempt against the fork-PR
  secrets-visibility setting returned an HTTP **422** from that settings
  endpoint 🧪. The two trigger types that **do** run with the base
  repository's secrets against fork-authored code —
  **`pull_request_target`** and **`workflow_run`** — are named explicitly as
  the ones a future UAT workflow **must not** use for anything that checks
  out or executes fork-supplied code, the standard supply-chain hazard those
  two triggers exist to warn about.

  **`workflow_dispatch` constraints** ❓ (general GitHub product behaviour,
  not verified against a live dispatch attempt in either session — not
  laundered as measured): it requires the invoking actor to have **write
  access**, **and** the workflow file must already exist **on the
  repository's default branch** — a workflow present only on a feature branch
  cannot be dispatched from anywhere until it merges. **Operational
  consequence for this repo:** a UAT workflow's `workflow_dispatch` trigger
  cannot be exercised from the feature branch that introduces it; it must
  land on protected `main` first, which in turn interacts with `main`'s
  `enforce_admins` posture (AD35) if a first dispatch attempt ever fails.

  **`app.config.ts` loading — transcribed, original tags kept.** It resolves
  and loads with **zero new dependencies**, via the `typescript@~6.0.3`
  already in this repo's devDependencies, specifically its `transpileModule`
  API — no `ts-node`, no build step 📐. **Two caveats, not glossed over:**
  importing `@expo/config-types` for stronger typing would pull in a
  **transitively unpinned** package this repo does not otherwise control; and
  this makes the `typescript` version range's caret load-bearing for **config
  loading itself**, not merely for `tsc` — a future patch bump could, in
  principle, change how `app.config.ts` transpiles, a dependency this repo
  did not previously have.

  **The `expo.scheme` collision.** Both a UAT variant and the existing
  release app would claim the identical URL scheme `readingaidandroid` 📐
  (read from `app.json`) unless a UAT `app.config` overlay explicitly sets a
  different one. Left unaddressed, Android resolves a deep link between two
  competing claimants with a **disambiguation chooser** ❓ (documented
  platform behaviour, not exercised by installing two such APKs side by side
  — which the task constraints forbid regardless) — a real, observable defect
  for a tester running both builds, not a stylistic preference. **Recorded as
  a defect a future UAT overlay must avoid**, narrowing — without deciding —
  the still-open UAT overlay shape AD36 left unresolved.

  **A third provenance failure, named because this project has a rule about
  exactly this.** A **"~0.52 GB install"** figure for the `static-and-suites`
  CI job recurred across prompts in this workstream. **It appears nowhere in
  this repo's documentation.** The only measured install-size figure this
  repo has ever recorded for that job is **AF45**'s cache size —
  **186,214,307 bytes**, about 186 MB, from the real run log of PR #23 —
  neither the same figure nor the same unit as "~0.52 GB." The number was
  carried from a prior chat's summary into later prompts without being
  checked against the repository. Recorded here for the same reason AF37
  records the concurrent-session incident: a false figure repeated across
  prompts is indistinguishable from a true one until someone checks it
  against the actual record, and CLAUDE.md §3 exists to make "checked" the
  default rather than the exception.

  **What this entry does NOT do.** It runs no CI job, adds no workflow, and
  decides nothing about a UAT pipeline's shape — AD36 already left that
  overlay's design open on three unrelated points, and none of them is
  settled here. It does not close AF46's own point 3 (Hermes/R8 release-mode
  gaps) or AF26's point 3 — both untouched. Every 👁 limit recorded in
  AF27–AF43 stands.

## The UAT config overlay — a live no-op found in `app.json`, and two loaders

> Scope note that governs this section: **everything below was measured by me**,
> in this session, in this tree, against the installed `@expo/prebuild-config` /
> `@expo/config` / `@expo/require-utils` packages and this repo's own asset
> files. **No prebuild, Gradle build, emulator, device or install was run**, and
> none is claimed. This section therefore carries **no 👁 at all**, like AF45
> and AF47, and nothing in it is behavioural evidence about the app on hardware.
> The decisions taken in response are **AD37**; nothing from that entry is
> restated here (AD18).

- **AF48** 🧪📐 — **`app.json`'s `adaptiveIcon.backgroundColor` is ALREADY a
  no-op in the SHIPPED release app, and this is recorded as a present-tense fact
  about the current configuration rather than only as context for the UAT
  variant.**

  `app.json` sets **both** `adaptiveIcon.backgroundColor: "#E6F4FE"` **and**
  `adaptiveIcon.backgroundImage: "./assets/images/android-icon-background.png"`.
  An adaptive icon's background layer is one or the other, and the plugin
  resolves it at
  `node_modules/@expo/prebuild-config/build/plugins/icons/withAndroidIcons.js:239`
  📐:

  ```js
  const background = backgroundImage ? `@mipmap/ic_launcher_background` : `@color/iconBackground`;
  ```

  So while `backgroundImage` is present, `ic_launcher.xml` in `mipmap-anydpi-v26`
  points its background at the **drawable**. The colour is still written into
  `colors.xml` as `iconBackground` (`:99`, `:123-128`, `:232-237`) and is then
  **referenced by nothing**. Expo says so in its own comment at `:288` —
  `// backgroundImage overrides backgroundColor`. Two further confirmations that
  the colour cannot reach the icon by another route: `configureAdaptiveIconAsync`
  (`:206`) is never passed `backgroundColor` at all, and the legacy pre-API-26
  path nulls both at `:159-160` because `app.json` sets a top-level `icon`.
  Swept for other consumers: `withAndroidIcons` is the **only** reader of
  `adaptiveIcon.backgroundColor`/`backgroundImage` anywhere in
  `@expo/prebuild-config` or `@expo/config-plugins`; the sole other
  `adaptiveIcon` reference is `withAndroidManifestIcons.js:19` testing
  `!!adaptiveIcon` for `android:roundIcon` 🧪.

  **WHY IT WENT UNNOTICED, which is the interesting half.** The two settings do
  not merely coexist — they **agree by value**. Decoding both PNGs (pure Node
  `zlib`, no new dependency) 🧪:

  | asset | measured |
  |---|---|
  | `android-icon-background.png` | 512×512 RGBA, **100% opaque**, **97.5% of it exactly `#e6f4fe`** — a flat fill of the same colour `backgroundColor` declares, plus 2.5% faint light-blue detail |
  | `android-icon-foreground.png` | 512×512 RGBA, **95% transparent**; the 5% opaque is a blue glyph, dominant `#1884eb` |

  The Expo template ships the image and the colour matched, so the redundant
  field has never produced a visible discrepancy for anyone to notice.

  **NOT FIXED IN THIS CHANGE, deliberately.** Release identity is untouched by
  AD37 and removing the redundant field would be a change to it. It is recorded
  here so that a reader can **discover the field does nothing** rather than
  reasoning from it. Nothing depends on the redundancy; it is inert, not
  harmful.

  **The consequence for the UAT overlay** is that setting a yellow
  `backgroundColor` while `backgroundImage` remained would have been an
  invisible no-op — which is why AD37 omits the image instead. Contrast against
  the foreground glyph, computed for the candidate backgrounds 🧪 (WCAG
  luminance ratios, used here as a proportionality check that the beta icon is
  no worse than the release one — an icon glyph is not text and no compliance
  claim is made):

  | background | vs glyph `#1884eb` |
  |---|---|
  | `#E6F4FE` — release, today | **3.38:1** |
  | **`#FFEB3B` — chosen for UAT** | **3.10:1** |
  | `#FFF176` | 3.27:1 |
  | `#FDD835` | 2.72:1 |
  | `#FFC107` | 2.33:1 |
  | `#F9A825` | 1.92:1 |

  ---

  ### CORRECTION to a premise this change was scoped under — TypeScript 7 would not "silently break" config loading

  **The instruction was to record that a TS 7 bump would silently break
  `app.config.ts` loading. Measured, that is too strong, and the project owner
  corrected it on being shown the measurement.** It is recorded as a correction
  rather than quietly softened, for AF37's reason: a log entry asserting a
  mechanism that does not exist is caught by nothing.

  Expo loads a `.ts` config through **two** transpilers, not one:

  1. **`typescript`'s `transpileModule`** — `@expo/require-utils/build/load.js:316`,
     reached via `loadTypescript()` at `:73-92` 📐. That function carries Expo's
     own comment at `:77-78`: *"typescript v7 ships without the necessary
     compiler/public APIs to use it for transpilation or other purposes"*, and
     returns `null` when `typeof _ts?.transpileModule !== 'function'`. **So a TS
     7 bump is anticipated in the installed source**, not merely plausible.
  2. **Node's native `module.stripTypeScriptTypes`** — `load.js:335-341`, guarded
     by `hasStripTypeScriptTypes` at `:282`. Measured present on this repo's
     toolchain: `typeof require('node:module').stripTypeScriptTypes` is
     `'function'` under **Node v26.7.0** 🧪.

  **So there are two couplings, not one.** A TS 7 bump does not break loading —
  it **silently switches transpilers**, and the fallback's availability is
  itself Node-version-dependent. `package.json`'s `"typescript": "~6.0.3"` is
  load-bearing for config loading as well as for `tsc`, which it was not before
  this change, but the failure it guards against is a *substitution*, not an
  outage. On a Node without the native stripper, `inputCode === code` at `:342`
  and raw `.ts` would be evaluated as JavaScript — that path was **not**
  exercised here and is ❓.

  **THE OPERATIVE CONSTRAINT, and the reason it needed a test rather than a
  comment.** The native stripper accepts only **erasable** TypeScript — no
  `enum`, no `namespace`, no parameter properties. **`tsc` does not enforce
  erasability**, so nothing in the repo's ordinary gates would catch a
  violation, and the failure would surface only on a machine that took the
  fallback path. Demonstrated rather than described 🧪: with
  `enum Leaked { A, B }` appended to `app.config.ts`,

  ```
  tsc --noEmit                     -> exit 0
  node app.config-headless-test.mjs -> exit 1
       FAIL  app.config.ts is ERASABLE TypeScript ...:
             stripTypeScriptTypes threw: TypeScript enum is not supported in strip-only mode
  ```

  The real source is erasable today: `stripTypeScriptTypes` accepted it and
  returned **6,698 bytes from 6,698** 🧪 — Node's stripper blanks type syntax to
  whitespace rather than deleting it, so equal length is the expected result and
  "erasable" is proven by *not throwing*, not by a size change.

  ---

  ### The overlay resolved both ways, through Expo's real loader

  `evalConfig('./app.config.ts', { config })` was called directly against a
  clone of `app.json`'s `expo` block 🧪:

  | | `READING_AID_UAT` unset | set |
  |---|---|---|
  | `name` | `Reading Aid` | `BETA Reading Aid` |
  | `scheme` | `readingaidandroid` | `readingaiduat` |
  | `android.package` | `com.arishh.readingaid` | `com.arishh.readingaid.uat` |
  | `android.version` | *(absent)* | `1.0.0-uat` |
  | `android.versionCode` | `1` | `29809161` |
  | `adaptiveIcon.backgroundColor` | `#E6F4FE` | `#FFEB3B` |
  | `adaptiveIcon.backgroundImage` | present | **absent** |
  | `mayHaveUnusedStaticConfig` | **false** | **false** |

  **That last row is the one worth keeping.** `evalConfig.js:59-62` stamps a
  `Symbol('non-standard')` onto the object handed to the config function and
  `:79-81` reports `mayHaveUnusedStaticConfig` when the returned object has lost
  it. `false` on the unset path confirms the by-reference return preserves the
  marker; `false` on the UAT path confirms object spread carries symbol-keyed
  properties through, which was not assumed.

  ### versionCode headroom, measured

  | unit | value on 2026-09-04 | headroom below the 2.1e9 ceiling |
  |---|---|---|
  | **minutes since epoch** | **29,809,147** | **~3,939 years** (+525,600/yr) |
  | seconds since epoch | 1,788,548,840 | **~9.9 years** |

  Minutes is the unit AD37 takes; seconds was rejected on that second row 🧪.

  ### Four negative controls before the suite's green run was believed

  Following AF21's, AD29's and AD31's precedent. Each control failed **exactly**
  the checks it should and no others 🧪:

  | control | result |
  |---|---|
  | unset path returns `{ ...config }` instead of the same reference | 46 passed, **1 failed** — the reference check alone |
  | `backgroundImage` re-added to the UAT adaptive icon | 46 passed, **1 failed** — the Q1 guard alone |
  | a non-erasable `enum` added | 43 passed, **2 failed**, exit 1, while `tsc` stayed at exit 0 |
  | release identity rewritten on the *unset* path (`versionCode: 99`) | 44 passed, **3 failed**, exit 1 |

  `app.config.ts` was restored after each and confirmed byte-identical by hash
  (`0d79578c556167b5c9c169270cb2e53992bbb2b563949b15c77930213540197f`) and by a
  silent `diff` 🧪; the suite returned to **47 passed, 0 failed**.

  ### A THIRD self-caught invalid control, and the pattern is worth seeing

  **The first attempt at the `tsc` control was invalid and is recorded rather
  than discarded.** To prove a root-level `.ts` file is in the main `tsc`
  program, a probe was written to **`.probe-env.ts`** — with a leading dot. It
  reported `tsc` **exit 0 despite a deliberate type error**, and
  `--listFilesOnly` matched it **zero** times, which reads exactly like "root
  `.ts` files are not typechecked." The real cause is that **TypeScript's
  `include` globs do not match dotfiles**, so `**/*.ts` never saw it: the
  control was measuring its own filename. Re-run as `probe-env-check.ts` 🧪:

  ```
  const v: number = process.env.SOME_VAR;   -> TS2322, tsc exit 2
  const v: string | undefined = ...          -> tsc exit 0
  eslint probe-env-check.ts --max-warnings 0 -> exit 0
  ```

  So a root `.ts` **is** in the program, `process.env` types as
  `string | undefined` there, and the probe was deleted with `git status`
  confirmed clean.

  **This is the third control in this repo caught being invalid before its
  result was trusted**, after AF44's two — the flat-config probe that threw
  `ReferenceError` at load and so measured ESLint's *loader* rather than its
  linter, and the `paths:` sweep whose only hit was the comment forbidding the
  key. The pattern is worth being visible: in all three the invalid control
  produced a **confident, plausible, wrong** answer, and in all three what
  exposed it was checking the instrument against a case whose outcome was known
  in advance.

  ### One implementation constraint found by measurement

  `eslint-plugin-expo`'s **`no-dynamic-env-var`** rule rejects computed access:
  `process.env[SOME_CONST]` fails lint with *"Unexpected dynamic access. Cannot
  dynamically access … from process.env"* 🧪, because Expo inlines environment
  variables statically and a computed key cannot be seen. `app.config.ts`
  therefore reads `process.env.READING_AID_UAT` and
  `process.env.UAT_VERSION_CODE` as **literal** properties; the names are kept
  together in one docblock instead of in constants.

  ### The new tallies

  `npm run check` is now **14 suites and 357 checks**, `0 failures` 🧪 —
  `test:core` 8 / **125** unchanged (17+18+14+9+15+14+12+26), `test:local` 6 /
  **232** (47+20+73+27+35+30). The baseline check still reports **26 files
  checked, 20 under `src/core/`, 0 mismatches**: no manifest row changed, and
  `app.config.ts` is deliberately not one (AD37). Tracked `.mjs` files go from
  14 to **15**.

  ### NOT ESTABLISHED

  1. **Nothing here was built, prebuilt, installed or run on a device.** The
     yellow icon, the `BETA Reading Aid` launcher label, the side-by-side
     install and the `versionCode` upgrade path are **all unverified on
     hardware**. Q1 in particular is a **read of `withAndroidIcons.js`**, not an
     observation of a rendered icon — the prediction is that dropping
     `backgroundImage` makes `@color/iconBackground` the background layer, and
     it has not been seen.
  2. **No claim that the two `applicationId`s actually install side by side.**
     That they occupy independent `versionCode` spaces is documented Android
     `PackageManager` behaviour ❓ (AD36), not something measured here.
  3. **The suite is not the resolver.** It calls the overlay's exported function
     directly with `app.json`'s `expo` block. Expo's own base is
     `ensureConfigHasDefaultValues(...).exp` (`Config.js:275-284`), which may
     fill defaults the suite's base lacks. The fields the overlay touches are
     all declared in `app.json` verbatim, so the gap does not reach them — but
     the suite tests **the overlay**, not Expo's config resolution.
  4. **The raw-`.ts`-evaluation path is unexercised** — a Node lacking
     `stripTypeScriptTypes` combined with a TypeScript lacking `transpileModule`
     was not simulated ❓.
  5. **Every 👁 limit recorded in AF27–AF43 stands untouched**, and
     ARCHITECTURE.md §6's list of what has no automated coverage is not
     shortened by one line. A fourteenth suite is still static, Node-only
     evidence.

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
- 2026-08-31 — appended AF20–AF26 on `test/hermes-feature-probe`. All four of
  AF12's engine-feature questions answer WORKS (AF22), and all 11 executable
  seeded modules load and run under the Hermes CLI with output identical to
  Node (AF23). AF25 fully closes AF11's Node half (the last four modules were
  executed). AF26 **narrows but does not close** AF11's Hermes half: the
  desktop CLI is not the Android engine, and the runtime half of the evidence
  sits on a VM about a year older than the version RN 0.86.3 ships.
- 2026-09-01 — appended AF27–AF30 on `feature/core-hermes-probe`: the first
  real on-device Hermes evidence, from an Android emulator run of the probe
  screen added earlier on this branch. AF5 is resolved (AF27, `console`
  works under device Hermes in a debug build). AF26 is advanced but stays
  open (AF28 — `markdown.ts`/`tokenize.ts` now run on-device identically to
  Node, but none of AF12's four engine-sensitive features have been
  exercised on-device). The `Word.id` invariant is confirmed holding
  on-device for the first 12 words (AF29). AF30 records a negative result:
  the `android`/`ios` tsconfig excludes were not exercised by the first real
  prebuild, and AF4 remains the only evidence for them.
- 2026-09-01 — appended AF31 on `docs/mvp-plan-register`, a scope correction
  to AF28: two of AF12's four engine-sensitive feature classes (regex
  lookbehind, and `\p{L}` among the property escapes) were partly exercised
  on-device by AF28's own run, so AF28's "none of the four" is too strong.
  Nothing new was executed — this is a re-reading of source against AF28's
  recorded output, and it separates three levels of evidence (parsed, invoked,
  correct-match-observed) because only the first two are proven. Residue is
  three of the four — `\p{M}` and `normalize('NFC')` in `orp.ts`, `matchAll`
  in `epubStructure.ts` — plus `\p{L}` in `bionic.ts` and `\p{N}`'s matching
  behaviour. AF28 is left unedited.
- 2026-09-02 — appended AF32–AF36 on `feature/mvp-reader`, recording the stage
  1 acceptance probe that AD21, AD22 and AD23 each listed as pending. AF32:
  AD21's mechanism is proven on **physical hardware** — 1339 frames and 66
  word advances across two device runs with zero spontaneous React renders,
  and run B's render total of 7 explained as seven negative-control taps
  rather than a regression. AF33: **AF31 residue item 4 is CLOSED** — `\p{L}`
  in `bionic.ts` parses and runs on device; the exact five-way split table was
  matched on the **emulator** (screenshot) and the device gave module-load and
  visible-bolding evidence only, with engine-level equivalence stated as the
  reason the emulator match carries. AF34: a **negative result** per AF30's
  precedent — rAF and `performance.now()` share a time base on hardware
  (−0.12 / −0.13 ms), so AD22's seeding assumption is verified and the ported
  clock needs no patch. AF35: **emulator frame timing is not a proxy for
  device frame timing** (emulator max 120.82 ms, a seven-frame stall, against
  device maxima of 31.03 and 33.98 ms on device means of 16.62 / 16.82 ms) —
  which matters because AD24 `D-G`'s virtualization revisit trigger must be
  evaluated on hardware. AF36: probe question (d) is **deferred, not failed**
  — the probe is 22 words on an empty screen and the reader is a full document,
  so tuning waits for the real surface and stays a one-place edit in
  `palette.ts`. Surfaces are attributed throughout and never merged into
  ranges.
- 2026-09-02 — appended **AF37**, recording the concurrent-session incident
  that interrupted stages 3–4: two Claude Code sessions wrote this branch at
  once because two prompts meant for different windows arrived in one message,
  and each session destroyed work — one deleted the stage 1 probe, the other
  (mine) truncated a `palette.ts` it had not created by using `cat >` without
  checking whether the path existed. Written as an `AF` rather than an `AD`
  because nothing was decided. Records the three operational lessons, how the
  collision was detected (a second `claude` PID, and a same-inode
  birth/modify mismatch), and that preserving the foreign artifacts in a
  scratchpad is what kept the revert reversible. The foreign `DECISIONS.md`
  entry asserting on-device tuning that never happened is called out
  specifically: a decision log that records an event which did not occur is
  the one failure mode nothing in this repo can catch.
- 2026-09-02 — appended **AF38-AF39** on `feature/click-to-jump`. **AF38** is
  the auto-scroll entry that did not exist: auto-scroll was the only MVP
  mechanism whose acceptance lived in a change-log sentence rather than a
  finding, and it has no headless coverage because it is pure UI-thread
  behaviour with nothing a Node suite can bundle. It records the mechanism
  (per-word Y from `onLayout` and **Y only**; absolute Y as block Y plus
  word-relative Y; `useAnimatedReaction` on `currentIndex`; `scrollTo` through
  `useAnimatedRef`, all UI-thread), the line-change test and why `lastScrolledY`
  beat comparing against the previous index — a reason now **strengthened** by
  AD28's tap, since a seek is not a sequential advance — the four no-op guards,
  the `setTimeout(0)` coalescing and its quadratic rationale, and the fact that
  **CLAUDE.md guard 3 holds structurally**: a grep across `src/` for
  `onViewableItemsChanged`, `viewabilityConfig`, `onRangeChange`, `onScroll`,
  `onMomentumScroll`, `onContentSizeChange` and `useScrollViewOffset` returns
  nothing, so there is no callback that *could* scroll on a user gesture.
  Acceptance is attributed to the project owner's physical-device and emulator
  runs — auto-scroll following the active line, alongside resume, Restart, paste
  and WPM — and **I witnessed neither**. Not established: no measurement at book
  length (so AD24 `D-G`'s revisit trigger is still unevaluated, and per AF35
  must be evaluated on hardware), no rotation or font-scale re-measurement
  testing, no evidence it does not fight manual scrolling beyond the structural
  argument, plus two residuals visible on inspection (a seek to a word on the
  anchored line that has been manually scrolled away fires no scroll, and
  `lastScrolledY` is not reset on document change). **AF39** resolves AF36's
  deferred question (d): the project owner judged the **real** reader surface —
  not the 22-word probe AF36 said was "not the artifact" — acceptable on a
  physical device and an emulator, so `bodyFontSize` stays 19 and nothing is
  retuned. It is an `AF` rather than part of AD29 because the ruling is
  owner-witnessed device evidence while the values that change are a choice,
  following AF27-supersedes-AF5 and AF31-corrects-AF28. Its limits are stated:
  a **qualitative** judgement with no metrics transcribed, covering the seeded
  sample only — which renders one `#` and one `##` and none of the heading
  levels AD29 changes — on a **debug** build, like every device observation this
  repo holds. **AF36's text is left unedited.**
- 2026-09-02 — appended **AF40** on `feature/click-to-jump`, closing AD28's
  pending acceptance check. The structural prediction — `Pressability.js:526-529`
  returning `cancelable ?? true` and `Text.js:449-452` passing it through, both
  read from this repo's own `node_modules/`, so 📐 and never a device claim —
  **was borne out**: responder transfer works as the source implied, and a drag
  beginning on a word scrolls rather than seeking, on **both** the physical
  Android device and the emulator. Scope is the four named checks (the drag; a
  tap on the last word leaving the transport reading Restart; a tap backwards
  from the end restoring Play without Restart; a tap while playing changing
  position without stopping) — and the entry separates them, since only the
  first closes the responder-transfer prediction while checks 2 and 3 confirm the
  end-of-document behaviour AD28 predicted by **reading** `usePacer.ts` rather
  than running it. **Granularity is recorded as a limitation rather than
  elided:** the report was that testing passed on both surfaces, not a per-check
  transcript, so no timing, counter reading, screenshot or per-surface breakdown
  exists, and none is invented — this is materially weaker evidence than AF32's
  transcribed counters or AF33's split table, and the entry says so. The project
  owner ran both surfaces and reported the result; **I witnessed neither and ran
  no device or emulator**, so 👁 is inherited and 📐 is mine from the source
  read. Not established: no measurement at book length — which matters most here,
  since mechanism (a) mounts one Pressability instance per word and that is
  exactly the cost web's delegation avoided — no rotation or font-scale testing,
  nothing about tap behaviour or hit accuracy beyond the 176-word sample, AD28's
  32 dp touch-target limitation unaddressed, and still a debug build. **AD28 is
  not edited**, per this file's append-only convention; AF40 cross-references it
  and not the reverse.
- 2026-09-02 — appended **AF41** on `feature/release-signing`, recording the
  repo's **second** `expo prebuild` (AD17's was the first) and the evidence it
  produced. Unlike the device-flavoured entries above, this one **was executed
  by me** — no emulator, device or Gradle build was involved. Records the
  pre-flight that made a destructive regeneration safe: all **54/54** non-build
  files under `android/` sat in a two-second mtime window, and the method
  matters because a hand edit carries an isolated later mtime, so a clean 54/54
  is positive evidence of absence. `npx expo prebuild --platform android
  --no-install` ran clean by default (SDK 57), deleting and regenerating the
  tree; `applicationId 'com.arishh.readingaid'` is confirmed **from the
  regenerated file**, so AD17's rename is reproduced by prebuild rather than
  being a fragile artifact of the first generation. `app.json`'s `name` change
  landed as `app_name` in `strings.xml` and as `rootProject.name` in
  `settings.gradle`, both predicted by `Name.js`; the APK output filename is
  unaffected because AGP names the artifact from the module. **Two null results,
  recorded explicitly per AF30's precedent:** `build.gradle` is **byte-identical**
  to its pre-prebuild snapshot (same sha256, line numbers included), so zero
  template drift between 2026-09-01 and 2026-09-02 — which matters because the
  verbatim blocks in `RELEASE-SIGNING.md` are anchored against that text; and
  `package.json` was **not** rewritten (identical hash either side), the
  condition that would have stopped the work. **A prediction made earlier in the
  same session is corrected:** the dirty-git guard did not merely fail to block,
  it never logged at all — `env.js:87` defines `EXPO_NO_GIT_STATUS` as
  `boolish(..., true)`, so `git.js:84` short-circuits before the warning and
  before any status check; and it could not have protected `android/` regardless,
  since a gitignored directory never appears in `git status --porcelain`. Not
  established: **nothing about the signing configuration was executed** — no
  Gradle run, no `assembleRelease`, so AD30's acceptance check (a non-debug
  certificate, plus the negative control of a missing `keystore.properties`
  failing the build) is pending; the display name has not been seen under a
  launcher icon; AF26 point 3 and AF27's release-mode gap are untouched; and
  "zero drift" is claimed for `build.gradle` specifically, not for the other 50
  regenerated files, which were not diffed.
- 2026-09-03 — appended **AF42** on `feature/release-signing`, closing AD30's
  pending acceptance check and recording **the first release-mode evidence this
  repo has ever held**. The **negative control is written first because it is
  the stronger result**: with `keystore.properties` renamed away,
  `./gradlew assembleRelease` reported `BUILD FAILED in 16s` and
  `28 actionable tasks: 28 up-to-date` — **zero tasks executed**, so Gradle
  configured, built the task graph, threw at `build.gradle:124` and stopped
  without compiling, packaging or emitting any artifact. That measures the
  relocation AD30 made on reasoning alone: the guard fired **at all**, fired
  **after configuration and before execution**, and **named the missing file by
  absolute path** — three independent confirmations from one run, and the
  template default would have silently emitted a debug-signed APK in exactly
  this condition. The three-level fail-safe is recorded as **one-third measured**:
  level 1 (the `taskGraph.whenReady` throw) is measured, level 2 (an unpopulated
  `signingConfigs.release`) was necessarily in that state but nothing depended on
  it, and level 3 (`signingConfig null` → an unsigned APK Android refuses to
  install) is **unexercised** and remains a source-level property. The real build
  then succeeded and `apksigner verify --print-certs` confirmed the certificate is
  **the project owner's release key, not the Android debug key** — **no
  certificate field value is recorded and none was transmitted**. The APK was
  copied manually to a physical phone, installed and tested, satisfying **AD24
  `D-L` in full**: an artifact the owner built, not downloaded or shared, running
  with no laptop attached, which retires that clause's ❓. **AF26 point 3 and AF27
  are partially superseded** — release-mode Hermes bytecode precompilation
  **works** on this device (`hermesEnabled=true` 📐), where every prior device
  observation in this file was a debug build. **Bounded precisely:**
  `minifyEnabled` is **false** and the property is absent from
  `gradle.properties` 📐, so **R8/Proguard did not run** — AF26 point 3 names both
  concerns and this closes the Hermes half only. Also not established: only
  **one** of the universal APK's four ABIs was exercised, so ABI-specific
  `libhermes.so` behaviour is narrowed rather than closed; no release-vs-debug
  performance measurement; no book-length document, so AD24 `D-G`'s revisit
  trigger is still unevaluated; and "all MVP behaviour worked" is a pass/fail
  report rather than a per-behaviour transcript, the same granularity limit AF40
  records. **The project owner ran every command; I ran no Gradle build, no
  device and no emulator and did not see the `apksigner` output** — 👁 inherited,
  📐 mine from reading the tree. **AD30 is not edited**; AF42 closes its pending
  check by cross-reference, as AF40 did for AD28.
- 2026-09-03 — appended **AF43** on `fix/doc-drift`, recovering the stage 1
  acceptance probe's **first emulator run**: **3557 frames, 179 ticks, index at
  tap 3, renders at tap 1**. It is a **completeness correction to AF32**, which
  recorded the emulator's **second** run (126 frames / 7 advances) and omitted
  the first — **the omission was in the instruction AF32 was written from, not
  in AF32's reading of it**, so nothing in AF32 is wrong and **AF32 is not
  edited**; AF43 cross-references it in this direction only, as AF31 did to
  AF28. Records why a render count of **1** is evidence rather than a dead
  instrument — the counter is a **tap** count, and AF32 itself establishes this
  when it explains its device run B reading 7 for seven taps — so the count
  never moved across 3557 frames on its own and moved by exactly one on the
  negative control. **Surfaces are kept apart and explicitly not merged:** this
  is the **emulator**, AF32's 1339 frames / 66 advances are **physical
  hardware**, and **AF35** records that the two are not interchangeable, so the
  3557-frame figure must never be quoted as a larger version of the device
  evidence — it is a longer run on a more pessimistic surface, adding
  **duration** on the one property that is not timing-sensitive. Attribution:
  **the project owner witnessed the run and reported it from a screenshot; I
  ran no emulator and no device and did not see the screenshot**, so 👁 is
  inherited and the entry has no 🧪 or 📐 half. Not established: no frame
  timings were reported, so it contributes nothing to AF35; it is a **debug**
  build; and it says nothing about book length. The figures are cited by
  `src/reader/WordBox.tsx`'s docblock, which before this entry pointed at no
  finding.
- 2026-09-04 — appended **AF44** on `feature/lint-and-ci`, recording ESLint's
  first run on this repo. **Executed by me**, unlike almost every entry above;
  no device, emulator or Gradle was involved. Resolved `eslint@9.39.5`,
  `eslint-config-expo@57.0.2` and — transitively, via that config's `^7.0.0` —
  `eslint-plugin-react-hooks@7.1.1`. **Three scoping premises measured false.**
  (1) The repo had **eight** stock-config errors, not seven: the seven
  `usePacer.ts` line numbers were all exact, but an eighth,
  `types/hermes-globals.d.ts:19`'s `declare var console` (AD4), was missing
  from the scoping. (2) The React Compiler rules do **not** fire because
  `app.json` sets `experiments.reactCompiler` — `eslint-config-expo` contains
  **no reference** to `app.json`, `reactCompiler` or `experiments` anywhere;
  they come from `eslint-plugin-react-hooks@7.1.1`'s `configs.recommended`,
  which sets all three to `"error"` unconditionally, spread wholesale at
  `flat/utils/react.js:27`. The `app.json` opt-in is real but governs the
  Metro/Babel build, with no path to ESLint. Recorded at length because
  **AF37** names exactly this as the failure nothing here can catch.
  (3) `no-console`'s subject is **not** `epubStructure.ts`, whose two
  intentional warns `allow: ['warn']` silences so completely that **zero**
  `no-console` hits exist in any `.ts`/`.tsx` — the real **61** are
  `console.log`/`.error` in the fourteen `.mjs` files, their entire output
  mechanism. Full pre-override Level 2 measurement: **82 problems** (61
  `no-console`, 13 `import/order` — all `.mjs`, all the identical
  `esbuild`-before-`node:path` idiom, **nine of the thirteen files
  manifest-pinned** — plus the 7 + 1 above). A hard config constraint measured
  rather than reasoned about: `eslint-config-expo` registers
  `@typescript-eslint` only inside a TS-scoped block, so naming its rules
  unscoped makes ESLint **refuse to start**; and stock sets its
  `no-unused-vars` to `warn`, so escalating to `error` is a real change.
  **Result: `npm run lint` exits 0, 0 errors, 0 warnings, across 39 files** —
  39 rather than the 38 measured before the config existed, because
  `eslint.config.js` lints itself. That config needed **no** CommonJS-scoped
  block, and a **negative control** proved the clean pass is real rather than a
  dormant rule (`no-undef` and `no-unused-vars` both fired on an injected
  identifier); a **first, invalid control attempt is recorded rather than
  discarded** — placed at top level it threw `ReferenceError` at load, because
  ESLint *executes* a flat config, so it measured the loader not the linter.
  **The `.mjs` gap is NARROWED, NOT CLOSED, and the entry refuses the
  unqualified claim:** resolved via `calculateConfigForFile`, **67 rules stay
  active** on a `.mjs` suite (46 error, 21 warn) — `no-undef`, `no-dupe-keys`,
  `use-isnan`, `valid-typeof`, `eqeqeq`, `prefer-const`, `no-unreachable`,
  `no-unused-vars` among them, enumerated in full — and exactly **two** are
  off, `no-console` and `import/order`, **both stylistic**. `--max-warnings 0`
  means the warn-level rules gate too. **Control that ESLint covers `.mjs`
  where `tsc` cannot:** `tsc --noEmit --listFilesOnly` includes
  `scripts/check-core-baseline.mjs` **zero** times, while ESLint reported three
  injected violations there; reverted, and the file re-hashed identical.
  Cleanups measured: `npm ci` took 229 top-level entries to **28** with **201**
  extraneous cleared (and a clean install then resolved *identical* versions to
  the residue); `example/` held the **only** references to the deleted assets,
  eleven `require()` sites; the fourteen assets total **exactly 446,089** bytes,
  summed rather than accepted, `logo-glow.png` alone 331,624 of it. **Not
  established:** the workflow **has never run** — parsed locally with
  `yaml@2.9.0` and its shape asserted (single job key `static-and-suites`, no
  `name:` override, no `paths` key under any trigger, `node-version: '26'`,
  eight steps ending in lint), which says **nothing** about whether Actions
  accepts it; nothing here is behavioural evidence and every 👁 limit in
  AF32–AF43 stands; no type-aware linting ran; `npm run check` is unchanged at
  13 suites and 310 checks and deliberately excludes lint; and a **latent**
  editor hazard is recorded — `.vscode/settings.json`'s unqualified
  `source.fixAll` would activate ESLint autofix on save over the twenty-six
  pinned files if `dbaeumer.vscode-eslint` is ever installed (it is not: seven
  extensions, none ESLint), with `check:baseline` on every PR as the backstop.
  Decisions are **AD34**.
- 2026-09-04 — appended **AF45** on `chore/ci-action-majors`, closing the one
  item **AF44** left explicitly open: *"THE WORKFLOW HAS NEVER RUN."* It has.
  Run **33886447430** on PR #23 (`pull_request`, `feature/lint-and-ci`)
  succeeded in about **41 seconds** on runner **2.337.0**, image
  `ubuntu-24.04 / 20260831.293.1`. **Measured by me** from `gh run view --log`
  plus live registry and GitHub API queries — no device, emulator or Gradle was
  involved, so this section carries **no 👁 at all**, unlike AF27-AF43.
  **AF44 is not edited.** What the tick establishes: the required-check name
  renders as **`static-and-suites`** — the job key verbatim, no `name:`
  override — which is the property local parsing could not reach and the one
  that branch protection binds to; **all eight authored steps executed** in
  order; and the suites agree with local **exactly** — baseline
  `26 files checked, 20 under src/core/, 0 mismatches`, then
  17+18+14+9+15+14+12+26 = **125** and 20+73+27+35+30 = **185**, **310 checks
  across 13 suites**, summed from the log. **CI and local are not
  byte-identical:** `node-version: '26'` resolved to **v26.8.1** against local
  **v26.7.0** — the major pin floating the patch, which is the pin working as
  designed, recorded as a **fact** so a future local-versus-CI disagreement is
  looked for here first. **Install figures are COLD** — the log reads
  `npm cache is not found`, so this was a cache miss that then saved:
  **818 packages**, `npm ci` self-reporting **19s** (step wall clock 18s), cache
  **186,214,307 bytes**. Those numbers **retroactively support AD34's one-job
  decision quantitatively**: the install is 19s of a 41s job while the four
  behavioural steps total about **4 seconds** (suites ~1s), so separate jobs
  would multiply a 19s install to parallelise ~4s. New install-time surface:
  **`unrs-resolver@1.12.2`** now carries a postinstall alongside
  `esbuild@0.28.2`, arriving transitively through
  `eslint-import-resolver-typescript`, so **AD34's lint adoption introduced
  it**; both scripts are unapproved, did not run, and nothing broke — the same
  shape **AF13** records for esbuild, though whether `unrs-resolver` shares
  esbuild's optional-platform-dependency property was **not** investigated.
  **A scoping claim is corrected by measurement:** the 14 moderate
  vulnerabilities are **NOT devDependencies-only** — `npm audit --omit=dev`
  still reports all 14, because `expo`, `expo-router` and `expo-splash-screen`
  are `dependencies`; they fan out from exactly **two** root advisories
  (`decode-uri-component@0.2.2` ← `query-string` ← `expo-router`;
  `uuid@7.0.3` ← `xcode` ← `@expo/config-plugins` ← `expo-splash-screen`), and
  **no fix is available to this repo without Expo bumping**, so they are
  recorded and not actioned — and they predate the lint work. **An honest limit
  on the tick, recorded because it is the same principle that produced the
  `static-and-suites` name:** ESLint is **silent on success**, so the Lint
  step's entire output is the npm banner and **the CI log contains no positive
  evidence that anything was linted** — a config whose `ignores` matched the
  whole tree would exit 0 identically. That is a limit on the evidence, not a
  suspected defect, because AF44 closed coverage **locally** against two
  negative controls and CI runs the identical config bytes; but if `ignores` is
  ever widened, **nothing in CI will notice**. Not established: nothing here is
  behavioural evidence about the app and no 👁 limit in AF32-AF43 is narrowed;
  **this run does NOT cover the `@v7` bump this branch makes** — PR #23 ran
  `@v4` and closed with the Node 20 forcing warning, and no local command can
  execute a runner, so `@v7` is this branch's own pending acceptance check;
  cache-*restore* is unmeasured, only a cold run exists; only `ubuntu-latest`
  was exercised, itself a moving target; and **branch protection was not
  exercised** — `main` was unprotected when #23 merged, so that the required
  check binds to the job key is inferred from the rendered name, not observed.
  Decisions are **AD35**.
- 2026-09-04 — appended **AF46** on `feature/versioncode-release-sequence`.
  Measured, from the installed `@expo/config-plugins@57.0.9` /
  `@expo/prebuild-config` packages: `getVersionCode`'s `?? 1` default and
  `setVersionCode`'s **non-global** rewrite pattern (`Version.js:74-80`);
  `withVersion`'s position in the Android default plugin chain
  (`withDefaultPlugins.js:152`); and `expo.android.version`'s override of root
  `expo.version` (`Version.js:63-65`), unexercised in this repo. **A regex
  collision was reproduced by direct simulation, not inferred**:
  `setPackageInBuildGradle`'s **global** `applicationId`/`namespace` pattern
  (`Package.js:273`) rewrote both a `defaultConfig` and a `productFlavors`
  block's `applicationId` to one value when replayed against a hand-built
  `build.gradle` string, while a parallel simulation confirmed
  `applicationIdSuffix` and a flavour's own `versionCode` line both survive —
  the asymmetry that makes the collision easy to miss. On-disk state
  (`android/app/build.gradle:142-143`, `versionCode 1`) and the existing
  release APK (`aapt dump badging`, `output-metadata.json`, both agreeing on
  `versionCode='1'`, file **110,763,372 bytes**, mtime 2026-09-02 18:08:07)
  were measured directly, with `aapt` located under the Android SDK
  build-tools rather than on `PATH`. **Explicitly flagged as inference, not
  measurement:** that this APK is what is currently installed on the phone —
  nothing here queried a device. **A CI blocker was found as a side effect,
  unrelated to `versionCode` and flagged ahead of it**: the workflow runs no
  Gradle or Android task today (zero hits for `gradlew`/`assembleRelease`
  grepped from `.github/workflows/static-and-suites.yml`), but `android/`'s
  AD30 signing guard (`build.gradle:121-129`) throws on any task matching
  `/(?i)release/` when `keystore.properties` is absent — which it always would
  be in a CI checkout, since it is gitignored. Latent today; will fire the
  first time a Gradle release-or-UAT task is added to CI without a
  secrets-injected `keystore.properties`. Per-`applicationId` `versionCode`
  monotonicity is tagged ❓ throughout as general Android platform behaviour,
  not something this repo's files could establish. Decisions are **AD36**.
- 2026-09-04 — appended **AF47** on `docs/uat-investigation-findings`, landing
  a read-only UAT CI feasibility investigation before it was lost, and
  **correcting AF46**: AD30's guard does not fire in CI, because CI never
  receives the gitignored, hand-edited `android/app/build.gradle` that
  carries it — `git ls-files android` returns **0**, so a CI checkout
  prebuilds from the **stock** `expo-template-bare-minimum@57.0.22` template
  instead, whose `release { signingConfig signingConfigs.debug }` (confirmed
  this session by pulling the package fresh from the npm registry) has no
  guard, no `releaseSigningError`, and no keystore check of any kind — the
  real CI failure mode is **fail-open**, the exact silent-wrong-artifact
  outcome AD30 exists to prevent, and materialising `keystore.properties`
  from secrets into that tree fixes nothing on its own since nothing there
  reads it. **AF46 is not edited.** The same stock file's `debug` signing
  block ships `storePassword 'android'` / `keyAlias 'androiddebugkey'` /
  `keyPassword 'android'` in plain text — independently re-hashed and
  DN-checked this session (`221e0a31…f5e58`, `CN=Android Debug, OU=Android,
  O=Unknown, L=Unknown, ST=Unknown, C=US`) — a stronger, more local rejection
  ground for debug-signing than "the key is published on npm." Also records:
  the `=~ /(?i)release/` guard-match asymmetry between a `uat` product
  flavour's `assembleUatRelease` (matches) and a differently-named `uat`
  buildType (would not); the four mechanisms available for delivering a
  signing config into a CI-generated tree; runner viability (SDK/build-tools/
  JDK matched, NDK/CMake mismatched, hardware figures flagged as an estimate);
  delivery-mechanism measurements (Release-asset-vs-artifact access, artifact
  URL expiry, size limits); repo posture (public, no secrets/variables/
  environments, `default_workflow_permissions: read`); fork-PR secret
  exclusion and the `pull_request_target`/`workflow_run` hazard;
  `workflow_dispatch`'s write-access-and-default-branch requirement;
  `app.config.ts` loading via `typescript`'s `transpileModule` with zero new
  dependencies; and an `expo.scheme` collision a future UAT overlay must
  avoid. Closes with a **third** provenance correction: a "~0.52 GB install"
  figure repeated across prompts in this workstream appears nowhere in this
  repo's docs — **AF45** records **186,214,307 bytes** for that exact job, a
  different figure entirely, carried in unchecked from a prior chat summary.
  Two stale strings are corrected in the same change: `README.md` and
  `RELEASE-SIGNING.md` both quoted a debug-signed certificate's DN as
  `CN=Android Debug, O=Android, C=US`; the measured value is `CN=Android
  Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US`. No
  `DECISIONS.md` entry: nothing here is a decision.
- 2026-09-04 — appended **AF48** on `feature/uat-config-overlay`. **Measured by
  me**, in this tree; no prebuild, Gradle, emulator or device was involved, so
  the section carries **no 👁**. Records that **`app.json`'s
  `adaptiveIcon.backgroundColor` is ALREADY a no-op in the shipped release
  app** — `withAndroidIcons.js:239` resolves the adaptive icon's background to
  `@mipmap/ic_launcher_background` whenever a `backgroundImage` is set, leaving
  `@color/iconBackground` written to `colors.xml` and referenced by nothing,
  with Expo's own `// backgroundImage overrides backgroundColor` at `:288` and
  `withAndroidIcons` swept as the only reader. **Why it went unnoticed is the
  interesting half**: decoding both PNGs shows the background image is **97.5%
  exactly `#e6f4fe`**, the very colour the redundant field declares, so the two
  have never disagreed visibly. **Deliberately NOT fixed** — release identity is
  untouched by AD37 — and recorded so the field can be discovered to do nothing.
  **Corrects a premise the change was scoped under, at the project owner's
  direction**: TypeScript 7 would not silently break config loading, because
  `require-utils/load.js:335-341` falls back to Node's
  `module.stripTypeScriptTypes` (present on Node v26.7.0), and Expo's source
  anticipates the TS 7 case in a comment at `:77-78`. Two couplings, not one;
  the failure mode is a silent transpiler **substitution**, and the operative
  constraint is **erasability**, demonstrated by a control in which `tsc` exits
  0 and the suite exits 1 on an added `enum`. Also records: the overlay resolved
  **both ways through Expo's real `evalConfig`**, with
  `mayHaveUnusedStaticConfig: false` on both paths — confirming the by-reference
  return preserves Expo's `Symbol` marker and that object spread carries
  symbol-keyed properties; the `#FFEB3B` contrast table (3.10:1 against the
  release background's 3.38:1); versionCode headroom (**minutes 29,809,147, ~3,939
  years**; seconds ~9.9 years, which is why minutes won); **four negative
  controls**, each failing exactly the checks it should, with `app.config.ts`
  restored byte-identical; and `eslint-plugin-expo`'s `no-dynamic-env-var`
  forcing literal `process.env.NAME` access. **A THIRD self-caught invalid
  control** is recorded rather than discarded: the first `tsc` probe was named
  `.probe-env.ts` and reported exit 0 on a deliberate type error, because
  **TypeScript's `include` globs do not match dotfiles** — it was measuring its
  own filename. Re-run undotted it gave TS2322 / exit 2. With AF44's two
  (the flat-config probe that threw at load and so measured the loader, and the
  `paths:` sweep whose only hit was the comment forbidding the key) the pattern
  is now visible: each invalid control produced a confident, plausible, wrong
  answer, and each was exposed by testing the instrument against a
  known-in-advance outcome. New tallies: **14 suites, 357 checks**, baseline
  unchanged at 26 files / 0 mismatches. Not established: **nothing was run on
  hardware** — the icon, label, side-by-side install and upgrade path are all
  pending acceptance checks; the suite tests the overlay, not Expo's resolution;
  and every 👁 limit in AF27–AF43 stands. Decisions are **AD37**.
