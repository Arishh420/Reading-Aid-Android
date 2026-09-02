# MVP-PLAN.md — the live register of open MVP questions

> **Purpose.** The Android MVP's scope is undecided: roughly eighteen questions
> are open. This file is where they live *while* they are open — a status
> board, the questions themselves, and the arguments as they develop — so a
> fresh session can pick one up instead of re-deriving it from chat.
>
> **This file is MUTABLE and deliberately disposable.** That is the opposite of
> its neighbours: [DECISIONS.md](DECISIONS.md) and [FINDINGS.md](FINDINGS.md)
> are append-only and permanent. This one is rewritten in place as items move,
> and it is **deleted when the MVP ships**. Nothing here is a record of
> anything. If a fact matters after the MVP, it does not belong in this file.
>
> **Anti-duplication rule — load-bearing, read this before editing.** The
> status board carries a **pointer and a one-line status, never restated
> rationale**. When an item settles, its reasoning goes into a
> [DECISIONS.md](DECISIONS.md) `AD` entry and **lives there and nowhere else**;
> this file's row shrinks to a pointer at that `AD` number and its register
> section is deleted. The web repo's PORT-PLAN.md §6 states the same discipline
> — "The analysis is not restated — read the section named" — and this file
> follows it. The rule exists because this repo has already documented
> value-duplication drift twice (AD2's `settings-defaults.ts` false positive,
> AF8's hand-copied `exclude` list that no mechanism keeps in sync); a second
> copy of a rationale is a second copy that will eventually disagree with the
> first.
>
> **Where things go.** Live questions and arguments → here. Settled decisions →
> [DECISIONS.md](DECISIONS.md) (`AD` entries; **AD18** records this routing
> decision itself). Spikes and queued work → GitHub issues in **this** repo.
> The web repo is untouched.
>
> Companion to [DECISIONS.md](DECISIONS.md) (what was *decided*) and
> [FINDINGS.md](FINDINGS.md) (what was *learned*), and governed by
> [CLAUDE.md](CLAUDE.md) (the working agreement).
>
> **Written:** 2026-09-01. **Branch:** `docs/mvp-plan-register`.
> **Commit at time of writing:** `bfb81e2`.

---

## 0. How to read this file

**Marking discipline.** Every claim about React Native, Hermes, or device
behaviour is marked ❓ unless it cites a specific `AF` entry in this repo's
[FINDINGS.md](FINDINGS.md). That file's verification legend governs here too:
🧪 measured, 📐 structural (follows from reading this repo's files), 👁 observed
on a running device by the project owner, ❓ unverified. This document makes
*choices under uncertainty*; it does not reduce the uncertainty.

**Back-references.** Bare `D#`/`F#` identifiers, and any `PORT-PLAN.md` /
`PORT-AUDIT.md` section number, point at the **web repo** (Reading Aid Tool).
Those files are not in this repo — they are back-references for someone who has
that repo, not live pointers, exactly as CLAUDE.md §4 and FINDINGS.md AF12 treat
web-repo IDs. `AD#` and `AF#` are local and live.

**Item IDs are stable, not ordered.** `D-A` … `D-R`, assigned once. Tier order
is priority order; the letters are *not* resequenced when an item moves, so a
pointer to `D-R` stays valid for the life of this file. (`D-R` sits in Tier 1
despite its letter, because it is blocked on `D-D`.)

**Nothing below is decided by this document.** The open items state a question
and the verified facts that make it live. They deliberately do not propose
options, recommend answers, or rank alternatives — that argument happens
elsewhere, one item at a time, and lands in an `AD` entry.

---

## 1. Definition of done

Every item below is scored against this, and only this:

> Open a document on a physical Android phone, read it with the pacer running,
> close the app, reopen it, and be where you left off. Nothing more is
> required.

---

## 2. Status board

Pointer and one-line status only. Rationale lives in the `AD` entry, never here.

| # | Item | Status | Where |
|---|---|---|---|
| **D-A** | Feature scope: modes, bionic, themes, presets, settings | **DECIDED** | [AD19](DECISIONS.md) + [AD23](DECISIONS.md) |
| **D-B** | Which document formats ship in v1 | **DECIDED** | [AD20](DECISIONS.md) |
| **D-C** | Where decisions get logged | **DECIDED** | [AD18](DECISIONS.md) |
| **D-D** | Core drift across the repo boundary | **OPEN** — options in web PORT-PLAN.md §5.2, none chosen | §4.1 |
| **D-R** | Web issue #108 (`**hi **`) — fix sequence across repos | **OPEN — blocked on D-D** — agreed in principle | §4.2 |
| **D-E** | Per-tick highlight mechanism (CLAUDE.md §4 invariant) | **DECIDED** | [AD21](DECISIONS.md) |
| **D-F** | The pacer clock | **DECIDED** | [AD22](DECISIONS.md) |
| **D-G** | Reading surface and virtualization | **DECIDED** | [AD24](DECISIONS.md) |
| **D-H** | Getting a file in | **DECIDED** | [AD24](DECISIONS.md) |
| **D-I** | Storage scope — what actually persists | **DECIDED** | [AD24](DECISIONS.md) |
| **D-J** | Screens and navigation | **DECIDED** | [AD24](DECISIONS.md) |
| **D-K** | Settings and presets | **DECIDED** | [AD19](DECISIONS.md) + [AD23](DECISIONS.md) |
| **D-L** | How the APK reaches a physical phone | **DECIDED** | [AD24](DECISIONS.md) |
| **D-M** | App identity — icon, splash, display name | **DECIDED** | [AD24](DECISIONS.md) |
| **D-N** | Headless suites on Android | **DECIDED** | [AD24](DECISIONS.md) |
| **D-O** | pdf.js on React Native | **SPIKE** — not started; post-MVP per AD20, blocks nothing | §7.1 |
| **D-P** | JSZip on React Native | **SPIKE** — not started; post-MVP per AD20, blocks nothing | §7.2 |
| **D-Q** | Virtualization + imperative highlight together | **SPIKE** — not started; deferred out of the MVP by AD19, returns whenever virtualization does | §7.3 |

When a row reaches **DECIDED**, its `Where` becomes an `AD` number and its
register section below is deleted from this file.

---

## 3. Tier 0 — scope

### 3.1 · D-A — Feature scope: modes, bionic, themes, presets, settings

**DECIDED.** Flowing Highlight is the only pacer mode; RSVP, Chunk and presets
are cut; one theme (`light`), one user control (WPM). **Bionic rendering and
always-on natural pauses ship** — AD23 supersedes AD19 on that point. See
**AD19 + AD23** in [DECISIONS.md](DECISIONS.md). Rationale is not restated here.

### 3.2 · D-B — Which document formats ship in v1

**DECIDED.** Markdown only — PDF and EPUB are both cut. See **AD20** in
[DECISIONS.md](DECISIONS.md). Rationale is not restated here.

### 3.3 · D-C — Where decisions get logged

**DECIDED.** See **AD18** in [DECISIONS.md](DECISIONS.md). Rationale is not
restated here — that is the anti-duplication rule in the header, and this
section is its first demonstration.

---

## 4. Tier 1 — architecture

### 4.1 · D-D — Core drift across the repo boundary

Two copies of the twelve seeded files exist — this repo's `src/core/` and the
web repo's `src/` — byte-identical at seed time (AF7) with **no mechanism of
any kind** keeping them in sync. Nothing detects divergence; nothing prevents
it; the only current guarantee is that nobody has edited either copy. Four
options with trade-offs are laid out in the web repo's **PORT-PLAN.md §5.2**,
where none was selected. *Those options are not restated here — read the
section named.* What this register adds is that the question is no longer
hypothetical: D-R is a real, filed, agreed-to-be-fixed bug in one of the twelve
files, waiting on this answer. **AD22 expands this item's scope:** the decision
is now over the twelve seeded files **plus** a known-unsynced
`src/pacer/usePacer.ts` outside `src/core/`.

### 4.2 · D-R — Web issue #108: the fix sequence across two repos

Web issue #108 (OPEN, `bug`): `**hi **` renders as `*hi *` — `ITALIC_ASTERISK`
claims a delimiter pair `BOLD_ASTERISK` declined. **Decided in principle: it is
a real bug and it will be fixed.** What is *not* decided is the cross-repo
sequence. Confirmed present in both copies at identical lines 🧪 — the
constants at `src/core/parsers/markdown.ts:70-71`, the call sites at `98-101`.
The web repo is frozen, so a fix requires a deliberate freeze exception, then
the fix there, then a re-copy into this repo's `src/core/parsers/markdown.ts`,
then a fresh byte-identity hash check. **PENDING ON D-D**, deliberately: this is
the first real exercise of whatever sync mechanism D-D chooses, and sequencing
it first means performing the re-copy by hand and learning nothing about the
mechanism. Issue #108's own acceptance criteria already anticipate the
copy-across obligation, so the sequencing question is visible from the web side
too.

### 4.3 · D-E — The per-tick highlight mechanism

**DECIDED.** Word boxes — one `flexWrap` `View` per block, one text element per
word — driven by a single Reanimated shared value on the UI thread, with no
React re-render on a pacer tick. See **AD21** in [DECISIONS.md](DECISIONS.md).
Rationale is not restated here.

### 4.4 · D-F — The pacer clock

**DECIDED.** The web repo's `src/pacer/usePacer.ts` is ported — not rewritten
and not reimplemented — to Android `src/pacer/usePacer.ts`, outside `src/core/`,
differing from the web original by exactly two added `export` keywords. See
**AD22** in [DECISIONS.md](DECISIONS.md). Rationale is not restated here.

### 4.5 · D-G — Reading surface and virtualization

**DECIDED.** No virtualization for the MVP — a `ScrollView` with one `flexWrap`
`View` per block — settled *for the MVP*, with an explicit revisit trigger. See
**AD24** in [DECISIONS.md](DECISIONS.md). Rationale is not restated here.

---

## 5. Tier 2 — plumbing

### 5.1 · D-H — Getting a file in

**DECIDED.** No file picker — the seeded `SAMPLE_MARKDOWN` plus a
paste-your-own-text box, both reaching the same parser. See **AD24** in
[DECISIONS.md](DECISIONS.md). Rationale is not restated here.

### 5.2 · D-I — Storage scope: what actually persists

**DECIDED.** Reading position only — not WPM, not settings, not anything else.
See **AD24** in [DECISIONS.md](DECISIONS.md). Rationale is not restated here.

### 5.3 · D-J — Screens and navigation

**DECIDED.** One screen — `src/app/index.tsx` becomes the reader. See **AD24**
in [DECISIONS.md](DECISIONS.md). Rationale is not restated here.

### 5.4 · D-K — Settings and presets

**DECIDED.** Presets are cut entirely; WPM is the MVP's only user control. See
**AD19 + AD23** in [DECISIONS.md](DECISIONS.md) — AD19 settles this item
alongside D-A, and AD23 adds that a natural-pauses toggle and a bionic
intensity control are both post-MVP. Rationale is not restated here. The
residue is not open, it is elsewhere: persistence is D-I's and the control's
shape and placement are D-J's, both now settled by **AD24**.

---

## 6. Tier 3 — delivery

### 6.1 · D-L — How the APK reaches a physical phone

**DECIDED.** Two answers: `npx expo run:android --device` for development, and
a locally built **release** APK installed manually for delivery. See **AD24** in
[DECISIONS.md](DECISIONS.md). Rationale — and the release-mode evidence gap it
creates — is not restated here.

### 6.2 · D-M — App identity: icon, splash, display name

**DECIDED.** Display name only; the Expo template's adaptive-icon and splash
configuration is kept. See **AD24** in [DECISIONS.md](DECISIONS.md). Rationale
is not restated here.

### 6.3 · D-N — Headless suites on Android

**DECIDED.** No — four targeted device probes replace them, and D-N is post-MVP
and better answered after D-D. See **AD24** in [DECISIONS.md](DECISIONS.md).
Rationale is not restated here.

---

## 7. Spikes

Timeboxed investigations, **not decisions**. Each produces a finding, not an
`AD` entry, and each belongs in a GitHub issue in this repo with an explicit
stop condition. None has been started.

### 7.1 · D-O — pdf.js on React Native

Known-hard. The web repo's `pdf.ts` imports `pdfjs-dist@^6.0.227` and a worker
via a Vite-specific `?url` import 📐, and AD8 already records that even the web
repo's *headless* PDF suite needed an esbuild resolve-plugin stub because the
non-legacy build wants `DOMMatrix`. Whether any of that survives Metro and
Hermes is unknown ❓. **AD20 cuts PDF from the MVP**, so this is post-MVP and
blocks nothing.

### 7.2 · D-P — JSZip on React Native

The web repo's `epub.ts` imports `jszip@^3.10.1` 📐. Whether it works under
Hermes with Metro's resolver, and what it needs for binary data handling, is
unknown ❓. **AD20 cuts EPUB from the MVP**, so this is post-MVP and blocks
nothing. Note the seeded `epubStructure.ts` is the pure half and
already runs clean under the Hermes CLI (AF23) — the spike is only about the
container layer.

### 7.3 · D-Q — Virtualization plus imperative highlight together

Can a virtualized list and an imperatively-moved highlight coexist without
re-rendering the tree on the tick path, and without a viewability callback
fighting the user's own scroll? CLAUDE.md §4 names the second hazard as "the
constraint most likely to be violated silently during a port." This is a spike
rather than an argument because neither D-E nor D-G could be decided by reasoning
about the other. **AD19 defers it out of the MVP**: with no virtualization
shipping, the two never meet — the dependency returns whenever virtualization
does. **AD21 adds a second reason to defer**: its per-word style is N
comparisons per tick, fine at MVP length and a problem at book length ❓, so the
overlay — the scalable answer — returns with virtualization too.

---

## 8. Queued work, not decisions

Work that is already understood and just needs doing. It does not go through
the register; it goes into GitHub issues in this repo.

- **Port `src/core/pacer/orp-headless-test.mjs` to run on-device.** After
  **AF31**, three of AF12's four engine-sensitive features remain unexercised
  on a device: `\p{M}` (`core/pacer/orp.ts:36`) and
  `String.prototype.normalize('NFC')` (`core/pacer/orp.ts:137`), plus
  `String.prototype.matchAll` (`core/parsers/epubStructure.ts:90, 99, 160,
  183`). The orp suite covers **the two in `orp.ts`** — it is the
  NFD/combining-mark suite and exercises both directly — and does **not** cover
  `matchAll`, which lives in a module it never bundles. AF31, not AF28, is the
  current statement of what on-device coverage exists.
- **Port `usePacer.ts` and add its headless suite (AD22).** The web original is
  copied to Android `src/pacer/usePacer.ts` — outside `src/core/` — with the two
  added `export` keywords AD22 specifies and no other change. A new
  Android-local suite bundles the copy and covers the three pure helpers, in
  particular `nearestWordlike`'s backward fallback when no word-like token
  exists at or after the target; it becomes the **ninth** suite in `npm run
  check`. Rationale is in AD22, not here.
- **Add a headless suite for `bionic.ts` (AD23).** `splitBionic` has **no test
  coverage in either repo** — no suite here and none in the web repo bundles
  `src/core/reader/bionic.ts`; AD23 records the resolved-to-literal sweep. AD23
  puts bionic in the MVP, so as things stand the module ships untested. A new
  Android-local suite bundles the real source, alongside the `usePacer` suite
  above. Rationale is in AD23, not here.
- **The web repo's open issues.** **17** open as of 2026-09-01 (`gh issue list
  --state open`, count only — deliberately not enumerated here; the web repo is
  untouched and its backlog is its own). Some are Android-tagged and will be
  mirrored into this repo as they become relevant. Mirroring one is not a
  decision and does not need a register entry.

Note: **this repo currently has no GitHub issues at all** 🧪 (`gh issue list
--state all` returns empty). The destination for spikes and queued work is
chosen, not yet populated. Creating those issues was out of scope for the
change that created this file.

---

## Appendix — what was and was not run for this document

| What | Result |
|---|---|
| `git branch --show-current` | `docs/mvp-plan-register` ✅ |
| `git log -1` | `bfb81e2`, 2026-09-01 — the commit in the header |
| `git status --porcelain` before editing | empty (clean tree) |
| `find src -type f` | 22 files; 12 seeded `core/` sources + 8 `.mjs` suites + 2 `src/app/` files |
| `grep -n` on `core/parsers/markdown.ts` | emphasis consts at 62–63 / **70–71**, call sites at **98–101**, `stripInline` called at 121 and 158 |
| `grep -n '\p{'` across `core/` | `tokenize.ts:26,30`; `orp.ts:36`; `bionic.ts:31` |
| `grep -n 'matchAll'` on `epubStructure.ts` | lines 90, 99, 160, 183 |
| Read `core/ui/sample.ts` in full | 5 asterisk emphasis spans; **no** underscores and **no** digits inside the template literal |
| Read `package.json` / `app.json` in full | Reanimated `4.5.1`; MMKV `^4.3.2`; expo-router `~57.0.17`; `reactCompiler: true`; package `com.arishh.readingaid`; **no** document-picker or file-system dependency |
| `grep -rn "mmkv\|MMKV\|usePacer"` over `src/` | no MMKV reference anywhere; `usePacer` appears only in two comments |
| `gh issue view 108 --repo Arishh420/Reading-Aid-Tool` | OPEN, `bug` — read in full, including its copy-across acceptance criterion |
| `gh issue view 102 --repo Arishh420/Reading-Aid-Tool` | OPEN, `documentation`+`android` — read in full |
| `gh issue list --repo Arishh420/Reading-Aid-Tool --state open` | **17** |
| `gh issue list` (this repo, `--state all`) | empty — no issues exist here |
| Read-only check of the web repo's PORT-PLAN.md / PORT-AUDIT.md | confirmed §5.2, §6 and §4.5 exist with those numbers; **no web-repo file was modified** |
| `npm run check` | see the PR/handoff summary for the literal output |

**Not run:** no emulator, no device, no Android build, no `expo prebuild`, no
Hermes binary, and no headless suite beyond the eight that `npm run check`
already runs. **No source file was modified** by the change that created this
document — it touched `MVP-PLAN.md`, `DECISIONS.md` and `FINDINGS.md` only.
Every claim above about React Native, Hermes, or device behaviour is either
marked ❓ or cites a specific `AF` entry; none of it was executed for this
document.
