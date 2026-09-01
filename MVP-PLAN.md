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
| **D-A** | Feature scope: modes, bionic, themes, presets, settings | **OPEN** | §3.1 |
| **D-B** | Which document formats ship in v1 | **OPEN** | §3.2 |
| **D-C** | Where decisions get logged | **DECIDED** | [AD18](DECISIONS.md) |
| **D-D** | Core drift across the repo boundary | **OPEN** — options in web PORT-PLAN.md §5.2, none chosen | §4.1 |
| **D-R** | Web issue #108 (`**hi **`) — fix sequence across repos | **OPEN — blocked on D-D** — agreed in principle | §4.2 |
| **D-E** | Per-tick highlight mechanism (CLAUDE.md §4 invariant) | **OPEN** | §4.3 |
| **D-F** | The pacer clock — `usePacer.ts` is not seeded | **OPEN** — depends on D-E | §4.4 |
| **D-G** | Reading surface and virtualization | **OPEN** — must not break D-E's invariant | §4.5 |
| **D-H** | Getting a file in | **OPEN** | §5.1 |
| **D-I** | Storage scope — what actually persists | **OPEN** — MMKV itself settled (AD6) | §5.2 |
| **D-J** | Screens and navigation | **OPEN** | §5.3 |
| **D-K** | Settings and presets | **OPEN** | §5.4 |
| **D-L** | How the APK reaches a physical phone | **OPEN** | §6.1 |
| **D-M** | App identity — icon, splash, display name | **OPEN** — package name settled (AD17) | §6.2 |
| **D-N** | Headless suites on Android | **OPEN** — interacts with D-D | §6.3 |
| **D-O** | pdf.js on React Native | **SPIKE** — not started | §7.1 |
| **D-P** | JSZip on React Native | **SPIKE** — not started | §7.2 |
| **D-Q** | Virtualization + imperative highlight together | **SPIKE** — not started; D-E and D-G both wait on it | §7.3 |

When a row reaches **DECIDED**, its `Where` becomes an `AD` number and its
register section below is deleted from this file.

---

## 3. Tier 0 — scope

### 3.1 · D-A — Feature scope: modes, bionic, themes, presets, settings

Which of the web app's reading features are in the MVP at all? The facts that
make this live rather than obvious: `core/ui/theme.ts` seeds four themes
(`light`, `sepia`, `dark`, `dim`, default `light`) 📐 and `core/reader/bionic.ts`
is seeded and runs under the Hermes **CLI** with output identical to Node
(AF23) — but neither has run on a device ❓, and `bionic.ts` specifically is
named in AF31 as still unexercised on-device. The web app's three pacer modes
(`Rsvp`, `ChunkHighlight`, `FlowingHighlight`) are `.tsx` components in the web
repo's UI layer; none is seeded here, so every one of them is a build, not a
port. The question is what the definition of done in §1 actually requires — it
says "read it with the pacer running" and names no mode, no theme, and no
bionic — and what each additional feature costs given D-E and D-F are unsettled.

### 3.2 · D-B — Which document formats ship in v1

Markdown, PDF, EPUB, or a subset? Markdown is the only format proven end to end
on a device: AF28 records `parseMarkdown` producing 12 blocks and 176 words on
an Android emulator, byte-identical to Node 👁. PDF and EPUB are split in this
repo — their **pure** halves are seeded and Hermes-CLI-clean (`pdfText.ts`,
`epubStructure.ts`; AF23) — but their container/decode halves are not: in the
web repo `pdf.ts` imports `pdfjs-dist` plus a `?url` worker module, and
`epub.ts` imports `jszip` 📐. Neither dependency has been tried under React
Native ❓; that is what D-O and D-P exist to find out. So the real question is
whether v1 is Markdown-only, and if not, which of the two heavier formats earns
its spike.

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
files, waiting on this answer.

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

CLAUDE.md §4 states the invariant — the document tree must not re-render on the
per-pacer-tick path — and explicitly marks the React Native *mechanism* as
"UNDECIDED — do not treat this as settled," along with the three guards any
answer must satisfy (integer-only callback seam; index in a `ref`, never state;
viewability callback never triggers a scroll). That analysis is not restated
here. The open question is which mechanism: Reanimated shared values
(`react-native-reanimated@4.5.1` is a direct dependency 📐), `setNativeProps`,
or something else ❓. One local fact changes the picture relative to the web
repo's framing: **React Compiler is enabled** in this repo (`app.json` →
`experiments.reactCompiler: true` 📐), and its effect on this specific hot path
has not been measured anywhere ❓.

### 4.4 · D-F — The pacer clock

`usePacer.ts` is **not** among the twelve seeded files — it does not exist in
this repo 📐 (the web repo has it at `src/pacer/usePacer.ts`). So the clock has
to be ported, rewritten, or reimplemented from its behaviour spec, and the
question is which. The seeded `core/pacer/dwell.ts` already documents the seam
it plugs into — its own comment describes the gating helper as "shared by
usePacer's clock" 📐 — so the interface is partly pinned even though the
implementation is absent. **Depends on D-E:** the clock's tick handler is the
thing that must not re-render the tree, so the mechanism chosen there
determines what the clock is allowed to touch.

### 4.5 · D-G — Reading surface and virtualization

What renders the document, and is it virtualized? The web app used
`@tanstack/react-virtual@^3.14.3` 📐; React Native's list model is different
❓, and CLAUDE.md §4 records that on the web *two* independent fixes were needed
— pub/sub decoupling *and* virtualization — with neither sufficient alone, while
noting a virtualized list hands you one half for free and the other not at all.
Any answer must not break D-E's invariant, and in particular must respect the
guard that `onViewableItemsChanged` may never trigger a scroll. **No
virtualization at all may be the right MVP answer** — the §1 definition of done
does not name a document size — and that possibility is part of the question,
not a fallback.

---

## 5. Tier 2 — plumbing

### 5.1 · D-H — Getting a file in

There is no DOM File API on React Native ❓, so the web app's file-input path
does not carry. The likely shape is `expo-document-picker` plus
`expo-file-system`, and **neither is installed** — neither appears in
`package.json` 📐. But the prior question is whether the MVP needs file loading
at all: `core/ui/sample.ts` seeds `SAMPLE_MARKDOWN`, which already parses and
renders on a device (AF28) 👁, so a v1 that reads the seeded sample plus pasted
text is a coherent product. The §1 definition of done says "open a document,"
which does not by itself settle whether "open" means a file picker.

### 5.2 · D-I — Storage scope: what actually persists

The storage *engine* is settled — MMKV, synchronous (AD6) — but
`react-native-mmkv@^4.3.2` is still a declared dependency with **zero**
references anywhere under `src/` 🧪, so nothing is implemented. Open: what the
MVP persists. Reading position only is the minimum the §1 definition of done
requires ("reopen it, and be where you left off"); settings and presets are
additional and depend on D-A and D-K. Position persistence is keyed by a
content fingerprint, and web issue #102 (OPEN, `documentation` + `android`)
sharpens the obligation beyond "make it byte-identical": it asks for a
**fixed-hash conformance test built before any RN implementation**, because the
current web implementation is proven only against itself, and a divergent hash
loses every saved position silently.

### 5.3 · D-J — Screens and navigation

One screen, or a picker plus a reader? `expo-router` is present (`~57.0.17`,
and `main` is `expo-router/entry`), with `typedRoutes` enabled 📐. Today there
is exactly **one** route — `src/app/index.tsx` — and it is the Hermes probe
screen from AF27/AF28, not a reader 📐. So this question is genuinely
unanswered by the current code rather than merely undocumented by it, and it
interacts with D-H: no file picker means there may be nothing for a second
screen to do.

### 5.4 · D-K — Settings and presets

The web app ships nine built-in presets 📐, each bundling a mode and its
settings. Options span from cutting presets and settings entirely to shipping a
single fixed WPM control. The question is which, and it is downstream of D-A —
a preset that bundles a mode is meaningless if the MVP ships one mode. Note the
web repo has an open issue (#105) on preset value-duplication, which is
relevant only if presets ship at all.

---

## 6. Tier 3 — delivery

### 6.1 · D-L — How the APK reaches a physical phone

Local `npx expo run:android --device` over USB, or an EAS Build APK? The §1
definition of done says *physical Android phone*, and every device observation
in this repo so far is from an **emulator** (AF27, AF28, AF29 👁), so nothing
here has yet been demonstrated on real hardware ❓. This also carries the
debug-vs-release question: all existing device evidence is from a debug
development build, stated explicitly by AF27, and AF26 point 3 records that
**no finding covers release-mode bytecode precompilation, Metro+Babel's actual
transform output, or R8/Proguard interaction** ❓. Release is where real Hermes
bytecode appears, and it is currently unobserved.

### 6.2 · D-M — App identity: icon, splash, display name

Smaller than it sounds, and worth stating so it is not over-scoped. The Android
package name is already correct and permanent — `com.arishh.readingaid` (AD17)
📐 — and `app.json` already carries a complete adaptive-icon set, a splash
configuration, and a `scheme` 📐. What is open is only whether the MVP replaces
the Expo template *assets* and picks a display name other than
`ReadingAidAndroid`, and when.

### 6.3 · D-N — Headless suites on Android

The eight ported suites are Node-only **by construction**, not by accident:
AF23 records that they cannot run under Hermes because they import
`node:assert/strict`, `node:path`, `node:url` and `esbuild`, none of which the
Hermes CLI provides 🧪. So "run the suites on-device" is a rewrite, not a
configuration change. Does the MVP need on-device suites at all, or is Node
(`npm run check`, 125/125 — AF18/AF25) plus a targeted on-device probe
sufficient evidence? **Interacts with D-D:** whichever sync mechanism D-D picks
determines whether these suites stay duplicated across two repos too, and the
web repo's PORT-PLAN.md §6 already records the fate of the twelve suites as an
open item on its side.

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
Hermes is unknown ❓. Feeds D-B.

### 7.2 · D-P — JSZip on React Native

The web repo's `epub.ts` imports `jszip@^3.10.1` 📐. Whether it works under
Hermes with Metro's resolver, and what it needs for binary data handling, is
unknown ❓. Feeds D-B. Note the seeded `epubStructure.ts` is the pure half and
already runs clean under the Hermes CLI (AF23) — the spike is only about the
container layer.

### 7.3 · D-Q — Virtualization plus imperative highlight together

Can a virtualized list and an imperatively-moved highlight coexist without
re-rendering the tree on the tick path, and without a viewability callback
fighting the user's own scroll? CLAUDE.md §4 names the second hazard as "the
constraint most likely to be violated silently during a port." **D-E and D-G
both depend on the answer**, which is why this is a spike rather than an
argument: neither can be decided by reasoning about the other.

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
