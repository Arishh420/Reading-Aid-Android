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

## Change log
- Created 2026-08-31, alongside [FINDINGS.md](FINDINGS.md), to make CLAUDE.md
  §2 satisfiable for this repo (PROJECT_CONTEXT.md and ARCHITECTURE.md are
  deliberately out of scope for now — too little exists here yet to document
  structure or scope without speculating). Seeded with AD1–AD6, backfilling
  decisions already made in commits `1cd60e2` and `ce3d2ed`/PR #1 that had
  gone unrecorded.
