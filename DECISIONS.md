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
