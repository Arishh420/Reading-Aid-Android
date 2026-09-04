# Decision Log (Android)

> Append-only record of judgment calls and resolved forks made **in this
> repo** (ReadingAidAndroid). Each entry: **what** was decided, **why**, and
> the alternative rejected, where one existed. New entries go at the bottom of
> their milestone section; nothing here is rewritten — a correction is
> appended as a new entry that says what it corrects.
>
> **Numbering convention:** entries here are `AD1`, `AD2`, … — the `A` marks
> this as the **Android** log. CLAUDE.md's back-references to `D1`/`D67` etc.
> (bare, unprefixed) point at the **web repo's** (Reading Aid Tool)
> `DECISIONS.md`, a separate, older, and much larger log. The two numbering
> spaces are intentionally disjoint so a bare `D#` is never ambiguous with an
> `AD#` on sight. Where a decision here is inherited from a web-repo decision
> rather than made fresh, the entry says so explicitly and cites the web
> repo's ID as a back-reference, not a live pointer.
>
> **Reading order — entries are grouped by MILESTONE, not by date, and the two
> disagree in one place.** Milestone sections appear in the order they were
> opened, and an entry is appended to *its own* milestone section, so a later
> entry can sit above an earlier one. Concretely: **AD31 appears above AD30**,
> because AD31 settles `D-D` and belongs to the MVP-planning milestone, while
> AD30 opened the later release-signing milestone. Read the **change log at the
> bottom of this file** for true chronological order — it is dated and correct.
> Nothing is missing and no entry number is skipped.
>
> Companion to [FINDINGS.md](FINDINGS.md) (what was *learned*, as opposed to
> what was *decided*).

---

## Milestone: core/ seeding + portability guard

- **AD1 · `src/core/` preserves the web repo's internal structure
  (`model/`, `pacer/`, `parsers/`, `reader/`, `ui/`) rather than flattening
  it.** Chosen so the seeded files stay byte-identical to their web-repo
  originals and remain diffable against them, which matters because the
  core-drift problem (two copies of the same logic, one per repo) is
  unresolved — see the web repo's PORT-PLAN.md §5. Accepted knowingly as part
  of this choice: `core/ui/` holds no UI and `core/reader/` holds no reader.
  Confirmed by reading the seeded files — `src/core/ui/theme.ts` and
  `src/core/ui/sample.ts` are constants and a sample string, and
  `src/core/reader/bionic.ts` is pure head/tail split logic; none renders
  anything. The directory names describe where each module lives in the web
  repo's tree, not what exists in this one.

- **AD2 · `settings-defaults.ts` was excluded from the seed set despite
  measuring closure-clean.** The closure-purity method used to pick the 12
  seeded files reported it as importing nothing impure, but that reading is a
  false positive: esbuild erases its four `import type` specifiers, so the
  closure walk never sees that the interfaces they name (`RsvpSettings` and
  siblings) live in React component modules. Isolating the file — as
  `tsconfig.core.json` now does for everything under `src/core/` — fails
  typecheck on those missing interfaces. Confirmed here only indirectly: the
  file is absent from the current 12-file `src/core/` tree
  (`src/core/model`, `src/core/pacer`, `src/core/parsers`, `src/core/reader`,
  `src/core/ui`), consistent with it having been excluded; the closure/typecheck
  behavior itself was not re-run in this repo and is recorded as reported.

- **AD3 · The `core/` portability guard (`tsconfig.core.json`) is standalone
  — it deliberately does not extend `expo/tsconfig.base`.** The base sets
  `lib: ["DOM", "ESNext"]` (confirmed by reading
  `node_modules/expo/tsconfig.base.json`), which is exactly what the guard
  exists to exclude. Extending the base and then overriding `lib` would work
  today but would silently re-admit DOM if a future Expo SDK bump changed the
  base's `lib` entry; restating everything explicitly in `tsconfig.core.json`
  means the guard can't drift out from under itself. Alternative rejected:
  extend-and-override, for the drift reason above.

- **AD4 · `console` is provided to `core/` via a minimal five-method ambient
  declaration (`types/hermes-globals.d.ts`) rather than `@types/node`.**
  `@types/node` was free — already present transitively — but it also
  supplies `Buffer`, `process`, `require`, `__dirname`: Node-host globals, not
  Hermes ones. Taking it would have traded the DOM hole the guard exists to
  close for a Node-shaped hole of the same kind. The declaration is scoped to
  five logging methods only and is excluded from the main (`tsconfig.json`)
  program so it can't collide with `lib.dom`'s own `console` there.

- **AD5 · The guard chains into `npm run build` (`tsc --noEmit && npm run
  build:core`) rather than standing alone.** Argument against chaining: it
  couples two independent checks, so a `core/` portability break now fails
  the same command as an ordinary app-tree type error, and every build
  invocation pays the extra `tsc -p tsconfig.core.json` pass. Argument for,
  and the one that won: CLAUDE.md §3 defines "clean" in terms of `npm run
  build` specifically, and a guard that only runs when someone remembers to
  invoke it separately is a guard that will eventually stop running. `build`
  and `build:core` are both still independently invocable — chaining adds to
  `build` rather than replacing `build:core`.

- **AD6 · Storage: MMKV, synchronous.** Inherited from the web repo's
  PORT-PLAN.md §3, decided there before `core/` seeding began in this repo —
  recorded here as an inherited decision, not a fresh one. `react-native-mmkv`
  is present in `package.json`'s dependencies, but as of this entry nothing
  under `src/` references MMKV or any storage layer (`grep -ril
  "mmkv\|storage" src/` returns nothing) — it is a declared dependency only,
  not yet implemented in this repo.

## Milestone: headless suite port (Node execution of `core/`)

- **AD7 · `esbuild` is a devDependency of this repo, installed with `npx expo
  install --dev esbuild`.** The eight ported suites do not test a hand-copied
  reduction of the logic — each one esbuild-bundles the *real* `.ts` source and
  imports the result, which is the whole reason they are worth porting. In the
  web repo esbuild is available transitively via Vite; this repo uses Metro,
  which does not provide it, so it had to be declared. `expo install` supports
  `--dev` (confirmed from `npx expo install --help`) and delegated to
  `npm install --save-dev esbuild`, so the Expo-sanctioned install path was
  used rather than a raw `npm install`. It is a **dev** dependency only: it
  must never reach the app bundle, and nothing under `src/` imports it — only
  the `*-headless-test.mjs` files do, and those are `.mjs`, invisible to Metro's
  `expo-router/entry` graph.
  Version drift accepted knowingly: `expo install` resolved `^0.28.2`, whereas
  the web repo's transitive copy is `0.25.12`. Alternative rejected: pinning
  `0.25.12` to eliminate the bundler as a variable. Rejected because esbuild's
  job here is only TS→JS erasure plus module concatenation over DOM-free,
  dependency-free modules, and overriding the sanctioned resolution to match
  another repo's transitive pin is a maintenance burden with no measured
  benefit. The drift is disclosed instead (see FINDINGS AF15) so that if a
  suite ever diverges between the two repos, `0.25.12` is the first variable to
  test.

- **AD8 · Eight of the web repo's twelve headless suites were ported; four were
  excluded because their subjects are not in `src/core/`.** Ported: `tokenize`,
  `delimiterSpans` (+`orp`), `orp`, `dwell`, `markdown`, `pdfText`,
  `epubStructure`, and `spine-integrity` (`tokenize` + `markdown` + `pdfText` +
  `epubStructure`). Excluded, with the dependency verified directly rather than
  taken on trust — by reading each suite's `entryPoints` / `bundleAndImport`
  call sites in the web repo:
  `pacer/headless-test.mjs` bundles `keyboard.ts`;
  `parsers/pdf-headless-test.mjs` bundles `pdf.ts` (and stubs `pdfjs-dist`
  through an esbuild resolve plugin, because the non-legacy build needs
  `DOMMatrix`); `storage/headless-test.mjs` bundles `readingPosition.ts`; and
  `presets/headless-test.mjs` bundles nothing at all — it imports only
  `node:assert/strict` and hand-mirrors the preset literals. None of
  `keyboard.ts`, `pdf.ts`, or `readingPosition.ts` is among the twelve seeded
  files, and a suite that imports no source proves nothing about `core/`.
  Deliberately *not* done: stubbing or adapting any of the four to make it
  runnable here. A suite that has been adapted is no longer the same evidence.

- **AD9 · The eight suites are byte-identical copies — zero lines changed,
  including the path lines.** The port was expected to need its bundling paths
  repointed at `src/core/`; it did not. Every suite resolves its entry through
  `path.join(__dirname, …)` — `'tokenize.ts'`, `'../pacer/orp.ts'`,
  `'../model/tokenize.ts'` and so on — so preserving the web repo's internal
  directory shape (AD1) means those relative paths already resolve correctly
  once the suite sits beside its subject under `src/core/`. This is the first
  concrete payoff of AD1's structure-preserving choice.
  Alternative rejected: rewriting the doc-comment prose inside the suites, which
  still says things like "esbuild-bundles the real `src/model/tokenize.ts`"
  where this repo's copy lives at `src/core/model/tokenize.ts`. Rejected for
  AD1's own reason — byte-identity is what keeps these diffable against the
  web-repo originals, and the unprefixed paths read correctly as web-repo
  back-references, exactly as the bare `F#`/`D#` IDs in these logs do. The
  cost is real and is recorded rather than fixed: the prose paths are one
  directory level short of this repo's layout.

- **AD10 · `npm run test:core` was deliberately NOT chained into `npm run
  build`, and this entry records the recommendation rather than implementing
  it.** The question is a live fork, so both sides are written down.
  *For chaining* — this is AD5's argument verbatim: CLAUDE.md §3 defines
  "clean" in terms of `npm run build`, and a check that only runs when someone
  remembers to invoke it is a check that will eventually stop running. These
  eight suites are currently the *only* executable evidence that `core/` works,
  so they are exactly the kind of thing that should not depend on memory.
  *Against chaining* — `build` today means one narrow, hermetic thing:
  "everything typechecks, and `core/` is DOM-free." Both halves are static,
  deterministic, and need no binary beyond `tsc`. `test:core` is a different
  kind of check: it spawns eight Node processes, depends on esbuild's
  platform-specific native binary (which can be absent on a fresh clone whose
  install scripts were not approved — see AF13), and writes temporary `.mjs`
  files into `src/core/` while running. Folding that into `build` also widens
  the failure-attribution problem AD5 already accepted once: a red `build`
  would then mean a type error, a DOM leak, *or* a behavioural regression.
  *Recommendation:* do **not** chain it into `build`. Instead, in a separate
  change, add an aggregate — `"check": "npm run build && npm run test:core"` —
  and move CLAUDE.md §3's "must stay clean" target to `check`. That answers the
  AD5 objection (the suites land on a default path, not on memory) without
  giving up a purely static `build` that works on a fresh clone with no native
  binary — which matters, because the portability guard's credibility rests on
  `build` being cheap and unconditional.

## Milestone: `check` script + gitignore hardening (resolving deferred items)

- **AD11 · AD10's deferred fork is resolved by adding a `check` script
  exactly as AD10 recommended, without touching `build` or `test:core`.**
  `package.json` now has `"check": "npm run build && npm run test:core"`,
  added as a new line; `build` and `test:core` are byte-for-byte unchanged.
  Confirmed the `&&` actually propagates failure rather than assuming it:
  `test:core` was temporarily repointed at a scratch script
  (`node <scratchpad>/scratch-fail.mjs`, outside the repo) that unconditionally
  exits 1; `npm run check` ran `build` (clean) then `test:core` (the scratch
  script) and exited 1 itself. `package.json` was then restored and `git diff
  package.json` showed only the intended one-line `check` addition, `test:core`
  back to its original string. Before that, `npm run check` was run once
  against the real eight suites and exited 0 (see FINDINGS AF18 for the
  count). *CLAUDE.md §3's "must stay clean" target was deliberately left
  pointing at `build`, not moved to `check`* — see AD12.

- **AD12 · The CLAUDE.md §3 "must stay clean" target is NOT being moved from
  `build` to `check` in this repo, despite AD10 recommending exactly that
  move.** CLAUDE.md states at its own top that it "carries verbatim between
  repos" (its §4 preamble, and the web repo's PORT-PLAN.md §4, cited there as
  the source of that constraint) — editing §3 here would either desync this
  repo's copy from the web repo's, or require a matching edit in a repo this
  task has no mandate to touch. This is a cross-repo decision, not a
  single-repo one, so it is out of scope for a change confined to
  `package.json` / `.gitignore` / these two logs. Flagged for a human
  (Delta) to carry into the web repo rather than made unilaterally here. What
  the edit would say, if made: replace "`npm run build` must stay clean"
  with "`npm run check` must stay clean" in §3 — i.e. redefine "clean" as
  build **plus** the eight headless suites passing, matching AD11's `check`
  script. Alternative rejected (implicitly, by not acting): editing §3 now and
  accepting the desync. Rejected because CLAUDE.md is explicit that
  desyncing the two copies is the failure mode the verbatim-carry rule exists
  to prevent.

- **AD13 · The headless-suite temp-file `.gitignore` rule is `.headless-*.mjs`,
  a single line with no directory scoping.** The pattern was read out of the
  suite source rather than assumed from FINDINGS AF16's prose gloss: every
  suite's `tmpPath` is built as `` `.headless-<name-or-tmpName>-${process.pid}` ``
  (some suites add a trailing `-${Math.random()...}` segment too), always
  prefixed with the literal string `.headless-` and suffixed `.mjs`. All eight
  committed suites are named `*-headless-test.mjs` — the fixed word order and
  lack of a leading dot means `.headless-*.mjs` cannot match any of them; the
  two name families are disjoint by construction (leading-dot prefix vs. no
  leading dot), not by coincidence that happens to hold today. Verified
  directly rather than trusted: created a scratch file matching the real
  pattern inside `src/core/model/`, confirmed `git check-ignore -v` reported it
  ignored by the new rule, confirmed `git ls-files src/core | grep mjs` still
  listed all eight suites, then deleted the scratch file (see FINDINGS AF19).
  Alternative rejected: scoping the rule to `src/core/.headless-*.mjs`.
  Rejected as unnecessary — the dot-prefix already makes the pattern specific
  enough that a repo-wide rule carries no realistic collision risk, and every
  suite that writes one of these files already writes it beside its own
  subject under `src/core/` (AF16), so a global rule and a scoped one cover
  the same files in practice; the unscoped form is simpler.

- **AD14 · AD12's deferred cross-repo decision is RESOLVED — CLAUDE.md §3
  was generalized in the web repo (PR #107, merged) and copied here to
  maintain byte-identity.** The change rewrites §3's verification target from
  the static "`npm run build` must stay clean" to the platform-neutral "The
  repo's full verification command must stay clean — `check` where a repo
  defines one, otherwise `build`." This repo's `check` script (from AD11) now
  fits this wording precisely; the gate is operative and byte-identity verified
  by hash: `407d965a93d176bc5da85922c7aef0965fd53749e5f2e63cd753490b7f30e8a6`
  (confirmed `shasum -a 256` on both repo files and `diff` silent). The
  verbatim-carry rule that drove AD12 — CLAUDE.md §4's preamble — remains in
  force and was the reason this copy was made rather than an independent edit
  here. Alternative rejected: a repo-local edit that would have left the two
  copies diverged.

## Milestone: Hermes CLI feature probe

- **AD15 · Two Hermes binaries were used rather than one, splitting the
  evidence deliberately: RN 0.86.3's own compiler for everything
  compile-time, and an older standalone VM for everything runtime.** The
  fork was forced, not chosen: `node_modules/hermes-compiler`'s `hermesc` is
  the exact version RN 0.86.3 pins (`250829098.0.17`) but is **compile-only**
  — it refuses `-exec` — while the newest standalone `facebook/hermes`
  release that ships an executable VM is v0.13.0, whose binary self-reports
  0.12.0 (see FINDINGS AF20 for the measured details, including the
  `Expected 96 but got 98` bytecode refusal that proves the two are not
  interchangeable). Using both means AF12's parse-time question — the one
  AF12 itself called the sharpest risk, because an unparseable regex literal
  takes out a whole module at load — is answered at the **exact version the
  app would ship**, while the two pure-runtime builtins (`normalize`,
  `matchAll`) are answered on an engine roughly a year older.
  Alternatives rejected:
  (a) *The old CLI alone.* Rejected because it would have thrown away the one
  piece of exact-version evidence available, on the question that matters most.
  (b) *Building Hermes 250829098.0.17 from source* to get a matching VM.
  Rejected as disproportionate for a task whose stated purpose is to answer
  four questions **cheaply, before** committing to a heavier build; it is the
  right move only if a probe had actually failed.
  (c) *An emulator or device build.* Explicitly out of scope — that is the
  commitment this probe exists to de-risk, and it is what AF26 names as the
  only thing that would close the remaining gap.
  The residual weakness is disclosed rather than papered over: "these
  builtins still exist at 0.17" is an assumption, and FINDINGS AF26 records it
  as one.

- **AD16 · The probe scripts and both Hermes binaries were kept entirely
  OUTSIDE the repo, in the session scratchpad — nothing was added to the repo
  and no `.gitignore` rule was needed.** The task permitted probe scripts
  outside `src/core/`; keeping them out of the working tree altogether is
  strictly safer and was chosen for three reasons. First, `src/core/` is
  byte-pinned (AD9, AF7) and this repo has already been bitten once by a
  suite writing temp files into it (AF16/AD13) — the surest way not to repeat
  that is to have nothing to clean up. Second, the ~10.7 MB Hermes tarball
  and its extracted binaries must never be committed, and a file that is
  never inside the repo cannot be committed by accident, whereas a
  `.gitignore` rule is a promise that only holds if it is correct. Third, it
  keeps this change to exactly two files — `FINDINGS.md` and `DECISIONS.md` —
  so `git status --porcelain` stays a meaningful check (verified: it reported
  only these two docs; a search for `*.hbc`, `hermes-cli*` and `.headless-*`
  inside the repo returned nothing).
  Cost accepted knowingly, and the reason it is acceptable: the probes are
  **not reproducible from the repo** — a future session must re-download the
  VM and rewrite the entries to re-run any of this. That is the right trade
  only because these probes are one-shot evidence for a question, not a
  regression gate; `npm run check` remains the repo's standing gate and was
  deliberately left untouched. Alternative rejected: committing the probe
  entries under a new top-level directory. Rejected as scope creep — it would
  add an untested, un-typechecked, un-gated code path (exactly the gap AF14
  already flags for the `.mjs` suites) to answer a question that is now
  answered, and it would invite the assumption that something re-runs them.
  If these probes are ever wanted as a standing check, that is its own
  change, with its own decision about where the binary comes from on a fresh
  clone — the same fresh-clone concern AD10/AF13 raised about esbuild, but
  worse, since no package manager would supply the VM.

## Milestone: Android package identity

- **AD17 · `expo.android.package` was changed from the Expo-generated
  placeholder `com.anonymous.ReadingAidAndroid` to `com.arishh.readingaid`,
  before any device or Play Store install.** `npx expo prebuild --platform
  android` was run for the first time with `app.json` specifying no
  `expo.android.package`, so Expo derived the placeholder and wrote it back
  into `app.json` itself. That placeholder is not cosmetic: the Android
  package name is the app's permanent on-device and Google Play identity, and
  changing it after real distribution requires regenerating native code and
  uninstalling from every device it already reached — in practice, immutable
  once shipped. Fixing it now, before the first install anywhere beyond a
  local emulator, is the only point at which the change is nearly free.
  Verified before editing: `grep -rn "com.anonymous" --exclude-dir=node_modules
  --exclude-dir=android .` returned exactly one hit — `app.json`'s own
  `expo.android.package` line — so no other tracked file carried the
  placeholder forward. (`android/` itself is gitignored and regenerated by
  prebuild, so hits there would have been expected and out of scope; there
  were none reported regardless, since it was excluded from the grep.)
  `com.arishh.readingaid` was checked against Android's package-name rules
  before use: three lowercase segments, no hyphens, none a reserved word —
  valid. Alternative rejected: leaving the placeholder in place until closer
  to a real release. Rejected because the cost of changing it is asymmetric —
  near-zero now, a full native regeneration plus a forced reinstall on every
  device later — and nothing about deferring the rename would have made the
  eventual value any more settled.

## Milestone: MVP planning

- **AD18 · The ~18 open MVP questions are routed three ways: a new mutable
  `MVP-PLAN.md` holds the live register, `DECISIONS.md` gets an AD entry as
  each item settles, and GitHub issues in this repo carry the spikes and the
  queued work. The web repo is untouched.** The questions were living in chat,
  which means they were not durable, not diffable, and not answerable by a
  fresh session — but they are also not yet *decisions*, so appending them to
  this file would have been a category error. The split follows the shape of
  the thing being tracked. `MVP-PLAN.md` is **mutable and deliberately
  disposable**: it holds a status board, the open questions, and the arguments
  *while they are open*, and it is deleted when the MVP ships. It is modelled
  directly on the web repo's `PORT-PLAN.md` — the same kind of document
  (purpose-built, milestone-scoped, sitting alongside the canonical docs rather
  than replacing them), cited as a back-reference and not a live pointer, since
  that file is not in this repo. This file — `DECISIONS.md` — remains the
  durable record and outlives `MVP-PLAN.md`: an item's rationale is written
  here, once, at the moment it settles.

  **The anti-duplication rule is the load-bearing half of this decision, and it
  is stated inside `MVP-PLAN.md` itself so it cannot be lost when this entry is
  out of view:** the status board carries a **pointer and a one-line status,
  never restated rationale**. When an item settles, the argument moves into its
  AD entry and lives there and nowhere else; the board row shrinks to a pointer
  at that AD number and the register section is deleted. The web repo's
  `PORT-PLAN.md` §6 already runs this discipline verbatim — "The analysis is
  not restated — read the section named" — and it is adopted here for the same
  reason it exists there. The local reason is sharper: this repo has documented
  value-duplication drift twice already (AD2's `settings-defaults.ts` false
  positive, and AF8's manual `exclude`-list copy that no mechanism keeps in
  sync), so a second copy of a rationale is understood here as a second copy
  that will eventually disagree with the first.

  Alternatives rejected. **(a) Log everything as AD entries only, with no
  register.** Rejected because an append-only file cannot answer "what is still
  open" — the question the MVP most needs answered — without reading the whole
  file and mentally diffing later entries against earlier ones. That is exactly
  the work a status board does in one screen, and it is why the web repo's
  `PORT-PLAN.md` has a §1 status board despite that repo already having a
  `DECISIONS.md`. **(b) Use GitHub issues as the register.** Rejected because
  it puts the reasoning outside the repo, which cuts against this project's
  standing practice that ground truth is repo-resident — CLAUDE.md §2 makes
  docs part of "done" and names the in-repo documents as the source of truth
  alongside the issues, and every prior AD entry has been readable from a clone
  with no network. Issues are kept for the two things they are better at than a
  document: a spike that someone picks up and closes, and queued work with a
  discrete finish line.

  **One carve-out, recorded now so it is not re-litigated later: `D-D` (core
  drift across the repo boundary) is genuinely a web-repo decision, not an
  Android one.** Its four options are laid out in the web repo's
  `PORT-PLAN.md` §5.2 and are deliberately not restated here or in
  `MVP-PLAN.md`; whichever is chosen changes files on the web side. So when
  `D-D` settles it earns a **single-PR web freeze exception** — the same shape
  of cross-repo move AD14 recorded for CLAUDE.md §3, and the precedent for
  handling one deliberately rather than by drift. `D-R` (web issue #108, the
  `**hi **` emphasis bug) is explicitly sequenced *after* `D-D` for this
  reason: it is a real bug and it will be fixed, but fixing it first means
  performing the re-copy into `src/core/parsers/markdown.ts` by hand and
  learning nothing about the sync mechanism `D-D` is supposed to choose.
  Sequenced after `D-D`, it becomes that mechanism's first real exercise.

- **AD19 · `D-A` (feature scope) is settled: Flowing Highlight is the MVP's
  only pacer mode; RSVP, Chunk, bionic rendering and presets are all cut;
  one theme (`light`), one setting (WPM).** Whether that WPM value persists
  is `D-I`'s call, not this one. `light` is the seeded `DEFAULT_THEME`
  (`src/core/ui/theme.ts:16` 📐 — one of the four seeded themes). The MVP is
  therefore: plain text in a scroll view, one highlight moving through it at
  an adjustable speed, resuming where it stopped.

  **This entry settles `D-K` as well as `D-A`.** `D-K` asked whether to cut
  presets and settings entirely or ship a single fixed WPM control; cutting
  presets and keeping one WPM setting answers exactly that, and what is left
  over has homes elsewhere — persistence is `D-I`'s, the control's shape and
  placement are `D-J`'s — which is why two board rows in `MVP-PLAN.md` point
  at this one entry. The web repo's open issue #105 on preset
  value-duplication is moot for the MVP, since no preset ships.

  **Why this mode, and not the smaller-looking one.** The choice was made to
  **force `D-E`** — the per-tick highlight mechanism CLAUDE.md §4 marks
  "UNDECIDED" — rather than defer it. RSVP *looks* smaller: one `Text` node
  whose content is swapped per tick, no scroll, no virtualization ❓. But it
  hard-depends on `src/core/pacer/orp.ts`, which owns **two of AF31's three
  residue items**: `\p{M}` at `orp.ts:36` (residue item 1) and
  `normalize('NFC')` at `orp.ts:137` (residue item 2), neither exercised
  on-device. That dependency was verified rather than assumed: in the web
  repo `src/pacer/modes/Rsvp.tsx:4` is `import { splitOrp } from '../orp';`
  and it is the **only** one of the three mode components that imports `orp`
  📐 (read-only). So smallest surface and smallest risk point in opposite
  directions, and the surface argument loses.

  Flowing Highlight also **collapses `D-G`**: for a short document the right
  MVP answer is no virtualization at all — a `ScrollView` with N `Text`
  nodes ❓ — which in turn **defers `D-Q` entirely**, since that spike exists
  only because virtualization and imperative highlight interact. `D-E` does
  not go away under any mode; deferring it would ship an APK that proves
  nothing about the port's hardest unknown.

  **Why bionic is cut**, stated because the first recommendation in
  discussion was to keep it. `src/core/reader/bionic.ts` is seeded, pure,
  and applies at render rather than per tick, which makes it look free. It
  is not: bionic turns every word into a **composite** node. Its
  `BionicSplit` is three slots and its own docblock specifies the render as
  `{lead}<b>{head}</b>{tail}` (`bionic.ts:10, 22–29` 📐) — an outer text node
  wrapping a bold span and a normal span ❓. That doubles the node count and
  changes the **shape** of the thing `D-E` must manipulate. Bionic sits
  *underneath* `D-E`, not on top of it. Adding it after `D-E` is settled is a
  render-layer change; adding it before means solving `D-E` against a harder
  node shape without knowing the simple one works.

  **Alternatives rejected.** (a) *RSVP first.* It defers both `D-E` and
  `D-G`, but routes the MVP's core rendering through the least-verified
  seeded module, and satisfies `MVP-PLAN.md` §1's definition of done only in
  letter — the document is never visible and "where you left off" degrades
  to a word counter. (b) *Bionic on.* Rejected for the node-shape reason
  above.

  **What returns first, and in what order, once `D-E` is proven.** Bionic
  first: it is a render-layer change with no new dependencies. Then RSVP,
  after the queued on-device `orp` probe (`MVP-PLAN.md` §8) closes AF31
  residue items 1 and 2 — that suite covers both, since it is the
  NFD/combining-mark suite.

  **The cost, recorded honestly.** With no bionic, one theme and one mode,
  the MVP will not resemble the web app. If a client demo lands near this
  milestone, there is a real gap between "working" and "showable."

- **AD20 · `D-B` (document formats) is settled: Markdown only. PDF and EPUB
  are both cut from the MVP.** Markdown is seeded and proven on-device —
  AF28 records `parseMarkdown` producing 12 blocks and 176 words on an
  Android emulator, byte-identical to Node — so it costs nothing new.

  **PDF** is cut on two independent grounds. The web repo's
  `src/parsers/pdf.ts` imports `pdfjs-dist` (line 1) and, on line 2,
  `pdfjs-dist/build/pdf.worker.min.mjs?url` — both lines read directly from
  the web repo for this entry, read-only, so the import itself is 📐, not an
  inherited claim. `?url` is a bundler primitive with no Metro equivalent ❓,
  and it feeds a Web Worker whose URL semantics React Native does not have
  ❓; those two consequences are the unverified half. Separately, AD8 already
  records that even the web repo's *headless* PDF suite needed a `DOMMatrix`
  stub through an esbuild resolve plugin merely to run.

  **EPUB** is cut despite being the more tractable of the two, and the
  reason is not the library. `src/parsers/epub.ts:1` is
  `import JSZip from 'jszip';` 📐 — pure JS, and it probably ports ❓. The
  blocker is upstream of it: EPUB needs a **file** to unzip, which needs
  `D-H`, and neither `expo-document-picker` nor `expo-file-system` is
  installed 📐. Markdown can reach the app as a string; EPUB cannot.

  **What is not cut.** The pure halves stay seeded and untouched —
  `src/core/parsers/pdfText.ts` and `src/core/parsers/epubStructure.ts` keep
  their provenance (AF7) and their headless suites (AF9/AF10, still inside
  `npm run check`). Only the container and decode layers are absent. `D-O`
  and `D-P` therefore become post-MVP spikes that **block nothing**.

  **One consequence recorded so it is not rediscovered later.**
  `String.prototype.matchAll` is **AF31 residue item 3** and lives in
  `src/core/parsers/epubStructure.ts:90, 99, 160, 183`. Cutting EPUB parks
  that item for the duration of the MVP — and the queued on-device `orp`
  probe will **not** close it either, because that suite never bundles the
  module.

- **AD21 · `D-E` (the per-tick highlight mechanism) is settled: each block
  renders as a `View` with `flexWrap` containing one text element per word;
  a single Reanimated shared value holds the current word index, and each
  word derives its highlight style from that value on the UI thread. React
  does not re-render on a pacer tick.** This is the mechanism CLAUDE.md §4
  marks "UNDECIDED — do not treat this as settled." The invariant it serves
  and its three guards are unchanged and are not restated here.

  **Why the option set collapsed to one.** The register named three
  candidates: Reanimated shared values, `setNativeProps`, or something else.
  Two are gone before the argument starts.
  - **`setNativeProps` is unavailable.** React Native 0.82 shipped without
    the ability to disable the New Architecture, and Expo SDK 55 removed the
    opt-out flag from app config entirely ❓. This repo is RN `0.86.3` on SDK
    57 — `package.json` pins `"react-native": "0.86.3"` and `"expo":
    "~57.0.18"` 📐 — which is why `app.json` carries no `newArchEnabled` key:
    **there is no flag to set** 📐 (the key appears nowhere in the repo
    outside `node_modules/` and the generated `android/`). Under that
    architecture `setNativeProps` no longer works, and the React Native
    working group's stated reason is that it breaks the New Architecture's
    model fundamentally with no supportable path forward ❓ — vendor
    documentation, not measured here. Reanimated corroborates independently:
    4.x supports only the New Architecture ❓, and `4.5.1` is what
    `package.json` pins 📐.
  - **React state on the tick path** is what CLAUDE.md §4's invariant exists
    to forbid; its guard 2 names that exact temptation as "precisely the
    cliff."

  **Why word boxes rather than nested text.** The direct translation of the
  web implementation — one `Text` per block with a nested `Text` per word,
  animating the current one — does not work. React Native converts nested
  `Text` into a flat `NSAttributedString` / `SpannableString`, so a nested
  child is a **styled range inside the parent's attributed string, not a
  native view**; and inside a `Text`, layout stops being Flexbox and becomes
  text layout ❓. The supporting evidence is external and consistent:
  Reanimated has an open request from 2020 for animating a nested `Text`'s
  `backgroundColor` and `color`, still unimplemented; React Native issue
  #41527 records nested `Text` ignoring `transform` entirely; and
  `react-native-animateable-text`'s README gives the root cause directly —
  `createAnimatedComponent` cannot animate text because `Text`'s children are
  separate nodes rather than props ❓. **All of this is external
  documentation and issue trackers. None of it was measured on this build**,
  and none of it is upgraded past ❓ here — reading a package version is 📐,
  reading someone else's bug report is not.

  Only a top-level view can be independently repainted, so the highlighted
  unit must be one.

  **Why per-word style rather than a moving overlay.** Two mechanisms are
  available once words are boxes. *Per-word:* each word carries a derived
  style comparing its own index against the shared value, so a tick is N
  integer comparisons on the UI thread — trivial at the sample's 176 words, a
  problem at book length ❓. *Overlay:* one absolutely-positioned animated
  view slides to the current word's rect, giving one animated node regardless
  of document length, but requiring every word measured via `onLayout` and
  re-measured on rotation and font change. **Per-word is chosen for the MVP**
  because it needs no measurement and no positioning math. The overlay is the
  scalable answer and belongs with `D-G` and `D-Q`; nothing here forecloses
  it.

  **What is given up — recorded because it is a permanent property of the
  reading surface, not a temporary MVP cut.**
  - **Text selection and copy across words.** The phone no longer sees a
    continuous run of text. Accepted deliberately: the user still has the
    source document, and this is a reading aid rather than a text editor.
  - **Screen readers announce N separate elements rather than one
    paragraph.** Fixable later with explicit accessibility grouping — not
    free.
  - **Justified text and hyphenation become impossible.** Text is permanently
    ragged-right.

  Left-aligned prose wrapping is materially unchanged, since both models
  break at word boundaries.

  **One consequence for AD19, recorded here because AD19 is append-only and
  is not edited.** AD19 deferred bionic partly on the grounds that it changes
  the **shape** of the node `D-E` must manipulate. Under word boxes it does
  not: the animated node is the box, and **static** nested `Text` inside a
  box works fine — only **animated** nested `Text` is the problem. AD19's
  return order (bionic first, then RSVP) still holds, and this makes the
  first step cheaper than AD19 assumed.

  One uncertainty carried forward from the register section this entry
  replaces. React Compiler is enabled in this repo (`app.json` →
  `experiments.reactCompiler: true` 📐). It cannot affect the per-tick path,
  because that path does not go through React at all — which is the point of
  this decision. Where it can matter is mount cost across N word components
  and whether a parent re-render cascades through them. Neither has been
  measured anywhere ❓, and the acceptance probe is where the second one
  would surface.

  **This entry is not device evidence.** The mechanism is chosen, not proven.
  The acceptance test is recorded instead of a claim: render roughly twenty
  word boxes, drive a shared index, and confirm the highlight moves with
  **zero React renders**. That probe belongs to implementing `D-E` and will
  produce its own `AF` entry when it runs. Nothing in AD21 was executed.

- **AD22 · `D-F` (the pacer clock) is settled: the web repo's
  `src/pacer/usePacer.ts` is PORTED — not rewritten, and not reimplemented
  from its behaviour spec.** It lands at Android `src/pacer/usePacer.ts`,
  **outside** `src/core/`, with exactly one difference from the web original,
  stated below. A future Reanimated `useFrameCallback` rewrite is not
  foreclosed.

  **Why porting wins, and why the register's framing was wrong.**
  `MVP-PLAN.md` and the web repo's port audit both list `usePacer.ts` among
  the unported *web-layer* files. That framing is misleading: it is not a
  web-layer file. It has three import statements and **not one of them is a
  web dependency** — `react` (line 1), `import type { Word } from
  '../model/types'` (line 2), and `dwellMultiplier` from `./dwell` (line 3),
  all read from the web file for this entry 📐 (read-only). The middle import
  is **type-only**, erased before runtime, and the type it names lives in
  `model/types.ts`, already one of the twelve seeded files here and recorded
  by AF11 as having nothing to execute. The file touches no DOM API —
  grepping it for `document.`/`window.`/`navigator.` returns a single hit
  which is prose inside a comment 📐. Its only platform dependencies are
  `requestAnimationFrame` (lines 164, 177), `cancelAnimationFrame` (122) and
  `performance.now()` (175), all of which exist in React Native ❓ — asserted
  from vendor documentation, not measured on this build; see the acceptance
  probe below. Its one runtime import is already here: `dwell.ts` is seeded
  at `src/core/pacer/dwell.ts` and covered 9/9 by
  `src/core/pacer/dwell-headless-test.mjs` inside `npm run check` 🧪.

  It also already satisfies CLAUDE.md §4's first two guards **by
  construction**, rather than by porting effort. Its own docblock states that
  the current word index is held in a ref and broadcast through a pub/sub
  rather than React state, so the document tree never re-renders on a tick
  (lines 8–12) 📐. `commit()` notifies subscribers with a plain integer —
  `IndexListener` is `(index: number) => void` at line 45 and line 118 is
  `listenersRef.current.forEach((cb) => cb(next))` 📐 — which is guard 1's
  integer-only callback seam, exactly as CLAUDE.md words it. The index lives
  in `indexRef` (line 87) 📐, which is guard 2. The only React state touched
  on the hot path is `atEnd`, and only when it flips (lines 109–117) 📐; the
  one adjacent exception is the `setPlaying(false)` at line 151, which fires
  once at end-of-document alongside that same flip, not per tick. Under AD21
  the subscriber becomes a function writing to a Reanimated shared value
  instead of one touching the DOM — that is a change to the **consumer**, not
  to this file.

  **Alternatives rejected.** (a) *Rewrite the loop as a UI-thread worklet via
  Reanimated's frame callback.* Architecturally purer, since JS-thread jank
  then cannot stall the pacer at all, and it would require flattening
  `Word[]` into plain number arrays to cross the worklet boundary. Rejected
  for the MVP on risk: it means reimplementing the at-most-one-word-per-frame
  backlog cap (lines 159–161), the chunk-size threshold scaling (lines
  133–145), and `startedRef`'s deliberate interaction with F23/D89 (lines
  94–99, whose comment reads "Deliberately NOT cleared in seek()") 📐 —
  logic whose own comments record it as the product of prior debugging, and
  which has no test coverage to catch a regression. The JS-thread concern is
  also largely self-cancelling: under AD21 the JS thread is idle during
  playback precisely because nothing re-renders ❓. (b) *Reimplement from the
  behaviour spec.* Discards working code and gains nothing the rewrite does
  not.

  **The single divergence from web, recorded so it stays auditable.** Three
  helpers in the file are pure and React-free: `firstWordlikeFrom` (line 21,
  already exported), `lastWordlikeUpTo` (line 29) and `nearestWordlike`
  (line 37) — the latter two **not** exported, confirmed by reading the web
  file 📐. The Android copy adds the `export` keyword to those two so a
  headless suite can reach them. That is additive and cannot change
  behaviour. The Android copy therefore differs from the web original by
  exactly two added `export` keywords and nothing else.

  **Test coverage, recorded because the register assumed coverage that does
  not exist.** `usePacer.ts` has **no** test coverage in the web repo —
  verified rather than inherited: `src/pacer/headless-test.mjs` there bundles
  `keyboard.ts` (its `entryPoints` at line 50) and covers the Space-key
  routing predicate, not the clock, and a sweep of every `entryPoints` across
  all twelve web suites finds none that bundles `usePacer.ts` 📐. A new
  Android-local headless suite will bundle the ported file and test the three
  helpers — in particular `nearestWordlike`'s backward fallback when no
  word-like token exists at or after the target (line 42, the
  `lastWordlikeUpTo` branch). That becomes the ninth suite in `npm run
  check`. This is queued work, not part of this change.

  **What this does NOT settle.** Where the copy lives relative to the shared
  surface is `D-D`'s question, not this one. `usePacer.ts` imports `react`,
  and `src/core/` is React-free by construction — `tsconfig.core.json`
  typechecks it in isolation with `"types": []`, and no file under
  `src/core/` imports `react` 📐 — so this cannot be a thirteenth seed file.
  (The file also names the `React` type namespace directly, at line 49's
  `React.MutableRefObject<number>` 📐, so even its types would not survive
  that isolation.) It is a **known unsynced copy** outside `src/core/`, and
  it will diverge: F23/D89 is explicitly unresolved and lives in this file's
  `startedRef` logic. `D-D` must therefore decide over the twelve seeded
  files **plus** this one.

  **Acceptance probe, recorded rather than claimed. Nothing here was
  executed.** `requestAnimationFrame` and `performance.now()` are asserted
  from vendor documentation, not measured on this build ❓ — if React
  Native's timing source or backgrounding behaviour differs materially from
  the browser's, or its resolution makes the one-word-per-frame cap
  misbehave, the port becomes a rewrite. That check belongs with AD21's
  acceptance probe, in the same session, and will produce its own `AF` entry.

- **AD23 · The MVP's feature scope is revised: bionic rendering is IN, and
  natural pauses are IN — always on, with no toggle. This supersedes AD19 in
  part.** AD19 cut bionic and scoped the MVP to a single setting, WPM, with
  natural pauses excluded by omission. **The bionic cut is superseded
  outright.** The single-control scope survives but now means something
  different: natural pauses ship as always-on *behaviour*, not as a setting.
  **AD19 is not edited** — this file is append-only, and the supersession is
  recorded here, the same way AF31 records a scope correction to AF28 in
  FINDINGS.md without touching AF28's text.

  **Why the bionic cut no longer holds.** AD19 deferred bionic on the grounds
  that it turns every word into a *composite* node and so changes the **shape**
  of the node `D-E` must manipulate — bionic sitting *underneath* `D-E` rather
  than on top of it. AD21 already recorded that this reasoning expired the
  moment `D-E` settled: under word boxes the animated node is the **box**, and
  **static** nested text inside a box works fine — only **animated** nested
  text is unsupported. The cost AD19 was avoiding does not exist under the
  mechanism that was subsequently chosen, and AD21 says so in as many words.

  What is left is small, and was verified against the file rather than taken on
  trust: `src/core/reader/bionic.ts:39` is
  `export function splitBionic(text: string, ratio: number): BionicSplit`, and
  `BionicSplit` is the three-slot `{ lead, head, tail }` at lines 22–29 📐. The
  MVP already renders one box per word (AD21); bionic renders **three text runs
  inside that box** instead of one. No new module, no new dependency, and
  nothing on the per-tick path — the split is computed at render, not per tick.

  **Why natural pauses are in.** They are close to free, and were left out of
  AD19 only because AD19 was scoping aggressively. `buildDwellMultipliers(doc)`
  is already exported from the seeded `src/core/pacer/dwell.ts:64` 📐, and the
  `usePacer` that AD22 ports already accepts both arguments — `PacerOptions`
  declares `dwell?: number[]` and `naturalPauses?: boolean` at the web
  original's lines 63–70 📐 (read from the web file for this entry, read-only;
  `src/pacer/` does not exist in this repo yet, because AD22's port is queued
  work). This is **one call at document load plus two arguments**. `dwell.ts`
  is covered 9/9 by its headless suite inside `npm run check` 🧪.

  **"Always on" is continuity with web behaviour, not a new MVP choice — but
  the seam still needs an explicit argument, and the two facts are easy to
  confuse.** The *web app* already ships natural pauses **on**: `src/App.tsx:69`
  is `const [naturalPauses, setNaturalPauses] = useState(true);` 📐. So an
  always-on MVP gives a reader the same behaviour the web app gives them today;
  what the MVP drops is the ability to turn it **off**, not the default.
  Separately, and one level down, the `usePacer` **option** defaults to `false`
  (`options.naturalPauses ?? false`, lines 83–84 📐) — the hook is off unless
  told otherwise, and on web it is `App.tsx` that tells it. That is a fact
  about the **seam**, not about the product: this repo's call site must pass
  `naturalPauses: true` explicitly rather than inherit it from the option
  default.

  **No toggle.** The web app makes natural pauses switchable — a checkbox at
  `src/ui/Settings.tsx:91` 📐 — the MVP does not. AD19's single-control scope
  otherwise stands: **WPM is the only user control.** A natural-pauses toggle
  and a bionic intensity control (`BIONIC_RATIO` at `bionic.ts:16–20` already
  defines `low`/`medium`/`high` 📐) are both post-MVP.

  **Two consequences, recorded because they are now MVP-blocking rather than
  deferred.**
  - **AF31 residue item 4 is promoted.** `\p{L}` at
    `src/core/reader/bionic.ts:31` (`const LETTER = /\p{L}/u;` 📐) has never run
    on-device. AF31 recorded it as an *adjacent* gap — explicitly on the
    reading that a device probe covering `orp.ts` "should not stop short of
    it" — and that framing assumed bionic was not shipping. It ships, so the
    gap stops being adjacent: **the AD21/AD22 acceptance probe must exercise
    bionic rendering on a real device**, not only the highlight mechanism.
    AF31's own text is not edited; the promotion lives here.
  - **`bionic.ts` has no test coverage in EITHER repo.** Swept rather than
    assumed, by resolving every `entryPoints` and every `bundleAndImport` call
    site to a literal. This repo's eight suites bundle exactly seven modules —
    `tokenize.ts`, `delimiterSpans.ts`, `orp.ts`, `dwell.ts`, `markdown.ts`,
    `pdfText.ts`, `epubStructure.ts` 🧪. The web repo's twelve bundle those
    seven plus `keyboard.ts`, `pdf.ts` and `readingPosition.ts` 🧪 (read-only).
    **None bundles `bionic.ts`** — consistent with AF11, which already lists it
    among the modules no suite bundles. One apparent hit is a false positive
    and is recorded so the sweep is not re-run: the web repo's
    `src/presets/headless-test.mjs` matches "bionic" nine times, but every
    match is the settings-bundle *field* `bionic.enabled` / `bionic.intensity`,
    and that suite imports only `node:assert/strict` and bundles no source at
    all 📐 — exactly as AD8 records. A bionic headless suite is queued
    alongside the `usePacer` suite AD22 queued.

  **Post-MVP return order,** recorded because the project owner asked for the
  removed features to be tracked rather than forgotten. AD19's order (bionic
  first, then RSVP) is superseded by bionic shipping. The revised ladder,
  cheapest first, each item naming what gates it:
  1. **File picker** — `expo-document-picker` + `expo-file-system`, **both
     uninstalled** (neither appears in `package.json` 📐); needs a native
     build, not a Metro reload ❓. See AD24, `D-H`.
  2. **RSVP mode** — gated on the on-device `orp` probe closing AF31 residue
     items 1 and 2 (`\p{M}` and `normalize('NFC')`, both in `orp.ts`).
  3. **Chunk mode.**
  4. **The remaining three themes** — all four are already seeded in
     `src/core/ui/theme.ts:9–14` (`light`, `sepia`, `dark`, `dim`) 📐; only the
     RN styling layer is missing.
  5. **Presets** — needs the web repo's `src/presets/presets.ts` ported 📐 and
     web issue #105 resolved (OPEN, `bug` — `DEFAULT_BUNDLE.bionic` duplicates
     `DEFAULT_BIONIC` by value 🧪).
  6. **A bionic intensity control and a natural-pauses toggle.**
  7. **EPUB** — gated on the `D-P` spike.
  8. **PDF** — gated on the `D-O` spike.
  9. **Virtualization** — the `D-G` revisit (AD24) plus `D-Q`.

  **This is a ladder, not a schedule. No dates.**

- **AD24 · The seven remaining MVP-blocking register items are settled as a
  batch.** Each gets its own labelled paragraph below, so a board row can point
  at this entry unambiguously. None was blocked on another; they are batched
  because each had shrunk to the point where leaving it OPEN was the more
  expensive option.

  **`D-G` · Reading surface. No virtualization for the MVP: a `ScrollView`
  with one `flexWrap` `View` per block.** AD19 selected no virtualization and
  AD21 fixed what sits inside it, so what remained on this item was never
  arguable — whether it survives a real document on a real phone is a
  **measurement, not a decision**, and no amount of reasoning here produces
  one. It is therefore settled **for the MVP**, with an explicit revisit
  trigger: **the first document that visibly stutters on scroll, or takes more
  than a moment to mount.** The range that matters, recorded so the trigger is
  not vague: the seeded sample is **176 words** (AF28, AF31), and a book
  chapter is roughly **3,000–5,000** — an estimate, not a measurement. Leaving
  this OPEN indefinitely would be worse than settling it, because OPEN implies
  someone will argue it and nobody can.

  **`D-H` · Getting a file in. No file picker.** The MVP ships the seeded
  `SAMPLE_MARKDOWN` plus a paste-your-own-text box, both reaching the same
  parser. `expo-document-picker` and `expo-file-system` are **both
  uninstalled** — neither appears in `package.json` 📐 — and installing native
  packages requires a Gradle run rather than a Metro reload ❓. AD20 already
  cut PDF and EPUB, so a picker could only open a `.md` file, which pasting
  reaches with **zero** native surface. Recorded honestly: this **bends**
  `MVP-PLAN.md` §1's "open a document" — pasting text and reading it satisfies
  the spirit, not the letter. The picker is item 1 on AD23's ladder.

  **`D-I` · Storage scope. Reading position only** — not WPM, not settings,
  not anything else. §1 names exactly one thing that must survive a restart,
  and the asymmetry is decisive: **WPM resetting costs the user one gesture;
  position resetting costs them the entire product.** The storage engine is
  already settled (MMKV, synchronous — AD6). The real work here is the
  **content fingerprint**, and web issue #102 (OPEN, `documentation` +
  `android` 🧪, read in full for this entry) asks for a **fixed-hash
  conformance test built before any RN implementation**, because the web
  implementation is currently proven only against itself and a divergent hash
  loses every saved position **silently**. Scoping `D-I` tightly is what keeps
  attention on the part with a known correctness trap, rather than spreading it
  across settings that have none.

  **`D-J` · Screens and navigation. One screen.** `expo-router` is present
  (`~57.0.17` 📐, `main` is `expo-router/entry` 📐, `typedRoutes` enabled 📐),
  and `src/app/index.tsx` currently holds the Hermes probe screen from
  AF27/AF28 📐 — it becomes the reader. With no file picker (`D-H`) there is
  nothing for a second screen to do, and the WPM control and play/pause live on
  the reader itself. A picker screen arrives when a picker does.

  **`D-L` · How the APK reaches the phone. Two answers**, because the
  development loop and the delivery artifact are different questions and the
  register conflated them.
  - *Development:* `npx expo run:android --device` over USB, with Metro serving
    JS. Fast iteration, no service dependency, and the toolchain is already in
    place (AD17).
  - *Delivery:* a locally built **release** APK, copied to the phone and
    installed manually. This is a **requirement rather than a preference** —
    the project owner wants an artifact they built, not one downloaded or
    shared, and it must run with **no laptop attached**. A *debug* APK cannot
    satisfy that: it expects Metro to serve it JS, so it would install and then
    fail on launch ❓.

  **The risk this creates, recorded plainly.** A release build means real
  precompiled Hermes bytecode. **AF26 point 3** states that nothing in this
  repo speaks to "release-mode bytecode precompilation, Metro+Babel's actual
  transform output …, Proguard/R8 interaction, or ABI-specific `libhermes.so`
  behaviour", and **AF27** states "Not claimed: anything about release builds.
  This was exclusively a debug development build" — both quoted after checking
  them against FINDINGS.md for this entry 📐. **Every piece of device evidence
  this repo holds was gathered in debug.** The MVP therefore ships on a
  configuration **nothing has verified**, and the first release build is itself
  a finding that will need its own `AF` entry.

  **Release signing requires a keystore the project owner generates
  themselves.** Noted here as a prerequisite only: no keystore was generated,
  none is written into any config, and no credential of any kind is recorded in
  this repo.

  **`D-M` · App identity. Display name only for the MVP**; the Expo template's
  adaptive-icon and splash configuration is kept. The package name is already
  correct and permanent — `com.arishh.readingaid` (AD17), confirmed in
  `app.json` 📐 — and `app.json` already carries a complete
  `android.adaptiveIcon` block (foreground, background, monochrome) plus an
  `expo-splash-screen` plugin configuration 📐; the display name is currently
  the template's `ReadingAidAndroid` 📐. Real assets are a **design** task, not
  a port task. One scheduling note: editing `app.json` requires a native build
  rather than a Metro reload ❓, so this should ride along with whatever native
  change happens first rather than being done on its own.

  **`D-N` · Headless suites on Android. No — and what replaces them is recorded
  here, because "no" on its own would read as a gap.** The eight local suites
  are Node-only **by construction**: they import `node:assert/strict`,
  `node:path`, `node:url` and use `esbuild` as a library (AF23), so running
  them on-device means **rewriting the harness**, not relocating files. The web
  repo's **PORT-AUDIT §7 item 5** — "What happens to the 12 `.mjs` headless
  suites" — is still listed there as unresolved 📐 (back-reference, read-only),
  and it predates this repo's device evidence entirely. What actually needs
  device evidence is narrower and already specified: **AD21's acceptance probe,
  AD22's acceptance probe, AD23's bionic addition to it, and the queued
  on-device `orp` port** closing AF31 residue items 1 and 2. Four targeted
  probes beat a general-purpose harness for the MVP, and each produces its own
  `AF` entry. `D-N` is therefore post-MVP, and it **interacts with `D-D`** — if
  the core files gain a sync mechanism, the suites arguably should too — so it
  is better answered **after** `D-D` than before.

  **Register state after this batch — a status statement, not rationale.**
  Nothing MVP-blocking is open. `D-D` and `D-R` remain **OPEN** and
  `D-O`/`D-P`/`D-Q` remain **SPIKE**, and none of the five blocks the MVP —
  `D-R` in particular is a cosmetic emphasis-stripping edge case (web issue
  #108), not a parse failure, and it is gated behind `D-D`, which is post-MVP.

- **AD25 · The `usePacer.ts` port is a FOUR-line diff, not two. This corrects
  AD22.** AD22 states that "The Android copy therefore differs from the web
  original by **exactly two added `export` keywords and nothing else**." That
  is **false**, and it was written without tracing the file's imports. AD22 is
  **not edited** — this file is append-only, and the correction lives here, the
  same way AF31 records a correction to AF28 without touching AF28's text.

  **The correct figure: four changed lines.** Two are the added `export`
  keywords AD22 describes, on `lastWordlikeUpTo` (line 29) and `nearestWordlike`
  (line 37). The other two are **repointed imports**: line 2
  `'../model/types'` becomes `'../core/model/types'`, and line 3 `'./dwell'`
  becomes `'../core/pacer/dwell'`.

  **Why AD22 was wrong.** It inherited AD9's relative-path property — that the
  eight ported headless suites needed no path edits — but AD9's own wording
  carries the precondition AD22 dropped: those paths "already resolve correctly
  **once the suite sits beside its subject under `src/core/`**." That holds only
  for files *inside* `src/core/`. AD22 then placed `usePacer.ts` deliberately
  **outside** it while its two imports point **into** it, so the precondition
  fails by construction. Verified rather than reasoned: only `src/app/` and
  `src/core/` existed under `src/` before this change, so `'../model/types'` and
  `'./dwell'` resolved from `src/pacer/` to nothing at all 📐.

  **The controlled contrast that proves the diagnosis is not a guess.**
  `src/storage/readingPosition.ts` was ported in the same change and is
  **byte-identical** to its web original — zero lines differ, `sha256
  3385b12b1a6d8e4a6190bbbe53fed40505d028a7ec74794125fab5776a73e5fb` on both
  sides 🧪. It imports `'./storage'`, and both it and its dependency sit in
  `src/storage/`, so AD9's property holds and no edit was needed. Same port,
  same session, opposite outcome — the variable is whether a file's relative
  imports stay inside its own directory, exactly as diagnosed.

  **How byte-equality of the remaining 227 lines was established**, rather than
  asserted: the four edits were **programmatically reversed** and the result
  hash-compared against the web original. Both sides `sha256
  c9f3938973e7c3b85a1eb27b6c1995b8a3337e64bbdda9de8c606e7882fd3a93`, 231 lines
  each 🧪. So the port differs from web on lines 2, 3, 29 and 37, and is
  byte-identical everywhere else.

  **Alternative rejected: re-export shims** at `src/model/types.ts` and
  `src/pacer/dwell.ts`, which would have preserved AD22's literal
  byte-identity claim. Rejected because it creates a **second drift surface** —
  two modules that look like the real ones, shadowing `src/core/`, kept correct
  by nothing. This repo has documented value-duplication drift three times
  already (AD2's `settings-defaults.ts` false positive, AF8's manual `exclude`
  copy, AD18's anti-duplication rule), and a four-line auditable diff is
  strictly cheaper than two files that must not be mistaken for their
  originals.

  **The port needs no clock patch — AD22's acceptance probe has now run.**
  AD22 recorded `requestAnimationFrame` and `performance.now()` as asserted
  from vendor documentation and measured nowhere, and warned that if the timing
  source differed materially "the port becomes a rewrite." **AF34** settles it
  as a negative result: the first-frame seeding assumption — `lastRef` seeded
  from `performance.now()` at web line 175, then differenced against rAF's
  `now` argument at line 130 — was measured on physical hardware at **-0.12 ms
  and -0.13 ms** across two runs. The two clocks share a time base, so the
  rewrite risk did not materialise and the four-line port stands as ported.

  **What this does not change.** AD22's `D-D` scoping stands and is widened by
  AD26: `D-D` must decide over the twelve seeded files, this file, **and**
  `src/reader/palette.ts`.

- **AD26 · The reader's colours and layout live in `src/reader/palette.ts`,
  hand-copied from the web repo's `src/index.css` with NO sync mechanism. It is
  a `D-D` surface.**

  **Why the file exists at all.** `src/core/ui/theme.ts` contains **no colour
  values** — it is the `Theme` union, a four-entry label list and
  `DEFAULT_THEME` (16 lines, read for this entry 📐). The actual colours are CSS
  custom properties in the **web** repo's `src/index.css`, which React Native
  cannot read. So the `light` theme (AD19's only theme) had to be transcribed.

  **What was transcribed**, each value verified by reading the web file
  directly 📐: the seven `light` tokens at `index.css:12-18` — `--bg #faf9f7`,
  `--surface #ffffff`, `--text #1c1b19`, `--muted #6b6a67`, `--border #e6e3de`,
  `--accent #3b6ea5`, `--anchor #c0392b` — plus the highlight treatment from
  `.pacer-overlay` (`index.css:634-644`): `border-radius: 4px` at line 640 and
  `color-mix(in srgb, var(--accent) 32%, transparent)` at line 641. The
  highlight is **derived** from `LIGHT.accent` at runtime rather than stored as
  a second literal, so it cannot drift away from the accent it is a tint of.
  Body type is `index.css:629`'s `1.125rem`; block margins are
  `.reader-heading` / `.reader-paragraph` (`650-657`); reading width is
  `--reading-width: 42rem` (line 54). `rem` is the UA default 16px — no
  `font-size` is set on `html`, `:root` or `body` anywhere in the file
  (checked 📐).

  **The warning, stated plainly because it is the point of this entry.** Every
  value in this file is a **hand-copied duplication across the repo boundary
  with no sync mechanism**. If the web theme is retuned, nothing updates this
  file and nothing warns anyone; the two will diverge silently. This is a
  **`D-D` surface**, and `D-D` now decides over **three** things, not one: the
  twelve seeded `src/core/` files, the ported `src/pacer/usePacer.ts` (AD22,
  AD25), and this. It differs from the other two in kind, which is worth
  recording for whoever answers `D-D`: the seeded files are held byte-identical
  *on purpose* (AD1, AF7), whereas this file is **expected to change** under
  visual tuning (AF36) and so can never be kept byte-identical to anything.

  **Two deliberate divergences from web.**

  **(1) `bodyFontSize` is 19, not web's 18.** `index.css:629` is `1.125rem` =
  18px. The stage 1 acceptance probe measured question (d) at **19**, and AF36
  records that ruling as still pending. Matching the probe means the pending
  ruling transfers to the reader surface **without a translation step** —
  judging a 19px instrument and then shipping 18px would invalidate the
  judgement. A one-value edit to revert.

  **(2) Heading base weight is 400 with the bionic head at 700, so headings are
  distinguished by SIZE ALONE.** Web emits real `<h1>`..`<h6>`
  (`Reader.tsx:95-97`, level clamped 1-6) and **sets no heading `font-weight`
  anywhere** — verified exhaustively: the only `font-weight` declarations in
  `index.css` are at lines 244, 445, 490, 601 and 855, and none is a heading
  rule 📐. Headings therefore inherit the UA's **bold 700**. But `.bionic-head`
  is **also 700** (`index.css:243-244` 📐), so head and tail render at the same
  weight and **the bionic anchor is invisible inside every web heading**.
  Reproducing that faithfully would discard the reading aid's one signal on
  precisely the lines a reader scans hardest, so it was not reproduced.

  The web behaviour is **arguably a defect**, but it is **web-layer rather than
  shared surface** — it lives in `index.css` and `Reader.tsx`, neither of which
  is seeded here — so it carries **no cross-repo obligation** and is **not
  being filed**. Recorded here only so a future reader does not "fix" the
  Android divergence back into web's behaviour thinking it was an oversight.

  **Heading sizes have no web source, and they derive from web's 18px base —
  NOT from this file's 19px body.** Web sets no heading font-size at all, and
  React Native has no UA defaults to inherit, so the browser UA scale was
  applied explicitly: h1 2em, h2 1.5em, h3 1.17em, h4 1em, h5 0.83em, h6
  0.67em. Against **18** that yields exactly the shipped values —
  36 / 27 / 21 / 18 / 15 / 12 — and the arithmetic was re-checked against
  `palette.ts` for this entry: all six match a base of 18, and **none** matches
  a base of 19 (which would give 38 / 28 / 22 / 19 / 16 / 13) 🧪. Also with no
  web source: `scrollTopInset` (140), which parks the active line below the
  viewport top on a line change — fixed rather than derived from viewport
  height, so the auto-scroll path needs no measurement beyond the per-word Y it
  already collects.

  **KNOWN DEFECT that ships in this change, recorded rather than quietly
  fixed.** Because the heading scale is based on 18 while the body is 19, the
  lower heading levels are **smaller than body text**: h4 is 18 against a
  19 body, h5 is 15, h6 is 12. Combined with divergence (2)'s heading base
  weight of 400 — the same weight as body text — an **h4 heading has neither a
  size advantage nor a weight advantage and is indistinguishable from a
  paragraph**; h5 and h6 are actively smaller. Markdown `####` produces exactly
  this. The seeded sample only uses `#` and `##`, so nothing in the MVP's
  default document exhibits it, but any pasted document with deeper headings
  will. The fix is **deferred to a follow-up change** and deliberately not made
  here, so that this entry describes what actually ships rather than what was
  intended; it should be settled together with AF36's pending (d) tuning
  ruling, since both concern the same table of values. Two shapes the fix could
  take, neither chosen here: rebase the scale on the live `bodyFontSize`, or
  give headings a weight advantage independent of size.

  **Alternative rejected: hard-coding colours at each use site.** Rejected for
  the obvious reason, and the codebase now enforces the choice — zero colour
  literals appear in code anywhere under `src/` outside this file 🧪.

- **AD27 · The content fingerprint could NOT be ported and was built fresh as a
  pure function over bytes, exactly as web issue #102 prescribes.**

  **Why a port was impossible.** `computeFingerprint` is not in the web repo's
  storage layer at all — it is `src/parsers/index.ts:30`, it takes a Web
  **`File`**, and it digests via **`crypto.subtle.digest`** (line 53) 📐. Three
  independent blockers: React Native ships **neither `crypto.subtle` nor
  `TextEncoder`** (verified by grepping `node_modules/react-native/Libraries/`
  📐); AD24 `D-H` cut the file picker, so **there is no `File`** — MVP content
  arrives as a string, from the seeded sample or the paste box; and
  `readingPosition.ts` never computes a fingerprint, it takes one as a
  parameter, so the byte-identical port of that file (AD25) neither needed nor
  supplied one.

  **The web docblock's own suggested route was considered and rejected.**
  `parsers/index.ts:25` says: "on React Native, swap `File.slice` -> RNFS/Blob
  reads and `crypto.subtle` -> **react-native-quick-crypto**; the logic and
  schema are unchanged" 📐. Rejected on two grounds, either sufficient: **no new
  packages** in this change, and — more fundamentally — with no file picker
  there is **no `File` to read bytes from**, so the RNFS half of that advice has
  nothing to operate on. The suggestion is sound for a future release that
  ships a picker; it is inapplicable to the MVP.

  **What was built instead.** `src/storage/fingerprint.ts`, following issue
  #102's own "Proposed approach" — "pin the fingerprint algorithm as an
  explicit, testable specification independent of the Web File API — a pure
  function over bytes", then a fixed-hash conformance test, and only then a
  platform implementation. The **algorithm is byte-for-byte the web one**: full
  SHA-256 at or below 96 KB; above it, SHA-256 of `[first 32 KB | middle 32 KB
  | last 32 KB | size as 8-byte big-endian]`. Only the two platform-coupled
  halves are reimplemented — a self-contained **UTF-8 encoder** replacing
  `TextEncoder`, and a **pure-JS SHA-256** replacing `crypto.subtle`.

  **`BigInt` was deliberately avoided.** The web code writes the size suffix
  with `DataView.setBigUint64`; this computes the two 32-bit halves
  arithmetically instead, which is exact for any size up to 2^53. That removes
  one more engine feature from a code path that has **no device evidence at
  all** — nothing in `src/storage/` has run on hardware, and AF26's residue
  already records what the desktop Hermes CLI does and does not establish.

  **Validation, recorded because it is what satisfies #102's actual demand** —
  that an implementation be checkable "against the same fixtures rather than
  against itself" 🧪:
  - **Canonical published NIST SHA-256 vectors**, including the **56-byte
    multi-block** case that crosses the one-block padding boundary where a
    length-encoding error surfaces.
  - **Agreement with Node's `crypto`** across **17 input lengths** covering
    every padding boundary (0, 1, 55/56/57, 63/64/65, 119/120/121,
    127/128/129, 1000, 4096, 100000).
  - **`utf8Encode` byte-identical to Node's real `TextEncoder`** across **20
    strings**, including **lone surrogates** (which WHATWG requires to become
    U+FFFD — encoding them raw instead would silently disagree with every other
    encoder).
  - **`fingerprintBytes` matching the real, unmodified web
    `computeFingerprint`** on **all 13 cases**, including **exactly at the
    threshold: 98303 / 98304 / 98305**, where 98304 takes the full path and
    98305 the sampled one. The web function was run under Node v26, which has a
    global `File` and `crypto.subtle`, so it executed **as-is with no mirror** —
    the strongest available oracle.

  **The cross-platform divergence is DECODE-PATH, not re-encoding.** This was
  measured, not assumed, and the distinction matters because it relocates the
  hazard. Web hashes **raw file bytes**; this hashes a **string re-encoded to
  UTF-8**. Re-encoding is faithful — for a BOM-prefixed string and a CRLF
  string the two produce **identical** hashes 🧪 — so re-encoding alone can
  never diverge. The real hazard is one step earlier: the fingerprint **is**
  sensitive to a UTF-8 BOM and to CRLF vs LF (both confirmed to change the hash
  🧪), so divergence occurs **if and only if** the two platforms' decode paths
  disagree about what the string is — one stripping a BOM or normalizing line
  endings where the other does not. Then the same book keys differently and
  **every saved position is silently lost**, which is precisely the failure
  #102 was filed to prevent. Both sensitivities are pinned by fixed vectors in
  the suite so the divergence is caught by `npm run check` rather than by a
  user.

  **The sampled-path vector is recorded as literal code, not prose**, so it is
  reproducible without access to the web repo: `bytes[i] = i % 251` for `i` in
  `0..199999`, length exactly `200000`, giving
  `ab4a551e0dea3dd7a6351dffde4a1e0785a969e18f3b14b9a613db09d6220b46`. 251 is
  prime and coprime with the 32 KB region size, so the three sampled regions
  differ from one another instead of repeating on a power-of-two cycle. A
  conformance vector nobody else can derive is not conformance.

  **One adjacent decision, recorded here rather than left implicit.**
  `resolveResumeTarget` (web issues #48 and #76) is the body of web's
  `handleResume` (`App.tsx:250-280`), a React component function closing over
  component state, so nothing there is importable — which is why the web
  headless suite **mirrors** it. The Android copy was extracted to
  `src/storage/resumeTarget.ts` as a pure function, and this repo's suite was
  changed to import the **real** module. A mirror of shipped *Android* code
  would have tested nothing about shipped code: the AD2 / AF8 duplication trap.
  Only `resolveResumeTargetOldBuggy` remains mirrored, deliberately, since that
  logic exists nowhere in either codebase any more and is kept solely to
  demonstrate that it gets the #76 case wrong.

- **AD28 · Click-to-jump ships: tapping a word seeks the pacer to it. A tap
  SEEKS ONLY and never changes transport state, and end-of-document behaviour
  is left to fall out of `usePacer` unchanged.** This is a scope ADDITION
  beyond AD19 and AD23, requested by the project owner after testing the
  merged MVP, so it is recorded rather than folded into either. AD19's
  single-control scope is not disturbed: WPM remains the only *setting*, and
  this is a gesture on the reading surface, not a control.

  **Web's mechanism does not port, and the reason is structural rather than
  stylistic.** `Reader.tsx`'s docblock at line 27 states the approach outright
  — click-to-seek "uses one delegated handler on the pane (data-word-id), not
  a closure per word" — and line 149 resolves the target with
  `(e.target as HTMLElement).closest('[data-word-id]')` 📐 (read from the web
  file for this entry, read-only). React Native has **neither event delegation
  nor `closest()`**: a touch is delivered to the responder that claims it, and
  there is no ancestor query to walk back up from a hit. So web's approach is
  **unavailable**, not merely different, and the per-word cost web deliberately
  avoided cannot be avoided the same way here.

  **Mechanism chosen: (a), a per-word touch responder — specifically `onPress`
  on the `Animated.Text` that already exists.** `onPress` is a **prop** of
  `Text`, so this adds **zero new native nodes**: the animated box AD21 already
  renders per word *is* the touch target. That is what makes the per-word cost
  affordable on the unvirtualized surface AD24 `D-G` settled — the cost is one
  Pressability instance per word, not one extra view per word.

  **Mechanism (b) — ONE responder on the container, hit-testing a per-word rect
  map — is rejected for the MVP and recorded as the scalable alternative.** It
  gives one responder regardless of document length, which is the property web
  was buying with delegation. It needs **x and width**, and the auto-scroll work
  deliberately collects **Y only** (AF38) — so mechanism (b) has no existing
  data to reuse and would have to add measurement the surface currently avoids.
  That is the **same per-word-cost-versus-measurement trade as AD21's rejected
  measured-rect highlight overlay, appearing in a second place**, and it belongs
  in the same revisit: `D-G` and `D-Q`. Whichever way that trade is settled, it
  should be settled once, for the overlay and the hit-test together, since both
  want the same rect map.

  **Two further mechanisms rejected, both for the same reason.** Wrapping each
  word in a `Pressable`, or in a `GestureDetector` (`react-native-gesture-
  handler` **is** installed at `~2.32.0` 📐, so this was a real option and not
  an availability constraint), each interposes a `View` per word. That doubles
  the node count of a surface that is deliberately unvirtualized, for a
  capability `Text.onPress` already provides.

  **Wiring: three files, entirely additive.** `WordBox` and `ReaderSurface` each
  gain an optional `onSeekWord?: (index: number) => void`, supplied only when
  present — exactly the shape the existing `onMeasureY` uses, and the same shape
  web gets from `clickable={!!onSeekWord}` (`Reader.tsx:191` 📐). The reader
  screen passes `pacer.seek` directly. **`src/pacer/` needed no change at all:**
  `seek` already exists and already snaps through `nearestWordlike`
  (`usePacer.ts:212-220`, `:37-43` 📐), so tapping a punctuation-only token
  lands on the next word-like one with no special case — the same behaviour web
  gets, since web marks every span clickable and lets `seek` snap.

  **A tap does not re-render the document tree, and the one exception is
  PRE-EXISTING rather than introduced.** A tap writes through the identical seam
  a pacer tick uses: `seek` → `commit` → `indexRef` plus the integer listener
  callback, and the listener in the reader screen writes a Reanimated shared
  value. CLAUDE.md guard 1's integer-only seam is untouched, and guard 2 holds
  because nothing is put into React state. The exception is stated rather than
  glossed: `commit` calls `setAtEnd` when `atEnd` flips, and *only* then —
  `usePacer.ts:114-117` guards it with `ended !== atEndRef.current` 📐 — so a
  tap onto, or off, the last word-like token causes **one** React render. That
  is the single state exception the tick path already carries, on a human
  gesture, exactly like Play/Pause. **"Zero renders" would be a false claim and
  is not made.**

  **A drag that begins on a word must scroll, not seek — and it does, by
  construction.** `Text` forwards `onResponderTerminationRequest` to
  Pressability (`Text.js:449-452`), whose default returns `cancelable ?? true`
  (`Pressability.js:526-529`) 📐 — both read out of this repo's own
  `node_modules/react-native/`, not from vendor prose. So the enclosing
  `ScrollView` can take the responder mid-touch and the press is cancelled.
  **This is a STRUCTURAL claim, not a device observation.** The on-device drag
  test is this entry's **pending acceptance check** and will produce its own
  `AF` entry when the project owner runs it; nothing here was run on hardware
  or an emulator by me.

  **Auto-scroll interaction — and confirmation that AF38's `lastScrolledY`
  design still holds.** It does, and a seek is the case that *validates* it
  rather than merely surviving it. The reaction compares the target word's
  absolute Y against the Y last scrolled for, so: tap an **off-screen** word and
  the line is parked at `scrollTopInset`; tap a word on the **line already
  anchored** and nothing scrolls, which is right, because repositioning a line
  the reader is looking at is worse than leaving it. The rejected alternative —
  comparing against the **previous index's** Y — breaks precisely here: after a
  seek the previous index can be anywhere, possibly off-screen, so "did the line
  change relative to the previous word" is the wrong question. `lastScrolledY`
  asks the right one: *is the viewport already anchored on this line?* One
  residual is recorded rather than fixed, in AF38: manually scroll the anchored
  line off-screen, then tap a word on that same line, and no scroll fires until
  the next line change. Fixing it means letting something other than
  `currentIndex` drive scrolling, which is what CLAUDE.md guard 3 exists to
  prevent.

  **Ruling — end of document.** Nothing is special-cased, and `startedRef` is
  **not** touched. `usePacer.ts:94-99`'s comment records that it is
  "Deliberately NOT cleared in seek(): seeking to the document's last word must
  keep disabling Play (F23/D89)" 📐, and that is honoured. Two consequences,
  both falling out of the ported clock with no new code:
  - Tapping the **last** word-like token leaves `atEnd` true and `startedRef`
    set, so `play()`'s `atEndRef.current && startedRef.current` guard
    (`usePacer.ts:190`) still refuses and the transport still reads **Restart**.
    Correct: a tap means "put the highlight here", and there is nothing to
    advance to. Restart stays the deliberate whole-document gesture.
  - Tapping **backwards** from the end makes `commit` recompute
    `ended === false`, flipping `atEnd` false, so the transport returns to
    **Play** and playback is available again with no Restart needed.

  **Ruling — a tap while paused SEEKS ONLY; it does not play.** Only this is
  implemented; the alternative is not shipped behind a setting. Four reasons,
  in order of weight. (1) It is what web does: `App.tsx:410` and `:434` are
  both `onSeekWord={pacer.seek}` 📐 — seek with no play — so the port gains no
  new divergence. (2) Positioning the highlight *before* starting stays
  possible; auto-play would remove the ability to simply move it. (3) A touch
  surface produces more accidental activations than a mouse, and a stray tap
  that starts playback is worse than one that moves a highlight. (4) It makes
  the rule uniform in both directions: while **playing**, `seek` zeroes the
  accumulator (`usePacer.ts:216`) and the rAF loop continues from the new word,
  so a tap changes position and never transport state, whatever the state was.

  **Known limitation, recorded rather than fixed.** A body-text word box is
  about 32 dp tall (`bodyLineHeight` 30 plus `wordPadV` 1 either side), below
  Android's 48 dp touch-target guidance. `hitSlop` is not applied: adjacent word
  boxes are separated by `wordGapH` 5, so any meaningful slop would overlap its
  neighbours and make which word was tapped ambiguous — worse than a small
  target. Inline text targets cannot reach 48 dp without either overlap or
  spacing the surface would not survive, and the surface's spacing is what AF39
  just ruled on.

- **AD29 · AD26's shipped heading defect is FIXED, and AF36's pending layout
  ruling is resolved as SHIP AS IS. The heading scale is the only layout value
  that changes.** AD26 recorded the defect knowingly — its own text says the
  fix is "deferred to a follow-up change and deliberately not made here, so
  that this entry describes what actually ships rather than what was intended"
  — and named two candidate shapes without choosing. This chooses.

  **The defect, restated exactly.** Heading sizes shipped as
  36 / 27 / 21 / 18 / 15 / 12: the browser UA scale (h1 2em … h6 0.67em)
  multiplied by **web's 18px base**, while `bodyFontSize` here is **19**
  (AD26's own deliberate +1). Nothing connected the table to the base, so h4
  rendered at **18 — smaller than body text** — with h5 (15) and h6 (12)
  smaller still; and at `headingWeight` 400 they carried no weight advantage
  either, so an h4 was indistinguishable from a paragraph.

  **AD26's candidate (ii) — give headings a weight advantage — is REJECTED, and
  not on taste.** `headingWeight` must stay strictly below `bionicHeadWeight`
  700 or the bionic anchor disappears inside headings, which is AD26's entire
  reason for choosing 400 against web's inherited bold. That leaves 500 or 600.
  Android's Roboto ships Regular 400, Medium 500 and Bold 700, so a 600 request
  resolves to an adjacent available face and can land **on 700 itself**,
  silently collapsing head and tail to the same weight — reproducing the exact
  web behaviour AD26 diverged from. Weight is not a usable channel here, so
  candidate **(i), rebase on the live `bodyFontSize`**, is taken.

  **But rebasing alone is insufficient, and this is the part AD26 did not
  see: the UA RATIOS are the defect, not merely the base they multiply.**
  1em / 0.83em / 0.67em for h4/h5/h6 only ever work because a browser pairs
  them with **bold 700** — size parity is fine when weight carries the signal.
  AD26 removed the weight signal for good reason and kept sizes that depended
  on it. So the ratio scale is replaced with one **floored above 1.0**, not
  merely re-multiplied.

  **The values.** `HEADING_SIZE_RATIO` is `1.9 / 1.4 / 1.27 / 1.21 / 1.16 /
  1.1`, applied to the live body size, giving at 19:

  | level | new | old |
  |---|---|---|
  | h1 | **36** | 36 (unchanged) |
  | h2 | **27** | 27 (unchanged) |
  | h3 | **24** | 21 |
  | h4 | **23** | 18 — *was below body* |
  | h5 | **22** | 15 — *was below body* |
  | h6 | **21** | 12 — *was below body* |

  1.9 and 1.4 are chosen to **reproduce** the two levels that were actually
  judged on-device rather than being invented: the seeded sample contains
  exactly one `#` and one `##` and no deeper heading (`sample.ts:2` and `:8`,
  checked for this entry 📐), so **h1 36 and h2 27 are precisely the values
  that were on screen**, and they are preserved byte-for-byte. **h3 moving
  21 → 24 is required by the fix**, not a retune: three levels cannot sit
  distinguishably between 21 and a body of 19, so the window has to open — and
  h3 was never rendered on device, so nothing that was ruled on is disturbed.
  `headingWeight` 400, `bionicHeadWeight` 700, `headingLineHeightRatio` 1.3 and
  every other `LAYOUT` value are **untouched**. Values live in `LAYOUT` and
  nowhere else: one `BODY_FONT_SIZE` constant feeds both `bodyFontSize` and the
  derivation.

  **The derivation ENFORCES both invariants rather than inheriting them from
  the arithmetic, and that changed during implementation on a measurement.**
  Rounding each ratio independently was the first design and it is wrong: two
  ratios 0.05 apart collide once `0.05 x base` rounds below 1, so at a body of
  **16** the 1.21 and 1.16 levels **both round to 19** and h4 === h5 🧪
  (measured by sweeping the candidate function, not reasoned about). That is the
  same class of silent, base-dependent breakage AD26 recorded, so it is designed
  out: `headingFontSizes` builds **from the bottom up** — h6 is floored at
  `bodyFontSize + 1`, and each level above clears the one below by at least a
  pixel. Both invariants then hold **unconditionally at every body size**,
  verified across bases 8-60 by the new suite and 1-200 during development 🧪.
  At the shipped 19 the enforcement is inert: every level takes its ratio value
  unchanged.

  **RESIDUAL, stated plainly so this fix is not later read as claiming more
  than it delivers.** h4/h5/h6 land at **23 / 22 / 21 — one pixel apart** — so
  they are only **nominally** distinguished **from each other**. What is fixed
  is *"deep headings read as diminished, or vanish into body text"*. What is
  **not** claimed is *"all six heading levels are visually distinct."* The scale
  is deliberately not redesigned to buy that: the window between h2 at 27 and
  the floor at 21 does not admit four well-separated levels, and preserving the
  judged h1/h2 values matters more than separating levels a reader will rarely
  meet. Two channels do still separate a deep heading from a paragraph, and one
  of them AD26 did not credit: heading blocks carry `marginTop` 28.8 with
  `marginBottom` 9.6 against a paragraph's 17.6 bottom margin 📐, so every
  heading is preceded by a large gap and bound tightly to the text beneath it.
  Spacing was never the broken part; *size going the wrong way* was.

  **AF36's ruling is resolved here: SHIP AS IS.** AF36 recorded probe question
  (d) — word-box layout acceptability — as deferred with no ruling, because the
  instrument was 22 words on an empty screen and the artifact is a full
  document. The project owner has now tested the real reader on a physical
  device and an emulator and judged word gaps, line spacing, highlight strength
  and body size acceptable for the MVP. So `bodyFontSize` stays **19**, gaps,
  padding, line height, highlight opacity and radius, block margins and
  `scrollTopInset` all stay as they are, and **nothing is retuned** — the
  heading scale above is the only change. The ruling itself, being
  owner-witnessed device evidence rather than a choice, is recorded as
  **FINDINGS AF39**; this entry records only what changes as a result. Those
  judged values are now pinned by a check, so a future retune has to be
  deliberate rather than accidental.

  **A thirteenth headless suite ships with this change**
  (`src/reader/palette-headless-test.mjs`, 27 checks), bundling the real
  `palette.ts` — which imports nothing, so it needs no React Native, Reanimated
  or DOM stub. It was added **in this change rather than deferred** at the
  project owner's direction, on the grounds that the defect being fixed is a
  silent regression of a recurring class. It asserts both invariants at the
  shipped base and across 53 swept bases; that the shipped table **is** the
  derivation of the shipped body size rather than a literal; that the
  historical UA-on-18 table **fails** the check, so the suite demonstrably
  catches the thing it was written for; that a **pinned** snapshot of today's
  table fails once the body size is raised beneath it — the exact historical
  failure, re-enacted rather than described; that independent rounding really
  does collide at a body of 16 while the shipped derivation does not; and that
  `headingWeight` stays below `bionicHeadWeight`, so a future "give headings a
  weight advantage" edit cannot silently undo the bionic-anchor divergence.
  It was validated against a negative control before being trusted, following
  AF21's precedent: the defect table was temporarily reintroduced into
  `palette.ts`, the suite failed **5 of 27** checks and exited **1**, and
  `palette.ts` was then restored and confirmed byte-identical by `diff` 🧪.
  The **core 8 suites and their 125 checks are untouched** — the new suite is
  registered in `test:local` only.

- **AD31 · `D-D` is settled: Android FORKS `src/core/`. The twelve seeded
  files, the eight seeded headless suites, `src/pacer/usePacer.ts`,
  `src/reader/palette.ts`, `src/storage/storage.ts`,
  `src/storage/readingPosition.ts` and `src/storage/headless-test.mjs` become
  Android-owned. There is no cross-repo obligation, no back-propagation, and no
  freeze exception is needed to edit any of them. The web repo remains
  authoritative for its own tree and is irrelevant as a sync source for this
  one.**

  **The scope of the decision, stated precisely so a future reader is not
  guessing.** Three statements, and they are not the same statement:
  1. What was seeded byte-identical (AF7, AF9) **stays** byte-identical **at
     the baseline recorded in [CORE-DIVERGENCE.md](CORE-DIVERGENCE.md)** — but
     that baseline is now a **starting point for Android edits, not a
     constraint against them**.
  2. **Byte-identity to WEB is no longer maintained or checked for anything.**
     No web hash appears in the manifest and nothing consults the web repo
     again.
  3. **Byte-identity to the RECORDED BASELINE is checked by CI**, and every
     deviation must appear in the manifest **in the same PR that causes it**.
     That is the mechanism that makes this a fork rather than drift.

  **The load-bearing fact: three of the web repo's PORT-PLAN.md §5.2 options
  assume a live web repo, and the fourth assumes something to reconcile
  against.** Each was read in the web file for this entry (read-only) rather
  than recalled, and the argument is recorded here rather than restated from
  there.
  - **(a) A shared package.** Its stated *for* is "one source of truth; drift
    becomes structurally impossible; **a fix propagates by bumping a
    dependency**." Every clause presupposes two live consumers. With web frozen
    there is one consumer, and a package with one consumer is a publish step
    bolted onto a single repo. Its own *against* also stands undiminished: "the
    heaviest option", it "adds a publish/release step to every core change,
    including one-line ones", and Metro's resolution of a linked/workspace
    package "needs confirming ❓".
  - **(b) A git submodule.** Its *for* is "one source of truth with an
    explicit, recorded pin". A pin at a repo nobody commits to is a pin at a
    constant. Its *against* is decisive independently: §5.2 records that
    submodules re-adopt "a **git-state-confusion class problem**, the same
    category §2.3 deliberately designed out of the repo layout."
  - **(c) A sync script with a conformance check.** This is the closest of the
    four and must be handled carefully, because **AD31 adopts (c)'s MECHANISM
    while rejecting (c)'s PURPOSE, and a careless reading would say we rejected
    (c) and then built it.** (c) is defined as "a script **copies the seed set
    in one direction**" and a check that "fails when **the two copies** differ"
    — a two-repo comparator. That is what is rejected: there is no second copy
    worth comparing to. What is kept is (c)'s *tooling* — "comparing hashes of
    the seed files", via what §5.2 itself calls "a small script plus a
    manifest" — **repointed from the web repo to a recorded baseline**. The
    difference is the oracle, and it is the whole difference. It also disposes
    of (c)'s sharpest self-criticism: "a byte-comparison is too strict the
    moment the port legitimately needs a platform-conditional line." Under a
    fork, divergence is **expected and recorded** rather than prevented, so
    strictness costs nothing — a mismatch is not a failure, it is a **prompt to
    write the row**.
  - **(d) Accept the drift deliberately, with a documented reconciliation
    cadence.** Defensible only if there is something to reconcile against.
    There is not. §5.2's own *against* is the epitaph: its success "depends
    entirely on someone remembering", and "if chosen, the cadence and the
    record-keeping need to be as concrete as the alternatives' tooling, **or it
    degrades into (e) below by default**."

  Forking is what remains once the freeze is accepted as **long-lived rather
  than temporary**.

  **THE PREMISE OF THAT ACCEPTANCE WAS CHECKED AND FOUND FALSE, AND THE
  ARGUMENT WAS RE-DERIVED RATHER THAN INHERITED.** This decision was scoped on
  the stated premise that the web freeze "has been on the table for months".
  It has not: web HEAD is `15b6ca34e050f28eb1aacacaeaeabc8ef7584e28`, dated
  **2026-08-31**, and today is **2026-09-03** — **three days**. The premise was
  an assertion nobody had measured, it was measured for this entry, and the
  case for forking is built below on the measured facts alone. AF37's lesson is
  that a decision log asserting an event that did not happen is the one failure
  mode nothing in this repo can catch; this is that lesson applied
  **prospectively** rather than after the fact, and it is recorded because a
  premise silently corrected leaves a future reader unable to tell a checked
  claim from an inherited one.

  **The measured basis, and what remains a judgement.** Web HEAD is the tip of
  `main` with a clean tree 🧪. Since that commit, **two bugs have been filed
  against seeded core files and neither has been fixed** — #108 (2026-08-31)
  and #110 (2026-09-02, filed *after* the last web commit) — and the web
  backlog has grown from 17 open (MVP-PLAN.md §8, 2026-09-01) to **19** 🧪. A
  repo that receives reports but not commits is the condition being planned
  around. **Treating that condition as long-lived is a planning judgement, not
  a measurement**, and three days is not evidence of permanence. What makes the
  judgement affordable is stated below: forking does not foreclose
  reconciliation.

  **Why this is NOT §5.2's option (e), "do nothing and let them drift" — stated
  explicitly, because it is exactly the objection a careful reader will raise.**
  §5.2 names (e) as "the unstated default … strictly worse than (d), which at
  least writes the intention down." Superficially a fork and a drift look
  identical: two repos, no sync, edits landing on one side only. They are
  distinguished by four properties, and (e) has none of them:
  1. **A baseline.** A commit-pinned hash per file, recorded once.
  2. **A manifest.** [CORE-DIVERGENCE.md](CORE-DIVERGENCE.md), twenty-five rows.
  3. **CI.** `scripts/check-core-baseline.mjs`, inside `npm run check`.
  4. **Answerability.** Six months from now, *which* files diverged, *how*, and
     *why* is answerable from a clone with no network — the `Diverged?` column
     says which, the two hashes say that it did, and the `Record` column points
     at the `AD`/`AF` entry that says why.

  Under (e) all four questions are unanswerable and the drift is invisible
  until somebody diffs by hand. **The distinction is not intent, it is
  apparatus** — which is precisely the lesson §5.1 draws from F-PRESETS-5 and
  web issue #105, both cited there as documented intentions with no automated
  guard.

  **What was considered and REJECTED alongside forking**, recorded so this is
  not read as an unopposed choice. The first is not a §5.2 option; the second
  and third are §5.2's (b) and (a) re-examined under the freeze, and their
  arguments are not repeated here.
  - **Maintain byte-identity to web, on the theory that the freeze may lift.**
    Rejected. AD18's carve-out has been available since 2026-09-01 and no `D-D`
    resolution has come from the web side; #108 and #110 are both still open
    there. **Forking does not foreclose reconciliation — it stops paying for it
    in advance**, and the baseline is precisely the artifact a future
    reconciliation would need. If the freeze lifts, this decision is
    revisitable, and the manifest makes that revisit cheap rather than
    archaeological.
  - **A git submodule for `src/core/`.** Preserves web as a live source but
    requires the web repo to **accept Android's fixes upstream**, which the
    freeze precludes; and it makes routine edits require submodule dances.
    §5.2 (b)'s git-state-confusion objection applies on top.
  - **A shared package on npm.** Same upstream-acceptance problem, plus a
    packaging surface **neither repo has today**.

  **`D-R` and web #110 become ordinary Android bugs, and `D-R` is settled by
  this entry.** AD18 sequenced `D-R` *after* `D-D` deliberately, so the fix
  would be the first real exercise of whatever sync mechanism `D-D` chose. The
  mechanism chosen is "no sync", so **the cross-repo fix sequence is retired**:
  no freeze exception, no fix-there-then-recopy, no post-copy byte-identity
  check. #108 (`**hi **` in `markdown.ts`) and #110 (an NFD combining mark
  orphaned by `splitBionic` in `bionic.ts`) are fixed **here, on Android's
  schedule**, and the corresponding web issues are left to whoever unfreezes
  that repo. Both issues state the cross-repo obligation in their own text —
  #110's Context section says a change there "requires a matching copy across
  plus a re-run of the ported suite there" 🧪 — and **that obligation is what
  this entry cancels, on the Android side only.** Neither web issue is edited
  or closed from here.

  **One concrete consequence, recorded now so it is not rediscovered as a
  surprise.** #110 notes that the current (buggy) behaviour is **pinned by a
  test in this repo's bionic suite**, with a note saying it records what the
  code does rather than what is correct 🧪. Fixing #110 on Android therefore
  requires updating that pin **and** the `bionic.ts` row in
  [CORE-DIVERGENCE.md](CORE-DIVERGENCE.md), in the same PR. That is the fork's
  first real exercise, and it is a three-file change rather than a two-repo
  negotiation.

  **The manifest and the CI check are ONE decision, not two.** A manifest
  without a check is documentation nobody enforces — §5.1's own diagnosis of
  F-PRESETS-5, where two copies "were diffed by eye" with "no automated guard
  against the inline copy drifting from the real source." Splitting them here
  would reproduce that. So [CORE-DIVERGENCE.md](CORE-DIVERGENCE.md) and
  `scripts/check-core-baseline.mjs` ship together, and the check is wired into
  `npm run check` in the same change — CLAUDE.md §3 defines "clean" in terms of
  the repo's full verification command, and AD5 and AD10 both record that a
  guard which only runs when someone remembers to invoke it is a guard that
  will eventually stop running.

  **The manifest covers TWENTY-FIVE files, not the fourteen this decision was
  scoped around, and the difference was found by investigation rather than
  assumed.** Every file under `src/` was compared against the web tree at
  `15b6ca3` for this entry 🧪.
  - **The eight seeded `.mjs` headless suites under `src/core/` are included.**
    AD9 and AF9 record them as zero-line-diff copies, and all eight were
    re-hashed identical this session. They are **exactly as duplicated by value
    as the sources they bundle**, and AF14 records that they are invisible to
    both `tsc` programs — so before this change, literally nothing guarded
    them. Excluding them would have left the manifest's largest blind spot
    inside the very directory it exists to cover.
  - **Three storage files are included that this decision's own scoping
    missed.** `src/storage/readingPosition.ts` is a **byte-identical port**
    (AD25) and is *still* byte-identical to web at `15b6ca3` 🧪 — a thirteenth
    undeclared byte-identity surface, unrecorded as such until now.
    `src/storage/storage.ts` names itself a port in its own docblock ("Ported
    from the web repo's src/storage/storage.ts") with only the backing store
    swapped per AD6 📐. `src/storage/headless-test.mjs` is an adapted copy of
    web's suite (AD27).
  - **`src/storage/resumeTarget.ts` and `src/storage/fingerprint.ts` are
    deliberately EXCLUDED**, and the reason is a distinction worth keeping:
    both derive their *logic* from web but neither is a *copy* — their own
    docblocks say "Reimplemented rather than ported" and "This is NOT a port"
    📐. There is no byte-relationship to a web file, so there is no baseline
    that would mean anything. Android-original files (`src/app/*`,
    `ReaderSurface.tsx`, `WordBox.tsx`, `prepareDocument.ts`, and the four
    Android-written suites) are excluded for the stronger form of the same
    reason. **The exclusion is not laziness, it is signal preservation:** a
    manifest that lists every file makes a manifest update part of every
    ordinary edit, which trains people to update it mechanically — and a row
    updated mechanically is a row nobody read.

  **§5.2 (c)'s remaining weakness is inherited, PARTIALLY closed, and the
  residue is stated rather than hidden.** (c)'s *against* includes: "it only
  guards files on the manifest, so a new pure module added here is invisible to
  it until someone remembers to add it — the same 'remember to update the copy'
  weakness one level up." That criticism transfers to this design and is
  **closed for `src/core/` and left open elsewhere**: the check walks
  `src/core/` and **fails on any file present on disk but absent from the
  manifest**, so a new core module cannot be added silently. Outside
  `src/core/` the manifest is opt-in, so a future hand-copy landing in, say,
  `src/reader/` would be unguarded until someone lists it. That is a real
  residue and it is recorded as one. The reason it is not closed by walking all
  of `src/` is the signal-preservation argument above — a whole-tree walk would
  force every Android-original file into the manifest.

  **The `&&` ordering costs something, and the cost is accepted knowingly
  rather than discovered later.** `check` becomes `npm run build && npm run
  check:baseline && npm run test:all`, so the baseline check sits **ahead of**
  the thirteen suites. **A one-line manifest staleness therefore suppresses all
  310 suite checks** — nobody sees a real behavioural regression until the
  manifest is fixed. That is exactly the hazard **AF17** exists to record: this
  repo deliberately made `test:core` non-fail-fast, because "a `&&` chain would
  have hidden suites 2–8 behind the first failure, which is the opposite of an
  honest verification report." Accepted for two reasons. First, it adds **no
  new class of hiding**: `build` already sits ahead of the suites under the
  same `&&`, so a type error already suppresses them, and the baseline check is
  a static check of that same kind — it executes nothing and asserts nothing
  about behaviour. Second, a baseline mismatch means **a core file moved**,
  which is the one thing you want to know *before* reading test output rather
  than after. The alternative — placing it last so the suites always run — was
  considered and rejected on that second point. The tradeoff is written down
  here so a future reader finds it acknowledged in the decision rather than
  discovering it during a red run.

  **Reporting: this is "13 suites plus 1 baseline check", NOT "14 suites."**
  The thirteen are esbuild-bundle-plus-`node:assert` behavioural suites that
  execute real source and assert what it computes; the baseline check executes
  nothing, asserts nothing about behaviour, and needs no esbuild. Folding it
  into the suite count would make the tally answer a different question than it
  has answered since AF10, and would silently inflate a number this repo's
  findings quote repeatedly (125 core checks — AF10, AF18, AF25). It is
  reported on its own line for the same reason `build` is not counted as a
  suite.

  **Validation, recorded because a check trusted on its first green run is not
  a check.** Following AF21's precedent and AD29's, the script was run against
  **six negative controls** before its passing result was believed, and the
  manifest was confirmed byte-identical afterwards by both hash and `diff` 🧪:
  a file edited without its row updated; `Diverged?` claiming `y` while the
  hashes agree; a `src/core/` file dropped from the manifest; a row naming a
  path that does not exist; the fence comment removed; and the fence present
  with every row deleted. All six exited **1**. The last two matter most: a
  check that passes on an unparseable or empty manifest is worse than no check,
  because it reports success while examining nothing.

  **What this does NOT settle.** `D-N` (headless suites on Android) stays
  post-MVP as AD24 left it; AD24 noted that `D-N` "interacts with `D-D`" and it
  does, but the interaction resolves trivially under a fork — the suites are
  Android's, so nothing constrains where they run. The web repo's PORT-AUDIT.md
  §7 item 5 is a **web-side** question and is not answered here. And this entry
  makes **no claim about the web repo's future**: it does not close its issues,
  does not predict the freeze lifting or holding, and creates no obligation on
  anyone who unfreezes it.

## Milestone: release signing + app identity

> **Ordering note.** **AD30 below was appended on 2026-09-02 — BEFORE AD31,
> which appears ABOVE it** in the previous (MVP-planning) milestone and was
> appended 2026-09-03. Entries are grouped by milestone rather than by entry
> number, so a top-to-bottom reader meets AD31 first. This is a grouping
> artifact, not a gap: see the change log at the bottom of this file for dated
> order.

- **AD30 · Release signing is configured by a direct edit to the generated
  `android/app/build.gradle`, reading credentials from a gitignored
  `keystore.properties` at the repo root — NOT by an Expo config plugin. A
  missing or incomplete configuration is a HARD BUILD FAILURE; there is
  deliberately no fallback to debug signing. `app.json`'s display name (AD24
  `D-M`) is implemented in the same change, and had to be sequenced first.**
  This implements AD24 `D-L`'s delivery half — a locally built release APK,
  installed manually, running with no laptop attached.

  **The defect in the template, which is the reason the hard-fail exists.**
  Expo's generated `android/app/build.gradle` points the **release** buildType
  at the **debug** signing config: `release { signingConfig
  signingConfigs.debug }`, under the template's own comment "Caution! In
  production, you need to generate your own keystore file" 📐. An unmodified
  `assembleRelease` therefore **succeeds** and emits an installable,
  **debug-signed** "release" APK. Nothing fails at build time and nothing
  fails at install time — the wrongness surfaces only later, when a genuinely
  release-signed build refuses to install over it with a signature mismatch.
  That is a **silent wrong artifact**, the same class of failure this repo
  keeps recording (AD2, AF8, AD26, AD29), and it is what the hard-fail exists
  to prevent.

  **Consequently the conventional pattern was rejected.** Standard Android
  practice is `if (keystorePropertiesFile.exists()) { … }` with an implicit
  fall-through to debug signing when the file is absent. That pattern
  **reproduces the defect above**: on any machine without `keystore.properties`
  it silently emits the same debug-signed artifact. The whole point of touching
  this file is to remove that outcome, so a fallback that restores it is not an
  acceptable convenience.

  **The hard-fail was specified as a configuration-time `throw` and moved to
  task-graph time, and the relocation corrects a real defect in the
  specification.** A `throw` inside `signingConfigs { release { … } }` executes
  during Gradle **configuration**, which runs for **every** task — so it would
  have broken `assembleDebug` and `npx expo run:android` on any machine without
  a keystore, which is precisely the everyday development loop AD24 `D-L`
  settled on. The guard is therefore `gradle.taskGraph.whenReady`, which fires
  after configuration and before execution, and throws only when a task
  matching `/(?i)release/` is actually in the graph. The behaviour specified is
  unchanged; only its trigger point moved.

  **"Never a wrong artifact" is STRUCTURAL, not dependent on one guard firing.**
  Three independent levels, and the bottom one is what makes the property hold
  even if the top two are wrong:
  1. `signingConfigs.release` is **populated only** when `keystore.properties`
     exists, has non-empty `storeFile`/`storePassword`/`keyAlias`/`keyPassword`,
     and the keystore file it names is present.
  2. The `taskGraph.whenReady` guard throws a `GradleException` naming the
     specific fault before any release task executes.
  3. If both of those somehow failed, the release buildType's `signingConfig`
     is `null` — so the output is an **UNSIGNED** APK, which Android **refuses
     to install**. The degenerate case is a loud install-time rejection, never
     a quiet debug-signed impostor.

  **Alternative rejected: (b), an Expo config plugin.** It has one genuine
  advantage and it is not disputed here — the signing config would be
  regenerated by prebuild rather than merely surviving it, so it would survive
  `npx expo prebuild` in its default clean mode. It is rejected on three
  grounds. First, it buys survival across a regeneration **that nothing in this
  workflow performs** — the development loop is `npx expo run:android`, which
  does not prebuild at all when `android/` exists. Second, it is an untested,
  un-typechecked code path outside `npm run check`: a JS module doing string
  surgery on the template's Gradle file, invisible to both `tsc` programs
  exactly as AF14 records for the `.mjs` suites. That is **AD16's reasoning**,
  which rejected committing the Hermes probe scripts for the same reason.
  Third, and decisively given the failure mode this entry is about: if a future
  Expo template restructures `signingConfigs`, a plugin fails **silently** — its
  pattern stops matching and it re-emits an unsigned or debug-signed release —
  whereas the direct edit fails by **being deleted**, which is obvious on
  inspection and is exactly what the recovery record exists to repair.

  **The three prebuild cases, established by reading this repo's own installed
  CLI** 📐 (`node_modules/expo/node_modules/@expo/cli/build/src/`), because the
  difference between the two options is entirely about what the next prebuild
  does:
  - `npx expo run:android` — **skips prebuild entirely**. `run/ensureNativeProject.js`
    prebuilds only `if (!fs.existsSync(path.join(projectRoot, platform)))`, and
    otherwise returns immediately. The daily loop can never touch the edit.
  - `npx expo prebuild --no-clean` — **reuses** the existing directory.
    `prebuild/copyTemplateFiles.js:77-78` pushes any already-existing path onto
    `skippedPaths` instead of copying over it, then config-plugin mods transform
    the existing files in place.
  - `npx expo prebuild` — **clean is the DEFAULT in SDK 57**. The flag is
    `--no-clean`, and `prebuild/index.js:112` reads `clean: !args['--no-clean']`,
    so a bare invocation deletes and regenerates `android/`. **The dirty-git
    guard cannot protect it**: `android/` is gitignored (`.gitignore:46`), so it
    never appears in `git status --porcelain` and the working tree can be
    perfectly clean while the edit is destroyed.
  That last case is the entire residual risk of choosing (a), and it is
  mitigated by the recovery record rather than by argument.

  **The recovery record is `RELEASE-SIGNING.md`, a new tracked, MUTABLE
  document at the repo root; this entry points at it and duplicates nothing
  from it.** `android/` is untracked, so the edit exists nowhere in git and
  there is no diff to restore from — which is what makes (a) safe rather than
  merely narrow-risk. It was **not** put inside this entry: `DECISIONS.md` is
  append-only and never rewritten, whereas a recovery record must always state
  **current** truth, so an append-only home would eventually hold a stale block
  plus a correction entry and force a restorer to reconcile two versions. The
  split follows AD18's anti-duplication rule in both directions —
  `RELEASE-SIGNING.md` holds the **mechanical artifact** (the three verbatim
  Gradle blocks, their anchors, the `keystore.properties` template, the restore
  procedure, and the `apksigner verify --print-certs` check), this entry holds
  the **rationale**, and no sentence appears in both. The precedent for a
  mutable purpose-built document alongside the canonical ones is `MVP-PLAN.md`
  (AD18). Verified rather than asserted: the doc's four fenced Gradle blocks
  were matched programmatically against the live `build.gradle` — the three
  added blocks present, the removed template block confirmed **absent** — and
  its `properties` block confirmed byte-identical to the live
  `keystore.properties` 🧪.

  **No credential is in any tracked file, and none ever may be.**
  `keystore.properties` is created as a **template with placeholder values
  only** — `storeFile` prefilled with the keystore's filename, which is a path
  and not a secret, and three `CHANGEME` values for the project owner to fill in
  locally. It is gitignored at `.gitignore:48`, and the keystore itself at
  `.gitignore:47` (`*.keystore`); both were confirmed by `git check-ignore -v`,
  and `git log --all -- "*.keystore"` is empty 🧪. The keystore file was never
  read, and no password was handled, requested, or recorded at any point.

  **`D-M` is implemented here, and the sequencing was forced rather than
  chosen.** AD24 settled `D-M` as display-name-only with the template's
  adaptive-icon and splash configuration kept; this change sets `app.json`'s
  `name` from the template's `ReadingAidAndroid` to **`Reading Aid`**. It had to
  come **first**, before the signing edit, because the display name reaches the
  app only through `android/app/src/main/res/values/strings.xml`, which **only
  prebuild generates** — and `npx expo run:android` skips prebuild when
  `android/` exists, so the name cannot land without one. Since a bare prebuild
  is clean by default, running it **after** the signing edit would have
  destroyed the edit. Deferring `D-M` to a later change was therefore **not
  free**: it would have been a **second destruction event**, requiring the
  recovery procedure to be exercised for a cosmetic string. AD24 already
  flagged that an `app.json` edit "should ride along with whatever native change
  happens first"; this is that ride-along. The prebuild that carried it is
  recorded as **AF41**, including that it produced **zero** template drift in
  `build.gradle`.

  **What a successful release build will and will not establish. Stated plainly
  so nobody later reads a green release build as covering more than it does.**
  - **`minifyEnabled` is `false`**, and this was checked rather than assumed:
    `android/app/build.gradle:69` derives it from
    `findProperty('android.enableMinifyInReleaseBuilds') ?: false`, and that
    property is **absent** from `android/gradle.properties` 📐. So **R8/Proguard
    is NOT exercised by the default release build** — one of the two things
    AF26 point 3 names as untested stays untested.
  - **Hermes release-mode bytecode precompilation IS exercised**
    (`hermesEnabled=true`, `android/gradle.properties` 📐). That is the
    genuinely new surface relative to every device observation this repo holds,
    all of which are debug builds (AF27, AD24 `D-L`).
  - The artifact is a **universal APK across four ABIs** —
    `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64` with no split
    configured 📐. Fine for a manual install; it is simply large.

  **ACCEPTANCE CHECK PENDING — nothing in this entry was executed against
  Gradle.** No Gradle build, no `assembleRelease`, no emulator and no device run
  was performed, by direction. The signing configuration is a **source-level
  design that has never run**, and its first real test is the project owner's
  release build. Recorded as pending in the same shape as AD21's, AD22's and
  AD28's acceptance probes, and it will produce its own `AF` entry: a successful
  build whose APK reports a certificate other than `CN=Android Debug`, and — the
  negative control that makes the first result meaningful — a build with
  `keystore.properties` temporarily absent that fails with the `GradleException`
  rather than emitting an artifact.

## Milestone: working-agreement ownership

> **Ordering note.** AD32 below extends **AD31**, which sits ABOVE this section
> in the earlier MVP-planning milestone. AD30, between them, belongs to the
> release-signing milestone and is unrelated to either. Entries are grouped by
> milestone rather than by number; the change log at the bottom of this file is
> dated and correct.

- **AD32 · `CLAUDE.md` becomes ANDROID-OWNED. Byte-identity to the web repo's
  copy is abandoned, and the file joins
  [CORE-DIVERGENCE.md](CORE-DIVERGENCE.md)'s manifest as row 26 — a
  baseline-pinned file like the other twenty-five. This is an EXTENSION OF
  AD31, not a fresh case, and it is written that way deliberately: AD31's
  argument is not restated here, only applied to a file AD31 left out.**

  **Why AD31 already decided most of this.** AD31 settled `D-D` by forking
  `src/core/` on the finding that the web repo is frozen and **is not a live
  sync source** — "byte-identity to WEB is no longer maintained or checked for
  anything." AD12 and AD14 hold this one file byte-identical to that same
  repo. Holding one file identical to a repo already declared
  non-authoritative is **residue from a decision that has been reversed**, not
  a surviving obligation. AD31's own scoping simply did not name `CLAUDE.md` —
  the same way its scoping missed three storage files, which it found by
  investigation and folded in.

  **The two working agreements now describe two different repos, and that is
  what makes a shared document not worth maintaining.** This repo has a fork
  manifest, a baseline check inside `npm run check`, a release signing
  configuration and [RELEASE-SIGNING.md](RELEASE-SIGNING.md). The web repo has
  none of these and, frozen, will not get them. A shared working agreement
  describing a **shared** situation earns its maintenance cost; one describing
  two divergent situations does not — it just guarantees that whichever repo
  changes first is the one the document is wrong about.

  **THE CONCRETE TRIGGER, and it is not stylistic.** CLAUDE.md §4 stated the
  React Native highlight mechanism was **"UNDECIDED — do not treat this as
  settled"**, offering `setNativeProps` and Reanimated shared values as
  candidates. **AD21 decided it** — word boxes, one `flexWrap` `View` per
  block, one text element per word, a single Reanimated shared value compared
  on the UI thread against each word's flat index, no React re-render on a
  tick — and established that `setNativeProps` is not merely "deprecated" but
  **unavailable**, there being no `newArchEnabled` flag to set under Expo
  SDK 55+. **AF32 then proved it on physical hardware**: zero spontaneous
  React renders across **1339 frames and 66 word advances** over two device
  runs, against a negative-control button that moved the counter by exactly one
  per tap. So the governing document was wrong about the **single most
  important architectural fact in the repo**, and §2's own rule — "If code and
  a doc disagree, fix one and flag the drift — never leave them at odds" —
  forbids leaving it. The document that forbids the drift was the document
  carrying it.

  **Alternatives rejected**, recorded so this is not read as unopposed.
  - **(a) Leave `CLAUDE.md` alone and let a future `ARCHITECTURE.md` carry the
    correction.** Cheapest, and needs no cross-repo work at all. Rejected
    because it **knowingly institutionalises a doc-versus-doc contradiction
    inside the governing document**, which §2 forbids in as many words — and
    the ordering is against it: a reader arriving cold opens `CLAUDE.md`
    first, and `ARCHITECTURE.md` **does not exist in this repo** (📐 — `ls`
    fails on it; this file's change log records it as deliberately out of
    scope), so the correction would live nowhere for an unbounded period.
  - **(b) Fix it in the web repo and copy across, repeating AD14.**
    Convention-clean, and it is the **established precedent** — AD14 did
    exactly this for §3, and AD18 provided for a single-PR freeze exception.
    Rejected on two grounds. It requires a deliberate freeze exception on a
    repo **AD31 has just finished establishing is not a sync source**, which
    spends the exception to preserve a property AD31 abandoned. And it would
    leave the **web** repo's working agreement asserting an **Android**
    mechanism decision (word boxes, Reanimated shared values, Expo SDK 55+)
    that web has no stake in and cannot exercise.

  **THE COST, recorded honestly.** Byte-identity here was **deliberate**, not
  accidental: AD12 declined to edit §3 locally precisely to avoid desyncing the
  two copies, and AD14 restored identity by hash after web PR #107. AD32 gives
  that up, and the two working agreements can now **drift silently from each
  other** — nothing will ever again compare them, and no mechanism proposes to.
  That is accepted because the manifest catches drift **from the RECORDED
  BASELINE**, which is the drift that matters for this repo, and because under
  AD31 drift from web **is no longer a defect**. The same trade, for the same
  reason, as the twenty-five rows already in the manifest.

  **Row 26 ships `Diverged? = y` on day one, and is the manifest's FIRST
  diverged row.** Its baseline is the hash the file had at the fork —
  `407d965a93d176bc5da85922c7aef0965fd53749e5f2e63cd753490b7f30e8a6` —
  **verified against the file before editing it** rather than taken from AD14
  or from the task instruction (🧪, `shasum -a 256`); its current hash,
  `4bc3379715f0b12a5856603b09fada2a6327aa09ac9c47c612d8c9e1d7c64ddf`, is what
  the two §4 edits below produce, and `Record` points here. That is
  CORE-DIVERGENCE.md §3's procedure running exactly as written, in the same PR
  as the edit, and §3 already says what to make of it: "A red baseline check is
  not a bug report… the fix is almost always 'write the row'." The baseline
  value is also the web copy's hash at the fork revision `15b6ca3` — whose
  commit *is* AD14's `#107` — so this file's fork point is precisely
  documented; that identity is inherited from AD14 and CORE-DIVERGENCE.md §1
  and was **not** re-measured against web here.

  **The check needed no change, verified by reading it rather than by running
  it green.** Rows resolve as `path.join(repoRoot, row.file)`
  (`scripts/check-core-baseline.mjs:138` 📐), so a repo-root path works with no
  `src/`-prefix assumption; the completeness walk covers `src/core/` only
  (`:168-177` 📐), so row 26 is a manifest row **without** being under that
  walk; and a diverged row is *accepted* on condition of `y` plus a non-empty
  `Record` (`:159-164` 📐), which is the condition this row meets. **No script
  edit and no workaround** — had the check rejected either a root-level path or
  a diverged row, that would have been a defect to report, not something to
  design the manifest around.

  **THE `CLAUDE.md` EDIT IS TWO CHANGES, AND THE SECOND WAS INITIALLY DEFERRED
  IN ERROR. Recorded because the reasoning that pulled it in is the reusable
  part.**
  - **(1) The mechanism's status.** The bullet now reads settled by AD21 and
    proven by AF32, and retires `setNativeProps` explicitly. **The invariant
    itself and all three guards are left byte-for-byte as written.** AD21
    changed none of them — the integer-callback seam, the index-stays-a-ref
    rule and the viewability-callback prohibition are what the section exists
    for, and AF38 records guard 3 holding **structurally** in the shipped
    surface. Only the mechanism's status was ever undecided, never the rule it
    serves.
  - **(2) §4's preamble premise, at line 43.** It read "Each is stated in full
    below because this file carries verbatim between repos and must stand
    alone." **AD32 makes the first clause false** — and false about the very
    section AD32 edits. It now reads "because this file is Android-owned
    (AD32) and must stand alone": the premise is swapped and **nothing else
    is**. The "stated in full" requirement and "must stand alone" both
    survive, and *stand alone* arguably **binds harder** under ownership than
    under carry-over, since there is no longer a second copy to fall back on.
    The following sentences — F1, F16 and PORT-AUDIT.md §4.5 living in the web
    repo, to be treated as back-references rather than live pointers — are
    **untouched**; AD31 already established that back-references survive the
    fork, and nothing about them is affected.

  **This second edit was deferred as "a second decision" in the plan and the
  project owner overruled that, correctly.** The distinction that settles it,
  recorded for reuse: a statement **your own change negates** is part of that
  change, whereas a statement that was **already** false independently of it is
  not. Shipping edit (1) without edit (2) would have **manufactured** a
  falsehood in the governing document one paragraph above the fix for a
  falsehood — reproducing the exact defect AD32 exists to correct, and handing
  a future reader a §4 that cites AD32 as its authority while also asserting it
  carries verbatim to a repo AD32 just cut it loose from. Correcting a
  consequence of a change is finishing that change, not opening another one.

  **KNOWINGLY LEFT UNEDITED — three further statements in `CLAUDE.md` that are
  false or stale but are NOT consequences of AD32, so each remains its own
  decision.** They are recorded so a future reader finds them acknowledged
  rather than discovering them, and the boundary against edit (2) above is the
  whole reason they are separable.
  1. **§2's document list names `PROJECT_CONTEXT.md` and `ARCHITECTURE.md`,
     neither of which exists in this repo** 📐. Pre-existing and entirely
     independent of AD32. Expected to be resolved by the `ARCHITECTURE.md` and
     `PROJECT_CONTEXT.md` work that follows this change rather than by an edit
     to §2 in isolation.
  2. **§2's list omits `CORE-DIVERGENCE.md`, `MVP-PLAN.md` and
     `RELEASE-SIGNING.md`** — so the document defining "done" does not mention
     the manifest whose §3 requires a row *in the same PR as the file edit*.
     Incomplete rather than false, also pre-existing, and folded into the same
     follow-up.
  3. **Invariant 2's prose says "re-render only at block /
     virtualization-window boundaries."** Android has no virtualization
     (AD24 `D-G`), so there are no virtualization-window boundaries and every
     block mounts. The principle holds and the parenthetical is web-shaped.
     **Deliberately reserved: it is invariant text**, and this entry changes
     the mechanism's status only, never the rule.

  **CORRECTION TO AD26, which is append-only and is NOT edited.** AD26 states
  that "zero colour literals appear in code anywhere under `src/` outside this
  file 🧪". **That is now false**, and the line numbers were verified for this
  entry rather than inherited: `src/reader/palette-headless-test.mjs` carries
  two, at **lines 355–356** — ``HIGHLIGHT_BG === `rgba(59, 110, 165,
  ${LAYOUT.highlightOpacity})` `` and `LIGHT.accent === '#3b6ea5'` — inside the
  `ok(...)` call opening at line 353, whose label reads *"the highlight is
  still DERIVED from the accent, not a second literal (AD26)"* 🧪. A sweep of
  all of `src/` for hex and `rgba()` values returns exactly two files:
  `palette.ts` (seven literals) and that suite 🧪.
  **Harmless in substance, wrong in fact.** The literals are **test
  expectations about `palette.ts`**, not styling — AD26's real point, that no
  use site hard-codes a colour, still holds, and no styling code outside
  `palette.ts` carries one. The claim was **true when AD26 was written** on
  `feature/mvp-reader` and was falsified later the same day by AD29's
  thirteenth suite. Recorded here for the reason AF37 gives: a log entry
  asserting something measurably untrue is caught by nothing and is treated as
  ground truth by every later reader. Noted for whoever restates it: the
  assertion that falsifies the claim is the one **guarding** AD26's other
  claim, so the fix is to **reword the scope, never to delete the check**.

  **What this does NOT do.** It creates **no obligation on the web repo** and
  no web file was modified, no web issue opened, edited or closed — the web
  `CLAUDE.md` keeps its own wording, including §4's UNDECIDED note, which is
  **correct for that repo**, since web's mechanism is the DOM one and it has no
  React Native port. It makes no claim about the freeze lifting or holding. It
  does not extend the manifest's completeness walk beyond `src/core/`, so
  AD31's recorded residue — a future hand-copy landing outside `src/core/`
  being unguarded until someone lists it — is **unchanged**. And it settles
  nothing about `MVP-PLAN.md`, which needs no change: its `D-D` row already
  reads DECIDED → AD31, and its `D-E` row already reads DECIDED → AD21, which
  is the agreement the §4 edit restores 📐.

- **AD33 · CLAUDE.md §2's document list now names every document that carries
  an obligation, and states which documents are append-only. This closes the
  second of AD32's three recorded residues.**

  **What was wrong, and why it mattered.** §2 defines what "done" requires
  updating, and it listed four documents. It omitted
  [CORE-DIVERGENCE.md](CORE-DIVERGENCE.md) — whose §3 makes updating a listed
  file's manifest row part of **the same change** as the file edit — and
  [RELEASE-SIGNING.md](RELEASE-SIGNING.md). The omission was not cosmetic: **a
  contributor following §2 literally would edit a listed file, leave the
  manifest alone, and fail the baseline check inside `npm run check`.** The
  document defining "done" did not mention a requirement of being done. §2 now
  states that obligation in its own terms and **cites** CORE-DIVERGENCE.md §3
  rather than restating the procedure (AD18).

  **Why it waited, and the rule that made waiting correct.** AD32 recorded it
  as residue item 2 and deferred it. AD32's boundary rule is that **a statement
  your own change negates is part of that change; one already false
  independently of it is not.** This residue was squarely in the second
  category — §2's list was incomplete before AD32 and untouched by it — so
  deferring was right, and this is the separate decision AD32 said it would
  take. Residue item 1 (§4's "carries verbatim between repos") was in the
  *first* category and was therefore fixed inside AD32 itself.

  **The other half of residue item 2 closed with no action at all.** §2 named
  `PROJECT_CONTEXT.md` and `ARCHITECTURE.md` when neither existed, so those
  `@`-references pointed at nothing. Both have since been written
  (`ARCHITECTURE.md` in PR #20, `PROJECT_CONTEXT.md` in #21), and **all four
  original `@`-references now resolve** 🧪. None of the four existing bullets
  was edited.

  **Append-only versus mutable is stated in §2 because §2 is where a
  contributor meets the list.** `DECISIONS.md` and `FINDINGS.md` are
  append-only; every other document is mutable and rewritten in place to state
  current truth. Previously "Append-only" appeared on the `DECISIONS.md` bullet
  alone, leaving `FINDINGS.md`'s status implicit and the mutable documents'
  unstated — and a contributor who guessed wrong in either direction would
  rewrite history or leave a stale record standing.

  **`MVP-PLAN.md` needed no repointing: CLAUDE.md never named it** 🧪. Its
  deletion in #21 left no dangling reference here.

  **Row 26's `Record` becomes `AD32, AD33` — append, never replace — and that
  is the convention this entry sets.** CLAUDE.md is the first manifest row to
  diverge a **second** time, and §3's step 3 is written in the singular. The
  rule follows from CORE-DIVERGENCE.md §2's own definition: `Record` names the
  entry accounting for the row's **current state**, and the current bytes are
  the product of both edits — AD32's §4 correction and this §2 correction — so
  dropping either would leave half the divergence unexplained. The cell format
  is not new: rows 21 and 22 already carry comma-separated pairs.
  `Baseline sha256` is untouched, per §3. A **reverting** edit needs no new
  rule: §3 already returns such a row to `Diverged? = n` with `Current` equal
  to `Baseline`.

  **The edit is six added lines and no deletions**, `4bc33797…` →
  `0382990a…`; §2's four existing bullets and its closing "fix one and flag the
  drift" line are byte-identical.

  **Knowingly left, unchanged from AD32's list:** residue item 3, invariant 2's
  "virtualization-window boundaries" prose, which is invariant text and stays
  reserved. AD32's boundary applies to this change too.

## Milestone: lint + CI

- **AD34 · ESLint is added at "Level 2" strictness and a GitHub Actions
  workflow runs it alongside the existing gates on every pull request. Three
  `files` overrides keep the config off files pinned in
  [CORE-DIVERGENCE.md](CORE-DIVERGENCE.md). `lint` is deliberately NOT chained
  into `npm run check`.** This is tooling only: no file under `src/` changed,
  and no file listed in the manifest's twenty-six rows changed.

  **Two gaps motivate it, and the second is the one with no prior mitigation
  at all.**
  1. `npm run check` runs locally and only when someone remembers. AD5 and
     AD10 both record the principle — "a guard that only runs when someone
     remembers to invoke it is a guard that will eventually stop running" —
     and until now nothing enforced it on a pull request.
  2. **`tsc` sees only `.ts`/`.tsx`, so the fourteen tracked `.mjs` files had
     no static analysis of any kind.** AF14 recorded this in 2026-08-31 as a
     consequence "worth naming" and nothing has addressed it since: the main
     `tsconfig.json` includes `**/*.ts` and `**/*.tsx` only, and
     `tsconfig.core.json` sets no `allowJs` 📐. Those fourteen files are the
     thirteen headless suites **and `scripts/check-core-baseline.mjs`** — the
     script that enforces the fork manifest. ESLint is the only tool in this
     toolchain that can see them.

  **Level 2 = stock `eslint-config-expo` plus six rules:** unused-vars as
  **error** (stock has it at `warn`), `no-explicit-any`, `import/order`,
  `no-console`, `prefer-const`, `eqeqeq`. Level 1 (stock alone) was rejected
  as leaving unused variables advisory; a Level 3 with type-aware linting was
  rejected because it requires a `project` service pass over a tree whose
  `tsconfig.core.json` deliberately excludes ambient types (AD3, AD4), and
  buying that interaction is a separate decision from turning linting on.

  **The `@typescript-eslint` rules had to be scoped to a TS-file block, and
  this is a hard constraint rather than a stylistic choice.**
  `eslint-config-expo` registers that plugin only inside
  `files: ['**/*.ts', '**/*.tsx', '**/*.d.ts']` 📐, so naming
  `@typescript-eslint/no-unused-vars` in an unscoped block fails ESLint
  outright with *"could not find plugin"* 🧪 — measured, not reasoned about.

### The three overrides

  Each exists because the alternative is editing a manifest-pinned file, which
  CORE-DIVERGENCE.md §3 makes a same-PR row update plus an `AD` entry — a
  different decision than this one.

  **(a) `src/pacer/usePacer.ts` — the React Compiler rules, this path only.**
  Measured on the real tree: **7 errors**, all in this file — `react-hooks/refs`
  ×5 at lines 78, 80, 82, 84, 86; `react-hooks/immutability` at 164;
  `react-hooks/set-state-in-effect` at 183 🧪. Every one objects to the design
  **CLAUDE.md §4 invariant 2 mandates** and that **AF32** proved on physical
  hardware (zero spontaneous React renders across 1339 frames and 66 word
  advances) and **AF34** measured the clock for. The file is manifest **row
  21**.

  *Alternatives rejected.* **Inline `eslint-disable` comments** — they change
  the file's bytes, so they would cost a row-21 `Current sha256` update, a
  `Diverged?` flip and a `Record` entry to buy exactly what a config rule buys
  for free. **Refactoring to satisfy the rules** — it would spend device
  evidence that is a property of *this* implementation; AD25 already records
  that the port is a four-line diff from web, and AF34 measured *this* clock,
  not a rewritten one.

  **WHY THOSE RULES FIRE — and a correction to the premise this change was
  requested under.** The change was scoped on the claim that the React
  Compiler rules fire because `app.json` sets
  `"experiments": { "reactCompiler": true }`. **They do not, and the claim was
  checked rather than inherited.** `eslint-config-expo` contains no reference
  to `app.json`, `reactCompiler` or `experiments` anywhere 🧪. The rules come
  from **`eslint-plugin-react-hooks@7.1.1`'s `configs.recommended`**, which
  sets all three to `"error"` unconditionally — verified by loading the preset
  and reading the sixteen rules out of it 🧪 — and `eslint-config-expo`
  spreads that preset in wholesale (`flat/utils/react.js:27` 📐). Nothing
  carries `app.json` to ESLint.

  **The two facts are independent, and both are true.** `app.json` really does
  opt into React Compiler, and that opt-in governs the **Metro/Babel build**
  📐. So the rules are not describing a constraint this project ignores — the
  build honours React Compiler, and the rules encode real hazards. They are
  simply **wrong about this one file**, for the reasons CLAUDE.md §4 and
  AF32/AF34 give: the ref writes, the self-referencing rAF and the terminal
  `setPlaying(false)` are the mechanism by which the document tree does *not*
  re-render on a pacer tick. The override is therefore a scoped exemption from
  a stock plugin preset, not from a project opt-in. Recorded at this length
  because a log entry asserting a causal chain that does not exist is
  **AF37's** recorded failure class, and it is caught by nothing.

  **(b) `**/*.mjs` — `no-console` and `import/order` off.** The premise this
  was scoped under was that `no-console`'s only problem is the two intentional
  `console.warn` calls in `src/core/parsers/epubStructure.ts` (manifest row 7),
  solved by `allow: ['warn']`. Measured, that is wrong in both directions 🧪:
  `allow: ['warn']` silences those two so they never appear — **zero
  `no-console` hits in any `.ts`/`.tsx`** — while the actual **61** hits are
  `console.log`/`console.error` in the fourteen `.mjs` files, which
  `allow: ['warn']` does nothing for. Those calls are not debris: they print
  every `PASS`/`FAIL` line and every tally `npm run check` reports. Printing is
  what those programs are for.

  `import/order` produced **13** hits, all in `.mjs`, all the identical idiom —
  `esbuild` imported before `node:path` 🧪. **Nine of those files are
  manifest-pinned** (rows 13–20 and row 25). Fixing them edits pinned files;
  fixing only the four unpinned ones would split byte-identical idiom on
  manifest membership, leaving the seeded suites and the Android-written ones
  gratuitously inconsistent. A style rule that a pinned file can never satisfy
  is a rule that gets suppressed forever or forces an edit the manifest
  forbids, so it is scoped off where that is true and left on everywhere else.

  **`no-console`'s `allow: ['warn']` is repo-wide on the TS side, not scoped to
  `epubStructure.ts`.** `console.warn` is the deliberate channel for a
  degradation warning anywhere in the app, and **AF27** confirms warns reach
  the Metro terminal on-device. The cost is zero either way (0 violations
  under both scopings 🧪), and file-scoping it would mean the next legitimate
  `warn` elsewhere raises a spurious error that someone "fixes" by editing a
  pinned file — manufacturing the hazard the override exists to prevent.

  **(c) `**/*.d.ts` — `no-var` off.** An **eighth** error, absent from this
  change's scoping and found by measuring: `types/hermes-globals.d.ts:19`,
  `declare var console` — AD4's five-method ambient declaration 🧪. That file
  is **not** in the manifest, so editing it is permitted; it is exempted
  anyway, because `declare var` is the canonical ambient-global form —
  `lib.dom.d.ts` declares `console` with exactly it — and `declare const` would
  not be a fix. This extends an exemption `eslint-config-expo` itself
  established: its core config already carries a `files: ['**/*.d.ts']` block
  turning `import/order` off 📐, and simply leaves `no-var` on.

### What the `.mjs` override does and does not cost

  **The `.mjs` static-analysis gap is NARROWED, not closed, and the difference
  is stated because the unqualified claim would be an overclaim.** After the
  override, **67 rules remain active** on a `.mjs` suite — 46 at error, 21 at
  warn — resolved from the real config with `calculateConfigForFile` rather
  than assumed 🧪. Live at **error**: `no-undef`, `no-dupe-args`,
  `no-dupe-keys`, `no-duplicate-case`, `use-isnan`, `valid-typeof`, `no-var`,
  `prefer-const`, `eqeqeq`, `import/no-unresolved`, `import/export`,
  `import/namespace`. Live at **warn**: `no-unused-vars`, `no-unreachable`,
  `no-unsafe-negation`, `no-unused-expressions`, `no-redeclare`,
  `import/no-duplicates`, `import/first`, among others — and because the script
  carries `--max-warnings 0` (below), warn-level rules fail the run too.

  Exactly **two** of the six Level 2 rules are off there, and both are
  stylistic: `no-console` and `import/order`. `prefer-const` and `eqeqeq` stay
  at error; `no-unused-vars` stays live at warn via the base rule, since the
  TS-plugin block does not apply to `.mjs`. **So: correctness rules cover these
  files where nothing covered them before; formatting rules do not.** That is a
  narrower claim than "the gap is closed", and it is the true one.

### `lint` is not chained into `npm run check`

  AD5 and AD10's argument points the other way and is not dismissed: a check
  nobody remembers to run stops running. It is answered by the workflow rather
  than by the chain. Three reasons against chaining. `npm run check` is
  `build && check:baseline && test:all`, so adding lint puts a **style** gate
  in an `&&` chain with **behavioural** ones — the masking **AF17** recorded
  and that `test:core` was deliberately written non-fail-fast to avoid. It
  would change what `check` reports, which AD31 fixed as "13 suites plus 1
  baseline check". And `check` stays runnable on a clone whose install
  scripts were never approved, which AD10 and **AF13** both name as the
  reason `build` was kept cheap and unconditional. **The local pre-push
  sequence is therefore two commands, `npm run check` then `npm run lint`**,
  and ARCHITECTURE.md §6 names it so the separation is discoverable rather
  than surfacing as a red pull request.

### `lint` invokes `eslint` directly, not `expo lint`

  `package.json` carried `"lint": "expo lint"` from the template. It becomes
  **`"lint": "eslint . --max-warnings 0"`**. Read out of this repo's own
  installed CLI 📐 (`@expo/cli/build/src/lint/`):

  - **`expo lint` would not lint the files this change exists for.**
    `lintAsync.js` defines `DEFAULT_INPUTS = ['src', 'app', 'components']` and
    keeps only those that exist. Here that is `src` alone — README already
    records that routes live at `src/app/` and there is no top-level `app/` —
    so `expo lint` never sees **`scripts/check-core-baseline.mjs`**, one of the
    fourteen `.mjs` files and the one that enforces the manifest, nor
    `types/hermes-globals.d.ts`. That defeats gap 2 above.
  - **It mutates the repo when its prerequisite fails.**
    `if (!await prerequisite.assertAsync()) await prerequisite.bootstrapAsync()`,
    and `ESlintPrerequisite.js:72` writes `eslint.config.js` from a template
    and installs packages 📐. A CI step that may install and scaffold is not a
    deterministic gate.
  - It adds layers with nothing to buy: `setNodeEnv('development')`, env-file
    loading, a package-manager bin resolution, and a cache under
    `.expo/cache/eslint/` 📐.

  **`--max-warnings 0` is included deliberately.** Stock `eslint-config-expo`
  sets many rules to `warn`; without the flag the "0 errors, 0 warnings" target
  is advisory and would decay silently as warnings accumulated.

  **README's script inventory needed no edit**, and this was checked rather
  than assumed: it lists script *names*, `lint` is still one of them, and the
  count is still twelve 🧪.

  **The config is `eslint.config.js`, CommonJS, and is NOT named
  `eslint.config.mjs`.** `package.json` declares no `"type": "module"`, so a
  `.js` config is CJS. `.mjs` was rejected for a bookkeeping reason rather than
  a technical one: a fifteenth `.mjs` file would muddy AF14's "fourteen tracked
  `.mjs`" framing and the "13 suites plus 1 baseline check" accounting AD31
  protects. It needs no CommonJS-scoped block — `eslint-config-expo`'s core
  config already declares `module`, `require`, `exports`, `global` and
  `console` as globals 📐 — and that this is a real pass rather than a disabled
  rule was confirmed against a negative control (AF44).

### The workflow: one job, separate steps, named `static-and-suites`

  `.github/workflows/static-and-suites.yml`. Triggers are `pull_request` with
  **no branch filter** — a `dev` branch is expected later and an unfiltered
  trigger needs no edit when it arrives — and `push` to `main`.

  **No `paths:` filter, ever.** A required check carrying one never reports on
  a pull request that touches nothing it matches, and GitHub then holds that
  pull request unmergeable forever waiting for a check that will never run.

  **Steps are separate rather than one `npm run check`,** for AF17's reason
  again: the `&&` chain hides everything after the first failure, and in CI
  separating them is free. **`check:baseline` gets its own step** so AD31's
  reporting form survives in the run log — "13 suites plus 1 baseline check",
  never "14 suites"; that step executes nothing and asserts nothing
  behavioural. **Lint runs last** so a lint failure never masks a behavioural
  one.

  **Separate *jobs* were rejected.** Each would pay a fresh `npm ci` to
  parallelise a few seconds of compute, and would multiply the install without
  making any failure clearer than a named step already does.

  **Node is pinned to major `26`** via `actions/setup-node`, with npm caching
  on. There is no `engines` field to inherit from, so the pin is a choice: it
  reproduces the evidence base, since every recorded measurement was taken on
  **v26.7.0** (**AF10**'s suite run; AD27 ran the web fingerprint oracle under
  Node v26). The suites are pure Node with no native dependency and no network,
  so a CI/local split would introduce a variable with nothing to buy for it.
  *No claim is made here about Node 26's release-line status; it was not
  verified.*

  **THE NAME IS LOAD-BEARING AND MUST NOT BECOME `tests` OR `build`.** The
  required check is the job key, `static-and-suites`. A green tick means `tsc`
  passed, the fork baseline matched, thirteen suites passed and lint was
  clean — and **nothing whatsoever** about the device behaviour this project
  actually rests on. ARCHITECTURE.md §6 lists what has no automated coverage
  and README states it as *"a developer who changes the highlight mechanism,
  sees a green check, and ships has re-proven nothing."* A check named `tests`
  would invite exactly the reading those two documents exist to prevent. The
  job key is also the identifier any branch-protection rule binds to, so
  renaming it silently detaches that rule.

  **NOT VERIFIED, and stated plainly: the workflow has never run.** No
  GitHub Actions execution happened for this entry. The file was parsed
  locally and its structure asserted (**AF44**), which establishes that it is
  valid YAML with the intended keys and **nothing** about whether Actions
  accepts the schema, resolves Node 26 on the runner, or renders the check
  name as expected. It is unproven until the first pull request runs it.

### Cleanups carried in the same change

  Three, all removals, none behavioural. **`npm ci`** cleared **201
  extraneous** top-level packages — residue of a reverted `expo lint` run,
  including a full `eslint` tree — which is why `expo lint` behaved differently
  here than on a fresh clone; 229 top-level entries became 28 🧪. **The
  untracked, gitignored `example/`** (20 files) was deleted: it is the Expo
  template sample and its eleven `require()` calls were the *only* thing
  referencing the assets below. **Fourteen tracked, unreferenced assets**
  (446,089 bytes, measured exactly 🧪) were deleted, each confirmed absent from
  all fifty-five tracked non-asset files first. `assets/expo.icon/` and
  `assets/images/favicon.png` were deliberately left — they belong to a
  deferred iOS/web scope call — as were the five assets `app.json` references.

  **One flagged, not fixed:** `tsconfig.json`'s `exclude` still lists
  `${configDir}/example`, now naming a directory that does not exist. Harmless
  — a TypeScript exclude pattern matching nothing is inert — and left alone
  deliberately, since `example/` is gitignored and a future `create-expo-app`
  comparison could recreate it. **AF8** already records that this `exclude`
  list is a hand-maintained copy that no mechanism keeps in sync; this is one
  more entry in it.

- **AD35 · `actions/checkout` and `actions/setup-node` are bumped from `@v4`
  to `@v7`, on moving major tags rather than SHAs. Separately, this repo STAYS
  ON ESLint 9: the `npm ci` deprecation warning is EXPECTED and is not a
  defect.** Two follow-ups from reading PR #23's first workflow run, batched
  because both are positions about the same file's toolchain and neither
  touches `src/`. **No file listed in
  [CORE-DIVERGENCE.md](CORE-DIVERGENCE.md)'s twenty-six rows changed, and
  `package.json`, `package-lock.json` and `eslint.config.js` are untouched.**
  Measurements are **AF45**.

### The action bump is DEADLINE-BEARING, not housekeeping

  PR #23's run closed with
  `##[warning]Node.js 20 is deprecated. The following actions target Node.js 20
  but are being forced to run on Node.js 24: actions/checkout@v4,
  actions/setup-node@v4`. **It is green only because GitHub is currently
  forcing the upgrade**, and that fallback has a date on it: GitHub's own
  changelog states *"we upgrade the runner and remove Node20 on September 23rd,
  2026"* — **nineteen days after this entry**, against 2026-09-04. Node 24
  already became the runner default on 2026-06-16.

  **The consequence is what makes this urgent rather than tidy.** `main` is
  now protected with `static-and-suites` as the **sole required status check**
  and `enforce_admins` **enabled**. A workflow that breaks on 2026-09-23 does
  not merely go red: the required check fails on every pull request, there is
  **no admin bypass**, and that includes the pull request that would fix it.
  The window in which this is a one-line change closes on that date.

  **`runs.using` per major, read from each action's `action.yml` at its moving
  major tag** 🧪 — the evidence the version number alone does not give:

  | major | `actions/checkout` | `actions/setup-node` |
  |---|---|---|
  | `v4` | `node20` | `node20` |
  | `v5` | `node24` | `node24` |
  | `v6` | `node24` | `node24` |
  | `v7` | **`node24`** | **`node24`** |

  **So the runtime argument does not discriminate between v5, v6 and v7 — all
  three are already `node24`, and any of them retires the warning.** This is
  worth stating plainly because the obvious reading ("bump until the runtime is
  new enough") would have stopped at v5. **v7 is chosen as the CURRENT line,
  not as the only safe one:** `releases/latest` resolves to **v7.0.1**
  (checkout) and **v7.0.0** (setup-node) 🧪, so v7 is where fixes land first
  rather than by backport. The older majors are still maintained today — all of
  checkout v2 through v7 received a release on 2026-07-20 🧪 — but depending on
  a backport policy is a weaker position than tracking the current line, and
  costs the same here.

  **Bumping does not walk into a second deprecation.** Node.js 24's own EOL is
  **2028-04-30** (nodejs/Release `schedule.json` 🧪), and GitHub has announced
  no `node24` deprecation. The precedent from Node 20 is that GitHub removed
  the runtime roughly five months after Node's EOL, so this is one deliberate
  step with years of headroom, not the first of two.

  **`setup-node`'s behaviour for THIS workflow's inputs is unchanged, verified
  by diffing `action.yml` at v4 against v7 rather than by reading release
  notes** 🧪. `node-version`'s description is byte-identical (`Version Spec of
  the version to use…`), so **nothing about how `'26'` resolves changes**; the
  `cache` input is unchanged and still supports `npm`. The only removed input
  is `always-auth`, which this workflow never used; the additions
  (`package-manager-cache`, and the `cache-primary-key` / `cache-matched-key`
  outputs) are additive. v5's automatic caching — the one genuinely breaking
  change in the range — triggers **only** on a `packageManager` or
  `devEngines.packageManager` field in `package.json`, and **this repo has
  neither** 🧪; the explicit `cache: npm` this workflow passes settles it
  regardless.

  **`checkout`'s two behavioural changes in the range are inert here.** v7
  blocks checking out a fork PR under `pull_request_target` and `workflow_run`;
  this workflow triggers on `pull_request` and `push` only 📐. v6 persists
  credentials to a separate file; nothing here reads them. The minimum runner
  for v5 and above is **2.327.1**, and PR #23's run was on **2.337.0** 🧪.

  **Alternative rejected: SHA-pinning.** Pinning each action to a commit SHA is
  the stronger supply-chain position and is not disputed — a moving major tag
  is mutable by the action's owner, so `@v7` is trust in `actions/*` rather
  than in a fixed artifact. It is **deliberately deferred to its own decision**
  rather than smuggled in here, for the reason AD32 gives about scope: this
  change is a runtime deadline, and a SHA pin is a supply-chain policy that
  would apply to every action this repo ever adds, needs a re-pinning practice
  to go with it, and would make this entry's evidence — `runs.using` per
  **major** — the wrong evidence for what shipped.

  **Alternative rejected: leaving `@v4` until the warning becomes an error.**
  It costs nothing today and everything on 2026-09-23, and the `enforce_admins`
  consequence above means the failure mode is a repository that cannot be
  repaired through its own gate.

  **NOT VERIFIABLE LOCALLY, stated plainly.** Nothing on the development
  machine can execute a GitHub Actions runner, so **no local command proves
  `@v7` resolves, runs, or behaves identically in CI.** The `action.yml` reads
  and release-note evidence above are evidence about the **actions**, not about
  this workflow executing. This pull request's own run is the proof — and
  unlike PR #23's, a failure now lands on a protected `main`. This is the same
  shape of pending acceptance check AD21, AD22, AD28 and AD30 each recorded,
  and it will produce its own `AF` entry.

### ESLint stays on 9 — the deprecation warning is expected

  A clean `npm ci` prints
  `npm warn deprecated eslint@9.39.5: This version is no longer supported.` **No
  change is made in response, and this paragraph exists so that a future reader
  does not "fix" it.**

  **The warning is a line-support policy, not a defect in 9.39.5.** Measured
  against the live registry on **2026-09-04** 🧪: `eslint` dist-tags are
  `latest: 10.10.0` and `maintenance: 9.39.5`. So `package.json`'s `^9.39.5`
  resolved **correctly, to the top of the 9 line**, and the message is ESLint's
  blanket text for every non-current line — it points at
  `eslint.org/version-support`, not at a fault.

  **ESLint 10 is PERMITTED and has not been TESTED, and the gap between those
  two words is the decision.** `eslint-config-expo@57.0.2` declares
  `peerDependencies: { "eslint": ">=8.10" }` 🧪 — an **open upper bound**, so
  npm would install ESLint 10 without complaint. But an open range is a
  statement about what the config's author did not forbid, not about what
  anyone ran. The transitive plugin set that config pulls in —
  `@typescript-eslint/eslint-plugin@8.69.0`, `eslint-plugin-import@2.32.0`,
  `eslint-plugin-react-hooks@7.1.1` 🧪 — **has never been exercised at ESLint 10
  in this repo**, and it is those plugins, not ESLint's core, that produce the
  rules AD34 reasoned about.

  **The cost of moving is re-opening AF44 in full.** AD34's three `files`
  overrides were each justified by a measurement: the **eight**-error stock
  baseline, the **82**-problem Level 2 count, and above all the **67 rules
  still active on a `.mjs` file** (46 error, 21 warn), resolved with
  `calculateConfigForFile`. Every one of those is a property of *this* resolved
  plugin set. A major ESLint bump can change rule defaults, remove rules, and
  shift what a preset spreads — so it does not merely risk a red run, it makes
  the recorded numbers no longer describe the config. **That is a real piece of
  work with a real finding to rewrite, and there is no present benefit to buy
  it with:** `npm run lint` is at 0 errors and 0 warnings, and 9.39.5 still
  receives security fixes as the maintenance line.

  **Therefore: the `npm ci` warning is EXPECTED on every clean install, in CI
  and locally, and is not a defect.** It is not to be silenced, and
  `package.json`'s `"eslint": "^9.39.5"` is not to be widened — the caret is
  what keeps the resolution on 9, so it is load-bearing rather than incidental.

  **Revisit trigger, so this is a position rather than an omission:** move when
  `eslint-config-expo` ships a release whose own CI runs against ESLint 10, or
  when the 9 line stops receiving security fixes — whichever comes first. That
  move is its own change, and it carries a re-measurement of AF44's three
  figures as part of its definition of done.

### One doc fix rides along; one is flagged and not fixed

  **[ARCHITECTURE.md](ARCHITECTURE.md) §6 said "That workflow has never
  executed"**, citing AF44. **AF45 negates that sentence**, so under AD32's
  boundary rule — a statement your own change negates belongs to that change,
  one already false independently of it does not — the clause is corrected in
  this pull request, to point at AF45 instead. It is a one-clause replacement;
  no rationale is restated there (AD18).

  **[README.md](README.md)'s document table is flagged, NOT fixed.** Lines
  178-179 give the entry ranges as `AD1`–`AD32` and `AF1`–`AF43`, both stale —
  AD34 and AF44 already existed before this change 🧪. That falsity is
  **independent of this change**, which puts it in AD32's second category, so it
  is recorded here and left for its own edit rather than folded in.

## Change log
- Created 2026-08-31, alongside [FINDINGS.md](FINDINGS.md), to make CLAUDE.md
  §2 satisfiable for this repo (PROJECT_CONTEXT.md and ARCHITECTURE.md are
  deliberately out of scope for now — too little exists here yet to document
  structure or scope without speculating). Seeded with AD1–AD6, backfilling
  decisions already made in commits `1cd60e2` and `ce3d2ed`/PR #1 that had
  gone unrecorded.
- 2026-08-31 — appended AD7–AD10 for the headless-suite port on
  `test/port-headless-suites`: the `esbuild` devDependency, the 8-of-12
  selection, the zero-edit byte-identical copy, and the deferred
  `build`-chaining fork.
- 2026-08-31 — appended AD11–AD13 on `chore/check-script-and-gitignore`:
  the `check` script resolving AD10's deferred fork, the explicit choice to
  leave CLAUDE.md §3 pointed at `build` and flag the move as a cross-repo
  decision instead of making it here, and the `.headless-*.mjs` `.gitignore`
  rule resolving AF16.
- 2026-08-31 — appended AD14 on `docs/claude-md-verification-target`:
  CLAUDE.md §3 was generalized in the web repo (PR #107) and copied here to
  maintain byte-identity, resolving AD12's deferred cross-repo decision.
- 2026-08-31 — appended AD15–AD16 on `test/hermes-feature-probe`: the
  two-binary split (RN 0.86.3's own compile-only `hermesc` for parse-time
  evidence at the shipping version, an older standalone VM for runtime), and
  the choice to keep every probe script and binary outside the repo so this
  change touches only these two docs.
- 2026-09-01 — appended AD17 on `feature/first-device-build`: replaced the
  Expo-generated placeholder `com.anonymous.ReadingAidAndroid` with
  `com.arishh.readingaid` in `app.json`'s `expo.android.package`, before any
  device or Play Store install, since the package name is immutable in
  practice once distributed.
- 2026-09-01 — appended AD18 on `docs/mvp-plan-register`, opening a new
  MVP-planning milestone: the ~18 open MVP questions are routed to a new
  mutable, disposable `MVP-PLAN.md` (the live register), to AD entries here as
  each settles, and to GitHub issues in this repo for spikes and queued work,
  with the anti-duplication rule (pointer + one-line status on the board;
  rationale in the AD entry only) stated inside `MVP-PLAN.md` itself. Records
  the `D-D` carve-out: it is a web-repo decision and earns a single-PR freeze
  exception when it settles.
- 2026-09-01 — appended AD19–AD20 on `docs/ad19-ad20-mvp-scope`, settling the
  two Tier 0 items in `MVP-PLAN.md`: AD19 fixes feature scope (Flowing
  Highlight only; RSVP, Chunk, bionic and presets cut; one theme, one WPM
  setting), chosen so `D-E` is forced rather than deferred, and it settles
  `D-K` along with `D-A`; AD20 fixes formats (Markdown only; PDF and EPUB
  cut, their pure halves left seeded). Three register sections in
  `MVP-PLAN.md` (§3.1, §3.2, §5.4) were **deleted** and their board rows now
  point here — the first exercise of the anti-duplication rule AD18 records.
- 2026-09-01 — appended AD21 on `docs/ad21-highlight-mechanism`, settling
  `D-E` (the per-tick highlight mechanism CLAUDE.md §4 marks UNDECIDED): word
  boxes in a `flexWrap` `View` per block, driven by one Reanimated shared
  value on the UI thread, with `setNativeProps` unavailable under the New
  Architecture and nested-`Text` animation unsupported. Records what the
  choice permanently gives up (cross-word selection, single-element
  screen-reader output, justification), notes that it makes AD19's
  bionic-first return cheaper than AD19 assumed, and states the acceptance
  probe rather than claiming the mechanism is proven. `MVP-PLAN.md` §4.3 was
  **deleted** and its board row now points here.
- 2026-09-01 — appended AD22 on `docs/ad22-pacer-clock`, settling `D-F` (the
  pacer clock): the web repo's `src/pacer/usePacer.ts` is **ported**, not
  rewritten and not reimplemented, landing at Android `src/pacer/usePacer.ts`
  **outside** `src/core/` and differing from the web original by exactly two
  added `export` keywords. Records that the register's "unported web-layer
  file" framing was wrong — three import statements, none of them a web
  dependency — that the file already satisfies CLAUDE.md §4's guards 1 and 2
  by construction, and that it has **no** test coverage in the web repo, so a
  ninth headless suite is queued. Expands `D-D`'s scope to the twelve seeded
  files **plus** this known-unsynced copy, and states the acceptance probe
  rather than claiming the port is proven. `MVP-PLAN.md` §4.4 was **deleted**
  and its board row now points here; one authorized sentence was added to the
  still-open §4.1, and the ninth suite was added to §8 as queued work.
- 2026-09-01 — appended AD23–AD24 on `docs/ad23-ad24-mvp-scope-revision`.
  **AD23 supersedes AD19 in part:** bionic rendering returns to the MVP (AD21
  had already retired the node-shape objection AD19 cut it on) and natural
  pauses ship always-on with no toggle; WPM remains the only user control, and
  a post-MVP return ladder is recorded for everything still cut. AD23 promotes
  AF31 residue item 4 (`\p{L}` in `bionic.ts`) into the AD21/AD22 acceptance
  probe, and records that `bionic.ts` has **no** test coverage in either repo.
  **AD24 settles the seven remaining MVP-blocking register items as a batch** —
  `D-G` (no virtualization, with an explicit revisit trigger), `D-H` (no file
  picker; seeded sample plus pasted text), `D-I` (reading position only), `D-J`
  (one screen), `D-L` (dev over USB; delivery as a locally built **release**
  APK, and the release-mode evidence gap that creates), `D-M` (display name
  only) and `D-N` (no on-device suites; four targeted probes instead) — and
  records that nothing MVP-blocking is left open. Seven sections in
  `MVP-PLAN.md` (§4.5, §5.1, §5.2, §5.3, §6.1, §6.2, §6.3) were **deleted** and
  their board rows now point at AD24; §3.1's and §5.4's pointers now read
  AD19 + AD23. **AD19 itself is not edited.**
- 2026-09-02 — appended AD25–AD27 on `feature/mvp-reader`, closing the MVP
  build. **AD25 corrects AD22**: the `usePacer.ts` port is a **four-line**
  diff (two added `export` keywords plus two repointed imports), not the
  "exactly two added `export` keywords and nothing else" AD22 claims — AD22
  inherited AD9's relative-path property, which holds only for files *inside*
  `src/core/`, and `usePacer.ts` deliberately lands outside it while importing
  into it. The byte-identical port of `readingPosition.ts` in the same change
  is the controlled contrast. AD22 is **not edited**. **AD26** records
  `src/reader/palette.ts` as a hand-copied duplication of the web `light`
  theme with no sync mechanism — a third `D-D` surface alongside the twelve
  seeded files and `usePacer.ts` — with two deliberate divergences (body 19px,
  heading weight 400) and one **known defect that ships**: the heading scale
  derives from web's 18px base while the body is 19, so h4/h5/h6 are smaller
  than body text and, at weight 400, an h4 is indistinguishable from a
  paragraph; fix deferred to a follow-up. **AD27** records that the fingerprint
  could not be ported (`crypto.subtle` and `File` both absent, `react-native-
  quick-crypto` rejected) and was built as a pure-bytes SHA-256 validated
  against NIST vectors, Node's `crypto`, Node's `TextEncoder` and the real web
  implementation. The concurrency incident that interrupted this milestone is
  recorded separately as FINDINGS **AF37**, since nothing was decided there.
  **MVP functional acceptance:** the project owner ran the built app on a
  physical device and on the emulator and reported every MVP behaviour passing
  — auto-scroll follows the active line, reading position resumes across a full
  app close, Restart works at end of document, the paste box parses, and the
  WPM control is functional. Those runs were witnessed by the project owner and
  **not** by me; I ran no device or emulator at any point.
- 2026-09-02 — appended AD28-AD29 on `feature/click-to-jump`. **AD28** records
  click-to-jump as a scope addition beyond AD19/AD23, requested by the project
  owner after testing the merged MVP: tapping a word seeks the pacer to it, via
  `onPress` on the `Animated.Text` word box AD21 already renders — mechanism
  (a), a per-word responder, chosen because it adds **zero new native nodes**.
  Web's approach does not port at all: `Reader.tsx:27` states it uses one
  delegated handler keyed by `data-word-id` and `:149` resolves the target with
  `closest()`, and React Native has **neither event delegation nor `closest()`**.
  Mechanism (b) — one container responder hit-testing a per-word rect map — is
  rejected and recorded as the scalable alternative, filed with `D-G`/`D-Q`
  alongside AD21's measured-rect overlay, since it is the **same per-word-cost-
  versus-measurement trade in a second place** and wants the same rect map the
  overlay does. Two rulings: a tap **seeks only and never changes transport
  state** (matching web's `onSeekWord={pacer.seek}` at `App.tsx:410`/`:434`),
  and **end-of-document behaviour is left to fall out of `usePacer` unchanged** —
  `startedRef` is deliberately not cleared in `seek` (F23/D89), so a tap on the
  last word keeps Play disabled and the transport reads Restart, while a tap
  backwards flips `atEnd` false and re-enables Play. `src/pacer/` needed no
  change. The entry declines to claim "zero renders": `commit`'s `setAtEnd` is
  the one pre-existing state exception, fires only when `atEnd` flips, and a tap
  on or off the last word therefore costs one render on a human gesture. The
  drag-scrolls-rather-than-seeks property is recorded as a **structural** read of
  `Text.js:449-452` and `Pressability.js:526-529`, with the on-device drag test
  named as a **pending acceptance check**. **AD29** fixes the heading defect
  AD26 recorded as shipping and resolves AF36's pending ruling as **ship as-is**:
  AD26's candidate (ii) (a weight advantage) is rejected because Roboto has no
  usable face between 400 and 700 and a 600 request can land on 700, collapsing
  the bionic anchor AD26's divergence exists to protect; candidate (i) is taken,
  but with the finding that the **UA ratios** were the defect and not merely
  web's 18px base, so the scale is floored above 1.0 rather than re-multiplied.
  At a body of 19 the table becomes **36 / 27 / 24 / 23 / 22 / 21** — h1 and h2
  preserved because they are the only levels the sample renders and therefore the
  only ones judged, h3 moved because three levels cannot fit distinguishably
  between 21 and 19. The derivation **enforces** both invariants from the bottom
  up after a sweep measured independent rounding colliding at a body of 16
  (h4 === h5). Residual recorded: h4/h5/h6 are one pixel apart and only
  nominally distinguished **from each other** — what is fixed is "deep headings
  read as diminished or vanish into body text", not "all six levels are visually
  distinct". A **thirteenth headless suite** (27 checks) ships with the change at
  the project owner's direction and was validated against a negative control
  before being trusted; the core 8 suites and their 125 checks are untouched.
  The auto-scroll mechanism and the AF36 ruling itself are recorded separately as
  FINDINGS **AF38** and **AF39**, since neither decided anything.
- 2026-09-02 — appended **AD30** on `feature/release-signing`, opening a
  release-signing milestone and implementing AD24 `D-L`'s delivery half and
  `D-M`. Records the template defect that drives the whole design: Expo points
  the **release** buildType at `signingConfigs.debug`, so an unmodified
  `assembleRelease` **succeeds** and emits an installable **debug-signed**
  "release" APK whose wrongness surfaces only later as an install-time
  signature mismatch — which is why the conventional `exists()`-fallback
  pattern was rejected, since it reproduces exactly that outcome. Option (b),
  an Expo config plugin, is rejected: it buys survival across a regeneration
  nothing in this workflow performs, costs an untested, un-typechecked path
  outside `npm run check` (AD16's reasoning), and fails **silently** if a
  future template restructures `signingConfigs`, whereas (a) fails by being
  deleted, which is obvious. The hard-fail was **specified as a
  configuration-time throw and moved to `gradle.taskGraph.whenReady`**, because
  configuration runs for every task and a throw there would have broken
  `assembleDebug` and `npx expo run:android` on any machine without a keystore.
  "Never a wrong artifact" is recorded as **structural**: a three-level
  fail-safe whose bottom level is `signingConfig null` producing an **unsigned**
  APK that Android refuses to install, so the property does not depend on one
  guard firing. The three prebuild cases are tagged 📐 from this repo's own
  installed CLI — `run:android` skips prebuild entirely when `android/` exists
  (`ensureNativeProject.js`), `--no-clean` reuses it
  (`copyTemplateFiles.js:77-78`), and a bare `prebuild` is **clean by default**
  in SDK 57 (`prebuild/index.js:112`, `clean: !args['--no-clean']`) with the
  dirty-git guard structurally unable to fire because `android/` is gitignored.
  The recovery record is a new tracked **mutable** doc, `RELEASE-SIGNING.md`,
  chosen over an append-only home because a recovery record must state current
  truth; the AD holds rationale, the doc holds the mechanical artifact, and no
  sentence appears in both. `D-M` ships here as `Reading Aid`, sequenced
  **first** because the display name reaches the app only through `strings.xml`,
  which only prebuild generates — so deferring it would have been a second
  destruction event, not a free deferral. Scope of a future green release build
  is stated plainly: `minifyEnabled` is `false` and the property is absent from
  `gradle.properties`, so **R8/Proguard is not exercised**; Hermes release-mode
  bytecode precompilation is the new surface; the artifact is a universal APK
  across four ABIs. **Nothing was executed against Gradle** — the acceptance
  check is pending, in the same shape as AD21/AD22/AD28. The prebuild evidence
  is FINDINGS **AF41**.
- 2026-09-03 — appended **AD31** on `feature/ad31-core-fork`, settling `D-D`
  and, with it, `D-R`. Android **forks** `src/core/`: byte-identity to the web
  repo is abandoned outright, and byte-identity to a **recorded baseline** is
  enforced instead by a new mutable manifest, `CORE-DIVERGENCE.md`, plus
  `scripts/check-core-baseline.mjs` wired into `npm run check` — the two ship
  together because a manifest without a check is what PORT-PLAN.md §5.1
  diagnoses in F-PRESETS-5. Each of the web repo's §5.2 options was re-read for
  the entry: three assume a live web repo, and (d) assumes something to
  reconcile against. **(c) is the subtle one** — AD31 adopts its *mechanism* (a
  small script plus a hash manifest) while rejecting its *purpose* (a two-repo
  comparator), the difference being the oracle, and in doing so disposes of
  (c)'s own objection that byte-comparison is "too strict the moment the port
  legitimately needs a platform-conditional line": under a fork a mismatch is a
  prompt to write a row, not a failure. Why this is **not** §5.2's option (e) is
  stated as four properties (e) lacks — baseline, manifest, CI, answerability —
  because "the distinction is not intent, it is apparatus." **A false premise is
  recorded rather than silently corrected:** the decision was scoped on the
  claim that the freeze had stood for months; measured, web HEAD `15b6ca3` is
  dated **2026-08-31** against today's **2026-09-03** — **three days** — so the
  argument was re-derived from measured facts (two bugs filed against seeded
  core files and unfixed, #110 filed *after* the last web commit; backlog 17 →
  **19**), and treating the freeze as long-lived is labelled a **planning
  judgement, not a measurement**. That is AF37's lesson applied prospectively.
  **The manifest covers twenty-five files, not the fourteen the decision was
  scoped around:** the eight seeded `.mjs` suites are as duplicated by value as
  the sources they bundle and were guarded by nothing (AF14), and three storage
  files were missed — `readingPosition.ts` is *still* byte-identical to web, a
  thirteenth undeclared identity surface. `resumeTarget.ts` and `fingerprint.ts`
  are excluded as derived-not-copied, and Android-original files are excluded
  for signal preservation: "a row updated mechanically is a row nobody read."
  §5.2 (c)'s "only guards files on the manifest" weakness is **closed for
  `src/core/`** by a completeness walk and left open elsewhere, recorded as
  residue. The **`&&` ordering cost is written into the decision**, not just
  the PR: placing the baseline check ahead of `test:all` means a one-line
  manifest staleness suppresses all 310 suite checks — AF17's exact hazard —
  accepted because `build` already sits there under the same `&&` and a moved
  core file is what you want to know first. Reporting form is fixed as **"13
  suites plus 1 baseline check"**, never "14 suites". The script was validated
  against **six negative controls**, all exiting 1, before its green run was
  believed. `D-R`'s cross-repo fix sequence is **retired**: #108 and #110
  become ordinary Android bugs, and #110's bionic pin plus its
  `CORE-DIVERGENCE.md` row will be the fork's first real exercise. No web file
  was modified and no web issue was edited or closed.
- 2026-09-03 — appended **AD32** on `feature/ad32-claude-md-ownership`, opening
  a working-agreement-ownership milestone and **extending AD31 to `CLAUDE.md`**:
  byte-identity to the web repo's copy is abandoned and the file becomes row 26
  of [CORE-DIVERGENCE.md](CORE-DIVERGENCE.md), the manifest's **first diverged
  row**, shipping `Diverged? = y` on day one with its baseline
  (`407d965a…f7f30e8a6`) **verified against the file before editing** rather
  than taken from AD14. The argument is recorded as an extension rather than a
  fresh case: AD31 established the web repo is not a live sync source, so
  holding one file identical to it is **residue from a reversed decision**, and
  the two agreements now describe different repos — this one has a fork
  manifest, a baseline check inside `npm run check` and `RELEASE-SIGNING.md`,
  and the frozen web repo will get none of them. **The concrete trigger:** §4
  called the React Native highlight mechanism "UNDECIDED — do not treat this as
  settled", when AD21 decided it and **AF32 proved it on physical hardware**
  (zero spontaneous React renders across 1339 frames and 66 word advances), so
  the governing document was wrong about the repo's most important
  architectural fact and §2's own fix-one-and-flag rule forbade leaving it.
  Alternatives rejected: deferring the correction to a **nonexistent**
  `ARCHITECTURE.md` (a reader opens CLAUDE.md first), and repeating AD14's
  copy-across, which would spend a freeze exception to preserve the property
  AD31 abandoned and leave web's agreement asserting an Android decision. The
  cost is stated plainly — the two agreements can now drift silently, accepted
  because the manifest catches drift from the **recorded baseline** and drift
  from web is no longer a defect. **The edit is TWO changes, and the second was
  deferred in error and pulled in on the project owner's overrule:** the
  mechanism bullet (settled by AD21, proven by AF32, `setNativeProps` retired
  as unavailable under the New Architecture Expo SDK 55+ mandates) **and** §4's
  line-43 premise, which said the file "carries verbatim between repos" — a
  statement **AD32 itself negates**, one paragraph above the fix. The reusable
  distinction is recorded: a statement your own change negates is part of that
  change; one already false independently of it is not. **The invariant and all
  three guards are left byte-for-byte**, and the F1/F16/PORT-AUDIT §4.5
  back-references are untouched. Three further stale statements are recorded as
  **knowingly left** — §2 naming two documents that do not exist here, §2
  omitting the three mutable companions, and invariant 2's
  virtualization-window prose, which is reserved as invariant text. **AD26 is
  corrected without being edited:** its "zero colour literals under `src/`
  outside this file" is false — `palette-headless-test.mjs:355-356` carries two,
  inside the very check guarding AD26's *other* claim — true when written,
  falsified the same day by AD29's suite, and the fix is to reword the scope,
  never to delete the check. The baseline check needed **no change**, confirmed
  by reading it (root-level paths resolve via `path.join(repoRoot, …)`, the
  completeness walk is `src/core/`-only, and a diverged row is accepted given a
  non-empty `Record`) rather than by trusting a green run. No web file was
  modified and no web issue was edited or closed; `MVP-PLAN.md` needed no
  change.
- 2026-09-03 — appended **AD33** on `docs/ad33-claude-md-doc-list`, closing the
  second of AD32's three recorded residues. CLAUDE.md §2 now names
  **CORE-DIVERGENCE.md** and **RELEASE-SIGNING.md** alongside the original four
  and states which documents are append-only. The omission mattered because §2
  defines what "done" requires updating while leaving out the manifest whose §3
  makes a row update part of the same change — **a contributor following §2
  literally would fail the baseline check inside `npm run check`**. §2 states
  the obligation in its own terms and **cites** §3 rather than restating it
  (AD18). Why it waited is recorded against AD32's boundary rule: a statement
  your own change negates belongs to that change, one already false
  independently of it does not, and this was the second kind. The **other half
  of residue item 2 closed with no action** — §2's `PROJECT_CONTEXT.md` and
  `ARCHITECTURE.md` `@`-references now resolve because both documents were
  written (#20, #21). `MVP-PLAN.md` needed no repointing: **CLAUDE.md never
  named it** 🧪, so its deletion in #21 left nothing dangling. The edit is a
  **pure addition — six lines, zero deletions**, `4bc33797…` → `0382990a…`.
  Row 26 is the first manifest row to diverge **twice**, so its `Record` becomes
  **`AD32, AD33`** — append, never replace — a convention *derived* from
  CORE-DIVERGENCE.md §2's own definition of `Record` as accounting for the row's
  current state, not chosen; a reverting edit needs no new rule. Residue item 3
  (invariant 2's virtualization-window prose) stays reserved as invariant text.
- 2026-09-04 — appended **AD34** on `feature/lint-and-ci`, opening a lint + CI
  milestone. ESLint arrives at **Level 2** (stock `eslint-config-expo` plus
  unused-vars-as-error, `no-explicit-any`, `import/order`, `no-console`,
  `prefer-const`, `eqeqeq`) with **three `files` overrides**, each existing
  because the alternative is editing a manifest-pinned file:
  `src/pacer/usePacer.ts` (row 21) for the seven React Compiler errors, which
  object to the design CLAUDE.md §4 invariant 2 mandates and **AF32**/**AF34**
  proved on hardware — inline `eslint-disable` rejected because it changes the
  file's bytes and would cost a row-21 update to buy what a config rule buys
  free, refactoring rejected because it would spend device evidence that is a
  property of that exact implementation; `**/*.mjs` for `no-console` and
  `import/order`; and `**/*.d.ts` for `no-var`. **Three of this change's stated
  premises were measured false and are corrected in the entry.** The React
  Compiler rules do **not** fire because `app.json` sets
  `experiments.reactCompiler` — `eslint-config-expo` never reads `app.json` —
  they come from `eslint-plugin-react-hooks@7.1.1`'s `configs.recommended`,
  which sets all three to error unconditionally; the two facts are recorded as
  independent, at length, because a log entry asserting a causal chain that
  does not exist is **AF37's** class and is caught by nothing. `no-console`'s
  problem is **not** `epubStructure.ts`, whose two `console.warn` calls
  `allow: ['warn']` silences outright — it is **61** `console.log`/`.error`
  calls in the fourteen `.mjs` files, which are those programs' entire output
  mechanism. And the error count is **8**, not 7: an eighth,
  `types/hermes-globals.d.ts:19`'s `declare var console` (AD4), was absent from
  the scoping. **The `.mjs` gap is narrowed, not closed** — 67 rules stay
  active there (46 error, 21 warn), only the two stylistic ones are off, and
  the entry enumerates them rather than claiming closure. `lint` is
  deliberately **not** chained into `npm run check`: it would put a style gate
  in an `&&` chain with behavioural ones (**AF17**), change what `check`
  reports (AD31's "13 suites plus 1 baseline check"), and cost `check` its
  fresh-clone cheapness (AD10, **AF13**) — so the local pre-push sequence is
  two commands and ARCHITECTURE.md §6 now names it. `"lint": "expo lint"`
  becomes **`"lint": "eslint . --max-warnings 0"`**, because `expo lint`'s
  `DEFAULT_INPUTS = ['src','app','components']` would never lint
  `scripts/check-core-baseline.mjs` — the manifest's own enforcer — and its
  prerequisite **writes `eslint.config.js` and installs packages** when it
  fails 📐. The workflow is **one job, separate steps**, named
  **`static-and-suites`** so a green tick cannot be read as the device coverage
  this repo does not have; **no `paths:` filter**, ever, since a required check
  carrying one leaves unrelated pull requests permanently unmergeable; Node
  pinned to major **26** to reproduce the evidence base (**AF10**, AD27), with
  no claim made about its release-line status. **The workflow has never run** —
  it was parsed locally and nothing more. Three cleanups ride along: `npm ci`
  cleared **201 extraneous** packages (229 top-level entries → 28), the
  untracked gitignored `example/` was deleted, and **fourteen** unreferenced
  tracked assets (**446,089** bytes, measured) were removed. Flagged not fixed:
  `tsconfig.json`'s `exclude` still names the now-absent `example`, one more
  entry in the hand-maintained list **AF8** records. Measurements are
  **AF44**.
- 2026-09-04 — appended **AD35** on `chore/ci-action-majors`, batching two
  follow-ups from reading PR #23's first workflow run. **The action bump is
  deadline-bearing, not housekeeping:** that run was green only because GitHub
  is *forcing* `actions/checkout@v4` and `actions/setup-node@v4` onto Node 24,
  and GitHub's changelog puts a date on the fallback — *"we upgrade the runner
  and remove Node20 on September 23rd, 2026"*, **nineteen days** after this
  entry. Because `static-and-suites` is now the **sole required status check**
  on a protected `main` with **`enforce_admins` enabled**, a workflow that
  breaks that day makes `main` unmergeable **with no admin bypass — including
  for the pull request that would fix it**. Both actions go to **`@v7`**, and
  the entry records `runs.using` **per major** rather than arguing from the
  version number: v4 is `node20` for both, while **v5, v6 AND v7 are all
  `node24`** — so the runtime argument does not discriminate among them and any
  would retire the warning. **v7 is chosen as the current line, not as the only
  safe one** (`releases/latest` → v7.0.1 checkout, v7.0.0 setup-node), since
  depending on a backport policy is weaker than tracking the line fixes land on
  first. It walks into no second deprecation: Node 24's EOL is **2028-04-30**
  and no `node24` deprecation is announced. **`setup-node` behaviour was checked
  by diffing `action.yml` v4 against v7, not by reading release notes** —
  `node-version`'s description is byte-identical so `'26'` resolution is
  untouched, `cache` still supports `npm`, the only removal is the unused
  `always-auth`, and v5's automatic caching cannot fire because it needs a
  `packageManager` field this repo does not have. checkout's changes are inert
  here (v7's fork-PR block applies to `pull_request_target`/`workflow_run`, and
  this workflow uses `pull_request`/`push`). **SHA-pinning is rejected for this
  PR and deferred to its own decision** — it is the stronger supply-chain
  position, but it is a policy for every action this repo will ever add and
  would make per-**major** `runs.using` the wrong evidence for what shipped.
  **Stated plainly: the bump is not verifiable locally at all** — no local
  command executes a runner, so this PR's own CI run is the proof, and unlike
  PR #23's it lands on a protected `main`. **The second half records a position,
  not a change: ESLint STAYS ON 9.** `eslint` dist-tags measured against the
  live registry on 2026-09-04 are `latest: 10.10.0`, `maintenance: 9.39.5`, so
  `^9.39.5` resolved **correctly** to the top of the 9 line and the `npm ci`
  warning is ESLint's **blanket line-support policy, not a defect**.
  `eslint-config-expo@57.0.2`'s `peerDependencies: { eslint: '>=8.10' }` has an
  **open upper bound**, so ESLint 10 is **permitted** — but permitted is not
  tested, and its transitive plugin set (`@typescript-eslint@8.69.0`,
  `eslint-plugin-import@2.32.0`, `eslint-plugin-react-hooks@7.1.1`) has never
  been exercised at 10 here. Moving would **re-open every measurement in AF44** —
  the eight-error baseline, the 82-problem count, and above all the **67 rules
  active on a `.mjs` file** — all of which are properties of *this* resolved
  plugin set, for no present benefit. So the warning is **EXPECTED on every
  clean install and must not be silenced**, and `"eslint": "^9.39.5"`'s caret is
  load-bearing rather than incidental; a revisit trigger is recorded so this is
  a position and not an omission. **One doc fix rides along and one is flagged:**
  ARCHITECTURE.md §6's "That workflow has never executed" is a statement **this
  change negates**, so it is corrected here to cite AF45 (AD32's boundary rule);
  README.md's stale `AD1`–`AD32` / `AF1`–`AF43` ranges were **already false
  before this change**, so they are flagged and left. No file in
  CORE-DIVERGENCE.md's twenty-six rows changed, nothing under `src/` changed,
  and `package.json`, `package-lock.json` and `eslint.config.js` are untouched.
  Measurements are **AF45**.
