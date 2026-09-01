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
