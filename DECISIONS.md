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
