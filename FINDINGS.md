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
