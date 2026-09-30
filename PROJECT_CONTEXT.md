# PROJECT_CONTEXT.md — scope

> **Purpose.** What this app is, what it deliberately is not, and what is still
> open. This is the document [CLAUDE.md](CLAUDE.md) §2 names for **scope**.
>
> **Scope, not structure.** [ARCHITECTURE.md](ARCHITECTURE.md) owns structure,
> data flow and the portable-vs-web split, and **this file does not repeat it**.
> If you want to know how a document reaches the screen, read that. If you want
> to know why it only reaches the screen from Markdown, read this.
>
> **This file is MUTABLE**, unlike the append-only
> [DECISIONS.md](DECISIONS.md) and [FINDINGS.md](FINDINGS.md). It is rewritten
> in place as scope changes, so if it disagrees with the code, **the code wins
> and this file is stale** — fix one and flag the drift (CLAUDE.md §2).
>
> **Rationale is not restated here.** Every scope decision below was argued in a
> `DECISIONS.md` `AD` entry, and an `AD` reference is a **pointer to the
> reasoning, not a summary of it** (AD18's anti-duplication rule). This file
> says *what* and *what it costs you*; that file says *why*.
>
> **Verification legend**, as `FINDINGS.md` defines it: 🧪 measured (a command
> was run here), 📐 structural (follows from reading the repo's files), 👁
> observed on a running device **by the project owner** and reported, ❓
> unverified. Claims about **device or Hermes behaviour carry an `AF` citation
> or a ❓** — nothing in this repo can run a phone.

---

## 1. What this is

**A reading aid for Android.** You give it Markdown, and it shows you the
document as ordinary flowing prose with **one word highlighted at a time**,
advancing at a speed you choose. The highlight pauses a little longer at commas
and rather longer at full stops and paragraph ends, so the pacing tracks the
sentence rather than marching through it. Each word carries a **bionic anchor**
— its first few letters bolded — to give the eye something to land on. The page
scrolls itself to follow the highlight, and **tapping any word moves the
highlight there**. Close the app, reopen it, and you are where you left off.

One screen. One setting: words per minute. A small readout above the play
button tells you which word you are on. That is the whole app.

It is a **locally built, manually installed APK** — not a Play Store listing and
not an Expo Go project. See [README.md](README.md) to run it.

## 2. The definition of done

This is the standard the MVP was built and accepted against, and the **only**
one. Quoted verbatim from the register that governed the build:

> Open a document on a physical Android phone, read it with the pacer running,
> close the app, reopen it, and be where you left off. Nothing more is
> required.

**It is met.** **AF42** records the release-signed APK built locally, copied to
a physical Android phone by hand, installed, and exercised with no laptop
attached — satisfying AD24 `D-L` in full 👁. Earlier device and emulator runs
cover the individual behaviours: the highlight (**AF32**, **AF43**), bionic
on-device (**AF33**), the clock's timing (**AF34**), auto-scroll and resume
across a full app close (**AF38**), the visual ruling (**AF39**), and
click-to-jump (**AF40**) 👁. **I have never run any of it** — every 👁 in this
repo is the project owner's observation, relayed. §6 of
[ARCHITECTURE.md](ARCHITECTURE.md) says what that does and does not buy you.

**One honest bend, recorded rather than glossed.** "Open a document" is
satisfied by the **seeded sample document plus a paste box**, not by a file
picker — and **AD24 `D-H` says so itself**, in as many words: pasting text and
reading it satisfies the spirit, not the letter. If your reading of "open a
document" requires a picker, this MVP does not meet it, and epic **E1** (Library
& import) in §5 is what closes the gap — AD48 is its import model.

## 3. Relationship to the web repo — there is no live dependency

Read this before you go looking for a second repository.

This app is a **port**. Its document model, tokenizer, Markdown parser, dwell
table, bionic split and pacer clock all originated in a separate web
application, the **Reading Aid Tool**. That application is **frozen**.

> **After AD31 and AD32 there is NO live dependency on it.** The web repo is
> **not required to build, test, run or ship this one**, is not consulted by any
> script here, and **is not supplied with this repo**. No submodule, no shared
> package, no sync step, no network call. `npm run check` passes on a clone that
> has never heard of it 🧪.

What replaced the dependency is a **recorded baseline**:
[CORE-DIVERGENCE.md](CORE-DIVERGENCE.md) pins every ported file by hash and
`scripts/check-core-baseline.mjs` enforces it inside `npm run check`.
[ARCHITECTURE.md](ARCHITECTURE.md) §5 explains the mechanism and the procedure
you must follow when you change one of those files.

**So when you meet a web reference in the logs, it is a back-reference, not a
live pointer.** Throughout `DECISIONS.md`, `FINDINGS.md` and the seeded source
comments you will find:

| Form | What it means |
|---|---|
| bare `D67`, `F16`, `F23/D89` | **web repo** decision/finding IDs — a courtesy to anyone who has that repo |
| `PORT-PLAN.md §5.2`, `PORT-AUDIT.md §4.5` | **web repo** documents, not in this repo |
| `#102`, `#105`, `#108`, `#110` | **web repo** GitHub issues |
| paths like `src/pacer/orp.ts`, `App.tsx:410`, `index.css:629` | **web repo** files; this repo's copies sit under `src/core/` |
| `AD31`, `AF42` | **local and live** — this repo's own logs |

Two of those web issues are now **this** repo's to fix, with no obligation back
— see §7.

## 4. What ships

Everything in the app, with the decision that put it there:

- **Markdown only** — a dependency-free block parser; headings and paragraphs,
  lists flattened to paragraphs, inline emphasis stripped (AD20).
- **Flowing Highlight** as the only pacer mode (AD19).
- **Bionic rendering, always on** and not switchable (AD23).
- **Natural pauses, always on** and not switchable — the dwell table applies at
  the clock, so pacing follows punctuation (AD23).
- **WPM is the only user control** — stepped buttons, 50–1000, default 300
  (AD19, AD23). There is no slider because React Native has none built in and
  `@react-native-community/slider` is **not installed** 🧪.
- **One theme**, `light` (AD19).
- **One screen** (AD24 `D-J`).
- **Click-to-jump** — tap a word to seek to it; a tap never starts or stops
  playback, and a drag scrolls instead of seeking (AD28, confirmed on both
  surfaces by **AF40** 👁).
- **Reading position persists, and nothing else does** — not WPM, not settings
  (AD24 `D-I`). Position is keyed to a content fingerprint, so it follows the
  document rather than a filename (AD27).
- **Documents arrive as the seeded sample or pasted text** (AD24 `D-H`).
- **A live word-index readout** above the transport button, showing the flat
  word index the pacer is on — `Word 42 / 175`, 0-based, so it agrees with
  invariant 1 and with every `AF` entry. It is driven from the same Reanimated
  shared value as the highlight and writes its text on the UI thread, so it
  costs no React render on a tick (AD42).

## 5. The alpha, and what comes after it

**Alpha means: the user can import their own PDF and Markdown documents, find
them again in a library, read them comfortably, keep their place, and see what
they have read. Everything else is later.** That definition and the eleven epics
below are **AD47**; the reasoning is there and is not restated here (AD18).

**This replaces AD23's post-MVP ladder as a priority list.** The ladder was
ordered cheapest first, which put PDF at rung 8 of 9; the alpha is ordered by
what a reader needs. **The ladder's gates are kept** — they are evidence about
the repo, not priorities — and each is carried below, word for word, into the
epic that now owns it. §5.3 traces all nine old rungs so a lost gate would be
visible. **No dates, no sizes, and no order among the alpha epics** were set.

**None of this is built.** §4 is what ships today; everything below is scope,
not code. The row-level triage behind the epics — 137 web rows and 16
Android-only rows (AF57) — is **not in this repo yet**: before an epic's
implementation branch is cut, that epic's row list lands as GitHub issues.

### 5.1 The alpha epics

| Epic | Alpha clause it serves | Gate carried forward | Decisions |
|---|---|---|---|
| **E1 · Library & import** | import their own documents; find them again in a library | *Old rung 1, file picker:* `expo-document-picker` and `expo-file-system` are **both not installed** 🧪, and adding native packages needs a Gradle build rather than a Metro reload ❓. AD24 `D-H` | AD47, **AD48** (copy, not a held URI) |
| **E2 · PDF reading** | import their own **PDF** documents | *Old rung 8, PDF:* Spike **D-O** (§6). Same shape [as EPUB, E10]: the pure text half is seeded and tested; the decode half is unported | AD47, **AD50** (page indicator) |
| **E3 · Reader comfort & settings** | read them comfortably | *Old rung 4, the three other themes* (`sepia`, `dark`, `dim`): Only the styling layer. All four ids are already seeded at `src/core/ui/theme.ts:9-14` 🧪, but the colours live in `src/reader/palette.ts`, which holds `light` alone (AD26). *Old rung 6, a bionic intensity control and a natural-pauses toggle:* Nothing structural — both values already exist (`BIONIC_RATIO` defines `low`/`medium`/`high` 🧪; the clock takes `naturalPauses` as an option 📐). It is a settings surface that AD19/AD23 chose not to ship | AD47, **AD49** (sparse per-book overrides) |
| **E4 · Place & progress** | keep their place | none — no old rung | AD47, AD50 |
| **E5 · Reading stats** | see what they have read | none — no old rung | AD47, **AD51** (pacer running, foregrounded) |
| **E6 · Scale & performance** | cross-cutting | *Old rung 9, virtualization:* The `D-G` revisit (AD24) plus spike **D-Q** (§6). Today **every word in the document is mounted** as a native view; AD24 set the revisit trigger as the first document that visibly stutters on scroll or takes more than a moment to mount, and **AF35** requires that trigger be judged on hardware, never on an emulator | AD47 |
| **E7 · Quality** — accessibility, error states | cross-cutting | none — no old rung | AD47 |

Two consequences of E6's gate are worth stating plainly, because they are the
ones a large document will find first: the reading surface has **never been
measured beyond the seeded 176-word sample** (AF38, AF40, AF42 all record this
gap), and both the scalable alternatives — a measured-rect highlight overlay and
a container-level tap hit-test — were deferred into the same revisit, because
they want the same per-word measurement data (AD21, AD28).

### 5.2 Deferred — later than the alpha

| Epic | Gate carried forward |
|---|---|
| **E8 · Modes** — flowing polish, chunk | *Old rung 3, chunk mode:* Nothing. The clock already supports it: `usePacer`'s `chunkSize` option scales the threshold 📐. No gate was named |
| **E9 · RSVP & presets** | *Old rung 2, RSVP mode:* The on-device `orp` probe must close **AF31** residue items 1–2: `\p{M}` (`src/core/pacer/orp.ts:36`) and `normalize('NFC')` (`:137`) have **never run on a device** 📐. The module is seeded and tested in Node. *Old rung 5, presets:* Needs the web repo's `presets.ts` ported, and web issue #105 (a value-duplication defect in it) resolved |
| **E10 · EPUB** | *Old rung 7, EPUB:* Spike **D-P** (§6). The pure structure half is seeded and tested; the container half is unported. **Deferred behind PDF on purpose** — the import pipeline is proven once, with PDF, not twice (AD47) |
| **E11 · Post-alpha odds and ends** | None — it absorbs no old rung. It holds rows triaged Later that belong to no deferred theme: drag-and-drop, the format selector dropdown, the word-number field, minimal-HUD/compact transport, the resume interstitial, session-log growth capping |

### 5.3 Where each old rung went

| Old rung | Feature | Now |
|---|---|---|
| 1 | File picker | **E1** · alpha |
| 2 | RSVP mode | E9 · later |
| 3 | Chunk mode | E8 · later |
| 4 | The three other themes | **E3** · alpha |
| 5 | Presets | E9 · later |
| 6 | Bionic intensity control and natural-pauses toggle | **E3** · alpha |
| 7 | EPUB | E10 · later |
| 8 | PDF | **E2** · alpha |
| 9 | Virtualization | **E6** · alpha |

Nine rungs, nine rows, and every gate above. AD23 itself is unchanged in
[DECISIONS.md](DECISIONS.md) and remains the record of the order they were in.

## 6. The three open spikes — the only genuinely open questions

Everything MVP-blocking is settled. What remains is three **timeboxed
investigations**, not decisions: each produces a finding rather than an `AD`
entry, and **none has been started**. **None blocks the shipped MVP — but since
AD47, two of them sit on the alpha's path:** `D-O` gates **E2** (PDF reading)
and `D-Q` gates **E6** (scale & performance). `D-P` stays deferred with
**E10**.

### D-O · pdf.js on React Native

Known-hard. The web implementation imports `pdfjs-dist` **and** its worker
through a Vite-specific `?url` import, which has no Metro equivalent; AD8
already records that even the web repo's *headless* PDF suite needed an esbuild
resolve-plugin stub because the non-legacy build wants `DOMMatrix`. Whether any
of it survives Metro and Hermes is **unknown** ❓. AD20 cut PDF from the MVP;
AD47 brings it into the alpha as E2, so this spike is now **alpha-blocking**.

### D-P · JSZip on React Native

The web EPUB parser imports `jszip`. Whether it works under Hermes with Metro's
resolver, and what it needs for binary data handling, is **unknown** ❓. Note
the narrow scope: the seeded `src/core/parsers/epubStructure.ts` is the **pure
half** and already runs clean under the Hermes CLI (**AF23**), so the spike is
only about the **container** layer — getting bytes out of a zip. AD20 cut EPUB
from the MVP, and AD47 keeps it deferred as E10, so this spike stays
post-alpha.

### D-Q · Virtualization plus an imperative highlight, together

Can a virtualized list and an imperatively-moved highlight coexist without
re-rendering the document tree on the tick path, and without a viewability
callback fighting the user's own scroll? CLAUDE.md §4 names that second hazard
as "the constraint most likely to be violated silently during a port". It is a
spike rather than an argument because neither `D-E` nor `D-G` could be settled
by reasoning about the other. **Two independent reasons deferred it for the
MVP:** AD19 means nothing virtualized ships, so the two never meet; and AD21's
per-word style is N integer comparisons per tick — fine at MVP length, a problem
at book length ❓. **AD47 puts it on the alpha's path** as part of E6's gate.

## 7. Known defects

Two real defects ship in the seeded parser and bionic modules. Both were filed
against the **web** repo before the fork; under **AD31** they are now **this**
repo's to fix, on this repo's schedule, with no cross-repo obligation and no
copy-across.

- **Web #108 — the `**hi **` case in `src/core/parsers/markdown.ts`.** AD18
  describes it as a **cosmetic emphasis-stripping edge case, not a parse
  failure** — the document still parses and still reads. That is the whole of
  what the local record claims about it; the issue text itself lives in the web
  repo, which you do not have.
- **Web #110 — an NFD combining mark orphaned by `splitBionic`** in
  `src/core/reader/bionic.ts`. When a base letter is exactly the *n*th letter,
  the combining mark that follows it falls on the head/tail boundary and is
  **orphaned into the unbolded tail**: decomposed `é` (`e` + U+0301) at
  intensity `medium` bolds the `e` and leaves the acute unbolded 🧪. **Not a
  port regression** — the suite records that the web implementation has the
  identical defect.

> ### The trap in #110 — read this before you fix it
>
> **`src/reader/bionic-headless-test.mjs:188` asserts the #110 defect AS
> CURRENT BEHAVIOUR**, with its explanation at `:167-175` 🧪. The check is named
> for what it does — it pins what the code *does*, not what is *correct*.
>
> So someone who correctly fixes `splitBionic` **will see a green suite turn
> red, and may conclude their fix is wrong.** It is not; the pin is.
>
> **Fixing #110 therefore takes three changes in the same pull request:** the
> fix in `src/core/reader/bionic.ts`, the updated pin in that suite, and
> `bionic.ts`'s row in [CORE-DIVERGENCE.md](CORE-DIVERGENCE.md) — new
> `Current sha256`, `Diverged?` flipped to `y`, and a `Record` pointing at the
> `AD`/`AF` entry that says why. That is CORE-DIVERGENCE.md §3's procedure, and
> AD31 names this fix as **the fork's first real exercise** of it. Splitting it
> across two PRs fails the baseline check in between.

---

## Appendix — the decision index

**Every scope and architecture question this project tracked, and where it was
settled.** These `D-` letters are cited throughout `DECISIONS.md`, which is
append-only and so cannot be rewritten to inline them — **this table is the only
mapping that exists.** It is a **pointer table**: item, subject, and the `AD`
entry. No rationale (AD18).

The letters were assigned once, in the order the questions arose, and were never
resequenced — so `D-R` sitting between `D-Q` and nothing is expected, and a
pointer to any letter stays valid.

| Item | Subject | Settled by |
|---|---|---|
| **D-A** | Feature scope: modes, bionic, themes, presets, settings | [AD19](DECISIONS.md) + [AD23](DECISIONS.md); for the alpha, superseded in part by [AD47](DECISIONS.md) |
| **D-B** | Which document formats ship in v1 | [AD20](DECISIONS.md); for the alpha, superseded in part by [AD47](DECISIONS.md) — PDF returns, EPUB stays deferred |
| **D-C** | Where decisions get logged | [AD18](DECISIONS.md) |
| **D-D** | Core drift across the repo boundary | [AD31](DECISIONS.md) |
| **D-E** | The per-tick highlight mechanism (CLAUDE.md §4's invariant) | [AD21](DECISIONS.md) |
| **D-F** | The pacer clock | [AD22](DECISIONS.md), corrected by [AD25](DECISIONS.md) |
| **D-G** | Reading surface and virtualization | [AD24](DECISIONS.md) |
| **D-H** | Getting a file in | [AD24](DECISIONS.md); for the alpha, superseded by [AD47](DECISIONS.md) + [AD48](DECISIONS.md) |
| **D-I** | Storage scope — what actually persists | [AD24](DECISIONS.md); for the alpha, superseded in part by [AD49](DECISIONS.md) + [AD51](DECISIONS.md) |
| **D-J** | Screens and navigation | [AD24](DECISIONS.md); its own revisit trigger fires with E1 ([AD47](DECISIONS.md)) |
| **D-K** | Settings and presets | [AD19](DECISIONS.md) + [AD23](DECISIONS.md); for the alpha, settings superseded in part by [AD47](DECISIONS.md) + [AD49](DECISIONS.md), presets deferred (E9) |
| **D-L** | How the APK reaches a physical phone | [AD24](DECISIONS.md), implemented by [AD30](DECISIONS.md) |
| **D-M** | App identity — icon, splash, display name | [AD24](DECISIONS.md), implemented by [AD30](DECISIONS.md) |
| **D-N** | Headless suites on Android | [AD24](DECISIONS.md) |
| **D-O** | pdf.js on React Native | **SPIKE** — open, §6 |
| **D-P** | JSZip on React Native | **SPIKE** — open, §6 |
| **D-Q** | Virtualization + imperative highlight together | **SPIKE** — open, §6 |
| **D-R** | Web issue #108 — the fix sequence across two repos | [AD31](DECISIONS.md) |

Decisions **not** in this table, because they were never register items:
**AD1–AD17** (seeding `src/core/`, the portability guard, the headless-suite
port, the `check` script, the Hermes probes, the Android package name),
**AD26** and **AD29** (the reader's palette and its heading scale), **AD27**
(the content fingerprint), **AD28** (click-to-jump), **AD32**
(`CLAUDE.md` becoming Android-owned), **AD33–AD46** (the working agreement,
lint and CI, the release and UAT pipelines, the word-index readout, deferral
discipline, the branching guards and the doc-consistency check), **AD50** (the
position indicator) and **AD52** (the testing ladder). Read `DECISIONS.md` front
to back for those; it is dated and has a change log at the bottom.
