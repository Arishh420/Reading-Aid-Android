# ARCHITECTURE.md — structure, data flow, and the portable-vs-web split

> **Purpose.** What the code is shaped like, how a document travels through it,
> and which parts are load-bearing. Written for a developer receiving this repo
> cold — no history, no access to the web repo, no conversation to fall back on.
> This is the document [CLAUDE.md](CLAUDE.md) §2 names for "structure, data
> flow, portable-vs-web split".
>
> **This file is MUTABLE**, unlike its append-only neighbours
> [DECISIONS.md](DECISIONS.md) and [FINDINGS.md](FINDINGS.md). It is rewritten
> in place to describe the code as it now is, so if it disagrees with the code,
> **the code wins and this file is stale** — fix one and flag the drift
> (CLAUDE.md §2). Its mutable companions are
> [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) (scope),
> [CORE-DIVERGENCE.md](CORE-DIVERGENCE.md) and
> [RELEASE-SIGNING.md](RELEASE-SIGNING.md).
>
> **What this file is NOT: it is not a decision log.** Every choice described
> here was argued somewhere else, and the argument is **not repeated** — an
> `AD` reference is a pointer to the reasoning, not a summary of it (AD18's
> anti-duplication rule). Read `DECISIONS.md` for *why*, `FINDINGS.md` for
> *what was measured*, and this file for *what the code does*.
>
> **Verification legend** — the same one `FINDINGS.md` uses, because this file
> makes claims of the same kinds:
>
> - 🧪 **Measured** — a command was run in this repo and its output observed.
> - 📐 **Structural** — follows from reading the repo's own files.
> - 👁 **Observed** — seen working on a real device or emulator **by the project
>   owner** and reported. Not reproducible from a clone; see §6.
> - ❓ **Unverified** — believed, but not exercised here.
>
> Claims about **device or Hermes behaviour carry an `AF` citation or a ❓**.
> There is no third option: nothing in this repo can run an emulator.

---

## 1. The tree, and what actually enforces each boundary

Six directories under `src/`. The layout is not decorative — three of the six
boundaries are enforced by a mechanism, and the rest are conventions that a
reviewer has to hold.

| Directory | Holds | Must not hold | What enforces it |
|---|---|---|---|
| `src/core/` | Pure, portable logic: the document model, tokenizer, Markdown parser, dwell table, bionic split, ORP, PDF/EPUB text extraction, theme ids, the sample document. Plus the eight seeded headless suites. | Anything touching React, React Native, the DOM, Node, or a native module. | **`tsconfig.core.json`** typechecks it in isolation. Partly enforced — see below for exactly which half. Also **baseline-pinned**: every file is a row in [CORE-DIVERGENCE.md](CORE-DIVERGENCE.md) and a completeness walk fails on any file not listed (§5). |
| `src/pacer/` | The clock: `usePacer.ts`, a React hook, and its suite. | Rendering, layout, colours. | Convention. It imports `react` and names the `React` type namespace, so it *cannot* live in core (below). |
| `src/reader/` | The rendering surface: `ReaderSurface.tsx`, `WordBox.tsx`, the pure `prepareDocument.ts`, the `palette.ts` visual constants, and three suites. | The clock, storage, screen wiring, any `useState` on the index. | Convention, plus one measured property: there is **no `useState` anywhere in `src/reader/`** 🧪 (grep, this session — the only textual hit is a comment in `ReaderSurface.tsx:17`). |
| `src/storage/` | Persistence: the MMKV wrapper, the reading-position record, the resume-target resolver, the content fingerprint, one suite. | Anything about rendering or pacing. | Convention. `storage.ts` is the **only** file that touches the native store, deliberately, so a stub can replace it in Node (§6). |
| `src/app/` | Routes. `_layout.tsx` (a single `Stack`) and `index.tsx`, the reader screen and the app's only screen (AD24 `D-J`). | Reusable logic. It is the wiring layer: it owns the clock, the WPM state and the save timer, and hands the surface a document and a shared value. | `expo-router` file-based routing — `package.json`'s `"main"` is `expo-router/entry` 📐, so files here *are* the routes. |
| `types/` | `hermes-globals.d.ts` — a five-method ambient `console` for the core guard (AD4). | Anything else. | The main `tsconfig.json` **excludes** it (`exclude` entry `${configDir}/types/hermes-globals.d.ts` 📐) so it cannot collide with `lib.dom`'s own `console`; `tsconfig.core.json` explicitly **includes** it. |

### 1.1 The core guard: two gates, two different purposes

`tsconfig.core.json` is the portability guard, and it is standalone on purpose.
Its own comment is the clearest statement of intent in the repo, so it is
quoted rather than paraphrased:

```
// Standalone on purpose: it does NOT extend expo/tsconfig.base, because that
// base sets `lib: ["DOM", "ESNext"]` and this config exists precisely to
// typecheck src/core/ WITHOUT DOM. Inheriting and then overriding `lib` would
// work, but it would also silently inherit any future DOM-ward change to the
// base. Everything relevant is restated explicitly below.
```

and, separately, on the other gate:

```
// No ambient @types packages. @types/node is present in this tree
// (transitively) and would supply Buffer/process/setImmediate — Node
// globals that Hermes does not provide. Empty means core/ gets nothing it
// has not earned.
```

Those are **two gates with two jobs**, and conflating them is the easy mistake:

- **`lib: ["ES2022"]`** is the **DOM** gate. No `lib.dom`, so no `document`,
  `window` or `navigator` type exists to reference.
- **`"types": []`** is the **ambient-globals** gate. It suppresses automatic
  `@types` inclusion, so `process`, `Buffer` and the global `React` namespace
  are all absent — even though those packages sit in `node_modules`.

**Measured, gate by gate** 🧪. Each was established with a **single-purpose
probe** compiled under the *real* `compilerOptions` — mirrored into a scratch
project with a `node_modules` symlink, so nothing was written into this tree —
one feature per file, so the reported error code names its own gate. **Re-run
it the same way if you tighten or loosen the guard**; the answer below is less
useful than the method.

| Probe | Result | Which gate |
|---|---|---|
| `document.querySelector('x')` | **TS2584** — *"Try changing the `lib` compiler option to include `dom`"* | `lib` |
| `process.env` / `Buffer.from` | **TS2591** — *"add `node` to the `types` field"* | `types` |
| `React.MutableRefObject<number>` | **TS2503** — *"Cannot find namespace `React`"* | `types` |
| `console.warn(...)` **without** `hermes-globals.d.ts` | **TS2584** | `lib` |
| `console.warn(...)` **with** it, as the real config has it | **exit 0** | `types/hermes-globals.d.ts` |
| **`import { useRef } from 'react'`** | **no error** | **nothing** |

### 1.2 The unguarded gap, named plainly

**The guard does not make `src/core/` React-free. An explicit
`import … from 'react'` typechecks cleanly under it** 🧪 — `"types": []`
suppresses *ambient* type packages, and an explicit module import is not
ambient. So:

- **DOM-freedom is enforced** by the compiler, via `lib`.
- **Node-globals-freedom is enforced** by the compiler, via `types`.
- **React-freedom is NOT enforced by the compiler.** It is held by convention
  and code review.

The property is nonetheless true today, and measurably so: **`src/core/` has
zero external imports** — every import in every core `.ts` file is relative and
resolves inside core — and the string `react` appears nowhere under
`src/core/` at all 🧪 (both swept this session). Six files import nothing
whatsoever. If you add a core module, nothing will stop you importing `react`
into it; **that is the gap, and reviewing for it is the mitigation.**

### 1.3 Why the clock is not in core

`src/pacer/usePacer.ts` is pure scheduling logic with no DOM use, which makes
"move it into core" a natural-looking suggestion. It cannot go there, and the
blocker is not the `react` import — per §1.2, that would pass. It is
`usePacer.ts:49`, which names the **global** `React` type namespace:

```ts
indexRef: React.MutableRefObject<number>;
```

Under `"types": []` that is **TS2503** 🧪 (row three above), so the file would
fail the guard on its *types* alone. AD22 says exactly this and it is confirmed
here: `usePacer.ts` genuinely cannot become a thirteenth seeded core file. It
lives in `src/pacer/` and is a manifest row instead (§5). AD22 and AD25 hold
the reasoning, including the four-line diff its port carries.

### 1.4 What the app actually depends on

Only five external packages are imported anywhere in `src/` 🧪:
`react`, `react-native`, `react-native-reanimated`, `react-native-mmkv`, and
`expo-router`. `app.json` additionally enables `experiments.reactCompiler` and
`typedRoutes` 📐. React Compiler cannot affect the hot path, because that path
does not go through React at all (§4).

---

## 2. Data flow, end to end

Two paths run off the same source string: the **reading path**, which ends on
the UI thread, and the **persistence path**, which deliberately never touches
the clock's seam. Both are traced hop by hop, with the function to open at
each.

### 2.1 The reading path

| # | Hop | Where |
|---|---|---|
| 1 | A source string enters — the seeded sample, or pasted text. There is no file picker (AD24 `D-H`). | `src/app/index.tsx:93` `useState(SAMPLE_MARKDOWN)`; `src/core/ui/sample.ts` |
| 2 | String → ordered raw blocks (headings and paragraphs; lists flatten to paragraphs, rules and fences handled). | `src/core/parsers/markdown.ts:109` `blockify` |
| 3 | Each block's text → `Word[]`. A token is word-like if it contains a letter or number; attached punctuation stays on the token. | `src/core/model/tokenize.ts` `tokenize`, called at `markdown.ts:246` |
| 4 | **The flat index is assigned LAST**, across all blocks in reading order: `id: String(next++)`. This is CLAUDE.md invariant 1 being established, and it is the final act of parsing. | `src/core/model/tokenize.ts:102` `reindexWords`, called at `markdown.ts:249` |
| 5 | Document → the flat reading-order spine the clock walks and seeks within. | `src/core/model/tokenize.ts:93` `flattenWords`, at `index.tsx:102` |
| 6 | Document → one dwell multiplier per flat index (clause 1.75×, sentence 2.5×, block-end 3×), written as `result[Number(w.id)]`. | `src/core/pacer/dwell.ts:64` `buildDwellMultipliers`, at `index.tsx:109` |
| 7 | The clock is constructed. `naturalPauses: true` is passed **explicitly**, because the hook's own option defaults to `false` (`usePacer.ts:83-84`) and relying on the default would silently ship them off (AD23). | `src/app/index.tsx:114` `usePacer(words, wpm, { dwell, naturalPauses: true })` |
| 8 | On each frame, a time accumulator crosses `msPerWord × chunkSize × dwell` and the next word-like token is selected. Backlog is capped at one step, so a slow frame cannot make the highlight jump. | `src/pacer/usePacer.ts:126` `tick`; `:144` `dwellMultiplier`; `:148` `firstWordlikeFrom` |
| 9 | **The integer seam.** The index is written to a ref and broadcast to subscribers as a plain number. This is CLAUDE.md §4 guard 1, and nothing but an integer crosses it. | `src/pacer/usePacer.ts:111` `commit` — `indexRef.current = next`, then `listenersRef.current.forEach((cb) => cb(next))` |
| 10 | The screen's subscriber writes that integer into a Reanimated shared value. **Its entire body is one assignment.** | `src/app/index.tsx:120-125` |
| 11 | The surface receives the shared value as its only clock input. It owns no state and no clock. | `src/reader/ReaderSurface.tsx:168`, prop `currentIndex: SharedValue<number>` |
| 12 | Document → render-ready data, **once per document**: `splitBionic` per word, and `Number(w.id)` → `index`. This is the whole of the per-word computation. | `src/reader/prepareDocument.ts:64` `prepareDocument`; the conversion at `:72` |
| 13 | **The worklet.** One integer comparison per word box, on the UI thread. | `src/reader/WordBox.tsx:87-89` — `currentIndex.value === index ? HIGHLIGHT_BG : HIGHLIGHT_NONE` |
| 14 | Auto-scroll reacts to the *same* shared value and scrolls only when the active word's absolute Y differs from the Y last scrolled for. Runs on the UI thread. | `src/reader/ReaderSurface.tsx:242` `useAnimatedReaction`; `:255` `scrollTo` |
| 15 | The Y map feeding hop 14: each word reports **only** its block-relative Y, each block **only** its own Y; absolute Y = block Y + word Y. Rebuilds are coalesced behind one `setTimeout(0)` because mounting fires an event per word *and* per block, and rebuilding per event would be quadratic. | `WordBox.tsx:92` → `ReaderSurface.tsx:233` `onMeasureWordY` / `:223` `onMeasureBlockY` → `:205` `publish`; keyed by `prepareDocument.ts:91` `buildWordBlockMap` |
| — | **The tap branch rejoins at hop 9.** A tap seeks and never changes transport state (AD28). | `WordBox.tsx:98` `handlePress` → `index.tsx:269` `onSeekWord={pacer.seek}` → `usePacer.ts:212` `seek` → `nearestWordlike` → `commit` |

Two properties of that trace are worth stating outright. **`ReaderSurface` is
unaware a pacer exists** — it takes `{ doc, currentIndex }`, which is what makes
it independently composable. And **hop 9 to hop 13 involves no React at all**:
see §4.

### 2.2 The persistence path

Parallel to the above, and deliberately kept off the seam — its subscriber does
no I/O, it only marks a ref dirty.

| # | Hop | Where |
|---|---|---|
| 1 | Source string → book identity. The MVP has no `File`, so the fingerprint is taken over the string's UTF-8 bytes: full SHA-256 at ≤96 KB, else SHA-256 of `[first 32 KB | middle 32 KB | last 32 KB | size as 8-byte big-endian]`. Both the encoder and the digest are self-contained, because React Native ships neither `TextEncoder` nor `crypto.subtle` (AD27). | `src/app/index.tsx:112` `fingerprintText` → `src/storage/fingerprint.ts:258`, `:230` `fingerprintBytes`, `:58` `utf8Encode`, `:121` `sha256Hex` |
| 2 | A **second** subscriber records the latest index and sets a dirty flag. No storage call happens here. | `src/app/index.tsx:132-138` |
| 3 | A 2 s timer flushes when dirty; so does pausing, unmounting, and switching documents. The short interval is because Android can kill the process with no JS callback. | `src/app/index.tsx:140` `flushPosition`, `:147-158`; `SAVE_INTERVAL_MS` at `:83` |
| 4 | Record written: `latest` always, plus a `history` entry only when the position moved >2 %, capped at 5. | `src/storage/readingPosition.ts:64` `saveReadingPosition` |
| 5 | Persisted through the one file that touches the native store — namespaced `readingaid_v1:`, MMKV created lazily inside the accessors, every call in `try/catch` so a storage failure degrades to "no saved position". | `src/storage/storage.ts:59` `storageSet` → `:42` `backing()` → `createMMKV()`; key `pos:{fingerprint}` |
| 6 | On mount, once per fingerprint: load the record, resolve a target, seek. If the word count drifted since the save, the saved **percent** is authoritative rather than the raw index — and drift is judged against the *snapshot's* own count, not the record's. | `src/app/index.tsx:172-180` → `loadBookRecord` → `src/storage/resumeTarget.ts:40` `resolveResumeTarget` → `pacer.seek(target)` |

**Hop 6's ordering is load-bearing and correct by construction.** `usePacer`
has its own `[words]` effect that resets the index to the first word-like token
(`usePacer.ts:182-187`). Hook effects are registered during the component's
render and therefore run **before** the component's own effects, so the restore
seek always lands *after* that reset rather than being overwritten by it. The
restore is also guarded by a ref rather than by effect dependencies, because the
`pacer` object's identity changes when `playing` or `atEnd` flips — without the
guard, pressing Play would re-run the restore and yank the reader backwards
mid-sentence (`index.tsx:171-174`).

---

## 3. The two invariants, and what breaks if you violate them

[CLAUDE.md](CLAUDE.md) §4 states both invariants, states the settled mechanism,
and states the three guards. **They are not restated here.** What §4 does not
give you is the blast radius in *this* codebase — which files depend on each
invariant, and how a violation would present. A developer who knows a rule but
not its blast radius will break it.

### 3.1 Invariant 1 — `Word.id` === flat word index

`reindexWords` establishes it and `parseMarkdown` calls it **last**
(`markdown.ts:249`). Seven code sites then depend on it 🧪 — the full set, from
a sweep of every conversion and every index-by-flat-id in `src/`:

| # | Site | Depends how |
|---|---|---|
| 1 | `src/core/model/tokenize.ts:106` | **Produces** it: `id: String(next++)` |
| 2 | `src/core/pacer/dwell.ts:73` | Writes `result[Number(w.id)] = trailingDwell(...)` |
| 3 | `src/core/pacer/dwell.ts:77` | Writes `result[Number(w.id)] = DWELL_PARAGRAPH` |
| 4 | `src/core/pacer/dwell.ts:84` | Writes `result[Number(w.id)] = dwell` |
| 5 | `src/reader/prepareDocument.ts:72` | Converts once: `index: Number(w.id)` |
| 6 | `src/reader/prepareDocument.ts:94` | Keys the auto-scroll block map: `map[w.index] = blockIndex` |
| 7 | `src/reader/WordBox.tsx:88` | Compares it on the UI thread: `currentIndex.value === index` |

**The crossover is the part to understand.** The clock does not work in
`Word.id` at all — it works in **array positions** of the flattened `words`
list: `firstWordlikeFrom`, `nearestWordlike` and `indexRef` are all positions in
that array. Everything downstream keys off `Number(Word.id)`. The two are the
same number **only because `reindexWords` guarantees it**. The clearest
instance: `dwell` is *written* at `Number(w.id)` (sites 2–4) and *read* at
`dwell?.[index]` where `index` came from `firstWordlikeFrom` — an array position
(`usePacer.ts:144` → `dwell.ts:44`). Break the invariant and those are two
different indexing schemes wearing the same name.

**Every failure mode is silent.** Nothing throws:

- **The highlight** lands on the wrong word, or on no word. A related trap has
  the same signature: `Word.id` is a **string** (`types.ts:16`), the shared
  value is a number, and `number === string` is always `false` in JavaScript —
  so passing `word.id` where `word.index` belongs makes the highlight simply
  never appear.
- **Pacing** reads the wrong dwell multiplier: pauses land on the wrong words.
- **Auto-scroll** reads `wordAbsY[index]` and gets a wrong Y, or the `-1`
  sentinel, which no-ops — the highlight quietly stops being followed.
- **Two independent word counts silently disagree.** `countWords`
  (`prepareDocument.ts:100`) returns *highest index + 1* and sizes the Y array
  (`ReaderSurface.tsx:210`), while the saved position uses `words.length`
  (`index.tsx:143`). They are equal only under this invariant, and a mismatch
  corrupts either scrolling or the resume percentage.

**What guards it:** `src/reader/prepareDocument-headless-test.mjs` (35 checks)
exists for exactly this, and says so in its own docblock — it pins the
conversion because a regression there "would render a plausible-looking document
that paces or spaces wrongly, with nothing throwing". That is the only automated
guard on the invariant.

**One thing to know before reading §4 of CLAUDE.md literally.** Invariant 1's
parenthetical describes a **binary search over a non-decreasing array** — that
search is `blockIndexForWord` in `src/core/model/blocks.ts`, and **nothing in
this repo calls it: `blocks.ts` has no importer at all, including no suite** 🧪
(§7). So the specific mechanism §4 warns about is currently **latent**, and the
live dependency is the seven sites above. The rule is still exactly right — the
module is seeded and will be used again — but do not go looking for the binary
search on the shipped path.

### 3.2 Invariant 2 — no document re-render on the per-pacer-tick path

The mechanism is settled (AD21) and proven on physical hardware (AF32); §4
carries both. What breaks here if it is violated:

- **Putting the index in React state** re-renders every word box on every tick.
  At the seeded sample's 176 words that may look survivable on a fast phone; at
  book length it is the exact cliff CLAUDE.md guard 2 names. This is the most
  likely well-meaning change to be made ("just use `useState`, it's fast
  enough").
- **Animating a nested `Text`** does not work at all. The animated node must be
  the **box**; static nested text inside it is fine and is what bionic uses
  (`WordBox.tsx:115-123`). AD21 records why.
- **Scrolling from a viewability or scroll callback** fights the user. Guard 3
  holds here **structurally rather than by discipline**: a grep across all of
  `src/` for `onViewableItemsChanged`, `viewabilityConfig`, `onRangeChange`,
  `onScroll`, `onMomentumScroll`, `onContentSizeChange` and
  `useScrollViewOffset` returns **nothing** 🧪 (this session). There is no such
  callback to violate — the only input that can cause a scroll is
  `currentIndex`. Adding one of those handlers is how you would introduce the
  hazard.

---

## 4. The per-tick hot path, traced

This is what the whole architecture is arranged around. On one pacer tick:

**What executes**

1. `tick` (`usePacer.ts:126`) — accumulator arithmetic, a `firstWordlikeFrom`
   scan, one dwell lookup. Plain JS on the JS thread.
2. `commit` (`:111`) — one ref write, one `firstWordlikeFrom` end check, and a
   `forEach` over the listener set.
3. Two subscribers, both cheap by design: one assignment into the shared value
   (`index.tsx:122-124`), and one ref write plus a dirty flag
   (`index.tsx:134-137`).
4. Per word box, on the **UI thread**: one integer comparison inside
   `useAnimatedStyle` (`WordBox.tsx:88`).
5. `useAnimatedReaction` (`ReaderSurface.tsx:242`) — an array lookup and a
   compare; `scrollTo` only when the Y actually changed.

**What does NOT execute**

- No React render, reconciliation or diff.
- No `prepareDocument`, no `splitBionic`, no `Number(...)` parse — all of that
  happened once, per document, behind `useMemo` (`ReaderSurface.tsx:177-184`).
- No layout measurement, no storage write, no JSON serialisation.
- Nothing crosses the seam but an integer (guard 1).

**The React-state exceptions, stated precisely.** There are **two** setters
reachable from a tick, and both live in the end-of-document branch: the `atEnd`
flip in `commit` (`usePacer.ts:114-117`, guarded by
`ended !== atEndRef.current`) and the terminal `setPlaying(false)` alongside it
(`:151-155`). **Each fires once per end-of-document crossing and never on an
ordinary advance.** That is not a violation of invariant 2: the invariant is
about the *per-tick* path, and these fire on a state transition a human can
observe — the transport switching to `Restart`. A tap onto or off the last
word-like token costs one render for the same reason (AD28), which is why
"zero renders" is not claimed anywhere.

**What you must never do on this path**

- **Do not put the current index into React state**, or into a prop, or into
  context. It is a ref plus a shared value (guards 1 and 2).
- **Do not widen the seam.** `subscribe` is `(index: number) => void`. No
  element, rect, style object or word object may cross it.
- **Do not do work in the worklet.** It compares two numbers. Do not parse a
  string there, do not read `word`, do not call into JS.
- **Do not add an `onScroll`-family callback that scrolls** (§3.2).
- **Do not move per-document computation into a component body or a tick.** It
  belongs in `prepareDocument`, which is pure and React-free precisely so it is
  obvious that nothing in it can run per tick.
- **Do not add I/O to a pacer subscriber.** The persistence subscriber marks a
  ref; the timer does the writing.

---

## 5. The fork — and the web repo you were not given

`src/core/` is a **fork** of twelve modules (plus eight suites) that originated
in a separate web project, the Reading Aid Tool. AD31 settles that fork and
AD32 extends it to `CLAUDE.md`. The consequence, stated plainly because a
client will otherwise assume a dependency they cannot satisfy:

> **There is no live dependency on the web repo. No sync, no submodule, no
> shared package, no network call. The web repo is NOT required to build, test,
> run, or ship this one, and it is not consulted by any script here.**

What replaces it is a **recorded baseline**:

- [CORE-DIVERGENCE.md](CORE-DIVERGENCE.md) is the manifest — **26 rows**, each
  with the path, its origin, its `Baseline sha256` (the hash at the fork point,
  never edited), its `Current sha256`, a `Diverged?` flag, and a `Record`
  pointing at the `AD`/`AF` entry that explains any divergence. It carries **no
  web hashes**: byte-identity to web is not maintained and not recoverable from
  there.
- `scripts/check-core-baseline.mjs` enforces it, inside `npm run check`. It
  checks three things: every row's file hashes to its `Current sha256`; the
  manifest is self-consistent (baseline == current ⇒ `n`; baseline != current ⇒
  `y` **and** a non-empty `Record`); and **completeness for `src/core/`** —
  every file on disk under that directory must appear in the manifest, so a new
  core module cannot be added silently. Outside `src/core/` the manifest is
  opt-in, which AD31 records as known residue.
- It is pure Node — `node:crypto`, `node:fs/promises`, `node:path`, `node:url`
  — with no esbuild and no dependencies.

**If you change a listed file, do this in the SAME pull request** (the
manifest's §3 procedure, in short): update that row's `Current sha256`
(`shasum -a 256 <path>`), flip `Diverged?` to `y`, and put an `AD`/`AF` entry in
`Record` — writing that entry if it does not exist. Never one without the other,
never in a follow-up. **A red baseline check is not a bug report**: under a fork
divergence is expected, and the fix is almost always "write the row", not
"revert the edit". `Baseline sha256` is never edited; a file that diverges and
is then reverted goes back to `n` with `Current` equal to `Baseline` again.

Two consequences of the fork that are easy to trip over:

- **Files here are Android-owned. Edit them.** Historic comments inside seeded
  modules still refer to web paths, web issue numbers and `§` sections of a
  spec that is not in this repo — `D#`/`F#` identifiers and any
  `PORT-PLAN.md`/`PORT-AUDIT.md` reference are **back-references for someone
  who has that repo, not live pointers**. Local identifiers are `AD#` and
  `AF#`.
- **The count is "13 suites plus 1 baseline check", never "14 suites."** The
  baseline check executes nothing and asserts nothing about behaviour; folding
  it into the suite tally would change what that number means. AD31 records why
  the distinction is kept.

`ARCHITECTURE.md` — this file — is **not** manifest-listed. It is
Android-original, so there is no baseline that would mean anything, and the
completeness walk covers `src/core/` only.

---

## 6. What has no automated coverage — read this before you trust a green check

`npm run check` runs `tsc --noEmit`, then the core portability guard, then the
baseline check, then **13 headless suites totalling 310 checks** 🧪:

| | Suites | Checks |
|---|---|---|
| `test:core` — `src/core/` | 8 | 125 (17 + 18 + 14 + 9 + 15 + 14 + 12 + 26) |
| `test:local` — everything else | 5 | 185 (20 + 73 + 27 + 35 + 30) |

Every suite esbuild-bundles **real source** and asserts what it computes, which
is what makes them worth having. But they are **Node-only by construction**:
they `import node:assert/strict`, `node:path`, `node:url` and use `esbuild` as a
library, so they cannot run on a device (AD24 `D-N`). That boundary decides what
they can and cannot see.

**A green `npm run check` says nothing whatsoever about any of the following.**
Each was established by a person holding a phone, and **none of it is
reproducible from a clone**:

| Mechanism | Evidence | Surface |
|---|---|---|
| The highlight advances with **zero** spontaneous React renders | **AF32** — 1339 frames / 66 advances across two runs, render counter frozen, moving by exactly one per negative-control tap | **Physical device** 👁 |
| The same, over a longer run | **AF43** — 3557 frames / 179 ticks, one tap, one render | **Emulator** 👁 |
| `\p{L}` in `bionic.ts` runs under device Hermes; the five-way split table matched | **AF33** | Emulator (level C); device (parse + visible bolding) 👁 |
| `requestAnimationFrame`'s timestamp and `performance.now()` share a time base, so the ported clock needed no patch | **AF34** — −0.12 / −0.13 ms device, −0.07 ms emulator (a **negative** result) | **Physical device** + emulator 👁 |
| Emulator and device frame timing are **not** interchangeable | **AF35** | Both 👁 |
| Auto-scroll follows the active line; resume, Restart, paste and WPM work | **AF38**, **AF39** | Device + emulator 👁 |
| A drag starting on a word scrolls rather than seeking; end-of-document tap behaviour | **AF40** — four named checks, both surfaces, **pass/fail only, no per-check transcript** | Device + emulator 👁 |
| Release-mode Hermes bytecode runs at all — **the only release-mode evidence this repo holds** | **AF42** — release-signed APK, installed manually, no laptop attached | **Physical device** 👁 |
| The reader's visual layout is acceptable | **AF39** — a **qualitative** judgement, no metrics | Device + emulator 👁 |

Earlier device evidence (`console` under Hermes, `markdown.ts`/`tokenize.ts`
on-device, the `Word.id` invariant observed on hardware) is **AF27**–**AF31**.

### 6.1 "I checked it on the emulator" is documented here as producing false alarms

**AF35 is the finding that governs how every performance observation in this
repo must be read.** Measured: the physical device ran essentially locked
60 fps — means of **16.62 ms** and **16.82 ms**, maxima of **31.03** and
**33.98** (about one dropped frame). The emulator, on the same project, produced
a mean of **19.93 ms** and a maximum of **120.82 ms** — roughly **seven** frames
at 60 fps, a stall nothing like which appeared on hardware.

So: **device figures are the operative ones for every frame-timing claim, and
emulator figures must be reported separately and never merged into a range.**
The asymmetry has a direction worth knowing — the emulator is *pessimistic*
here, so it raises false alarms but is unlikely to hide a real device stall.
Concretely, AD24 `D-G`'s revisit trigger for virtualization ("the first document
that visibly stutters on scroll, or takes more than a moment to mount") **must
be evaluated on hardware**; an emulator stall would trip it for the wrong
reason.

**A developer who changes the highlight mechanism, sees a green check, and ships
has re-proven nothing.** The suites cannot execute a worklet, a shared value, a
`ScrollView` or a native view. Re-run the device probes.

### 6.2 Files with no automated coverage at all

- **`src/reader/ReaderSurface.tsx`** and **`src/reader/WordBox.tsx`** — no suite
  bundles either; they import `react-native` and `react-native-reanimated`,
  which Node cannot provide. Auto-scroll in particular is pure UI-thread
  behaviour with nothing a Node suite could assert; **AF38** is its only
  record, and it names two residuals left unfixed (a seek to a word on a line
  that was manually scrolled away fires no scroll; `lastScrolledY` is not reset
  when the document changes).
- **`src/app/index.tsx`** and **`_layout.tsx`** — the wiring, the save timer and
  the restore ordering are untested by anything automated.
- **`usePacer`'s hook and its rAF clock.** Its suite covers **only** the three
  pure helpers (`firstWordlikeFrom`, `lastWordlikeUpTo`, `nearestWordlike`) and
  says so in its own docblock — the hook needs a React renderer,
  `requestAnimationFrame` and `performance.now()`, none of which the harness
  has. The clock's only evidence is **AF34**, on hardware.
- **The real MMKV path.** `src/storage/headless-test.mjs` stubs
  `react-native-mmkv` through an esbuild resolve plugin, so `readingPosition.ts`
  and `fingerprint.ts` are genuinely exercised but `storage.ts`'s native calls
  are not. That the wrapper works against real MMKV is covered only by the
  device runs in **AF38**/**AF42** (position survived a full app close) 👁.
- **`src/core/model/blocks.ts`** — no importer and no suite (§7).
- **`src/core/ui/theme.ts`** — no suite bundles it.
- **Rotation and system font-scale changes.** Every Y in the auto-scroll map
  comes from an `onLayout` at mount, and neither reflow has ever been exercised
  (**AF38**, **AF40**) ❓.
- **R8/Proguard.** `minifyEnabled` is `false` — it derives from
  `android.enableMinifyInReleaseBuilds`, which is absent from
  `android/gradle.properties` 📐 — so minification **has never run**. **AF42**
  closes the Hermes half of that gap and explicitly leaves this half open.
- **Three of the four shipped ABIs.** The release APK is universal across
  `armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64` and exactly one was exercised
  (**AF42**).

---

## 7. Deliberate omissions — why the code looks unfinished in specific places

The MVP was scoped hard, and several of these are the reason a given file looks
odd. None is a bug. **The full scope story belongs in `PROJECT_CONTEXT.md`,
which does not exist yet** — it is the next document to be written, and this is
the only forward reference in this file.

- **No virtualization.** A `ScrollView` with one `flexWrap` `View` per block and
  one native view per word (AD24 `D-G`). Every word in the document is mounted.
  This is why word count matters, why §6.1's trigger exists, and why the
  measured-rect highlight overlay and the container-level tap hit-test were both
  deferred to the same revisit (AD21, AD28).
- **No file picker.** The seeded sample plus a paste box, both reaching the same
  parser (AD24 `D-H`). `expo-document-picker` and `expo-file-system` are not
  installed 📐. This is also why the fingerprint takes a *string* rather than a
  `File` (AD27).
- **One theme, one mode, one setting.** `light` only; Flowing Highlight only;
  WPM is the only user control, with bionic and natural pauses always on and not
  switchable (AD19, AD23). The reader's colours are hand-copied into
  `src/reader/palette.ts` because `theme.ts` holds no colour values (AD26), and
  the heading scale there is derived from the live body size and self-enforcing
  (AD29).
- **Markdown only.** PDF and EPUB are cut, though their pure text-extraction
  halves remain seeded and tested (AD20).
- **One screen** (AD24 `D-J`), because with no picker there is nothing for a
  second screen to do.

### 7.1 Six seeded core modules the app never reaches — tested future scope, not dead code

The app imports **exactly six** modules from `src/core/` 🧪: `model/types.ts`,
`model/tokenize.ts`, `pacer/dwell.ts`, `parsers/markdown.ts`,
`reader/bionic.ts`, `ui/sample.ts`. The other six are unreachable from the
running app — and **five of them are gated by a specific decision and covered by
suites that run on every `npm run check`.** Do not delete them, and do not read
them as abandoned:

| Module | What gates it | Suite coverage |
|---|---|---|
| `pacer/orp.ts` | **AD19** cut RSVP; ORP anchoring exists only for that mode | `orp-headless-test.mjs` (14) + `delimiterSpans-headless-test.mjs` (18) |
| `model/delimiterSpans.ts` | **AD19** cut RSVP. Its own docblock opens *"Per-word delimiter-span state for RSVP"* 📐 and it feeds the RSVP renderer around `splitOrp` | the same two suites |
| `parsers/pdfText.ts` | **AD20** cut PDF | `pdfText-headless-test.mjs` (14) + `spine-integrity` (26) |
| `parsers/epubStructure.ts` | **AD20** cut EPUB | `epubStructure-headless-test.mjs` (12) + `spine-integrity` (26) |
| `ui/theme.ts` | **AD19** ships one theme; all four ids are already declared here | **none** — no suite bundles it 🧪 |
| `model/blocks.ts` | **Nothing gates it** — see below | **none**, and no importer either 🧪 |

Five suites (18 + 14 + 14 + 12 + 26 = **84** of the 310 checks) bundle modules
the app never reaches, `spine-integrity` spanning both categories.

**`model/blocks.ts` is the exception and is worth calling out honestly.** It is
the one seeded module with **neither a consumer nor a test anywhere in `src/`**
🧪 — no app import, and no suite bundles it. Nor is it gated by a scope decision
the way the other five are: its own docblock names its only intended consumer as
"the RSVP context strip", which AD19's cut removes, but unlike
`delimiterSpans.ts` it is a **general-purpose** flat-index→block lookup rather
than an RSVP-specific one, and the shipped reader solved that same problem
independently with `buildWordBlockMap` (`prepareDocument.ts:91`), keyed by the
same flat index and introducing no second numbering scheme. So: **no decision
gates `blocks.ts`, and the search CLAUDE.md invariant 1 warns about lives in
it** (§3.1). Treat it as seeded-and-latent, and if you ever call it, read
invariant 1 first — its `buildBlockStarts` is where the non-decreasing
precondition actually has to hold.

### 7.2 One dependency the source never imports

`react-native-gesture-handler` is in `package.json` but is imported **nowhere in
`src/`** 🧪. It was a genuine candidate for click-to-jump and was rejected
because wrapping each word in a `GestureDetector` would add a view per word,
which `Text.onPress` avoids (AD28). It is a live dependency of nothing here.
