# Reading Aid — Android

A reading aid for Android. You give it Markdown and it shows the document as
ordinary flowing prose with **one word highlighted at a time**, advancing at a
speed you choose, pausing a little longer at commas and rather longer at full
stops. Each word carries a **bionic anchor** — its first few letters bolded —
the page scrolls itself to follow the highlight, tapping any word jumps there,
and closing and reopening the app puts you back where you left off.

One screen, one setting (words per minute), Markdown only, one theme. That is
deliberate and it is not unfinished work — **[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)**
has the scope, what was cut, and what gates each cut feature's return.

---

## Prerequisites

**These are the versions this project was built and verified on — not declared
minimums.** Nothing in this repo pins a Node or JDK version (there is no
`engines` field, no `.nvmrc`, no `.node-version` 🧪), so treat the first three
rows as a report of what works rather than a floor. The rest are pinned by the
repo and you get them automatically.

| | Version | Where it comes from |
|---|---|---|
| **Node** | 26.7.0 | measured on the machine that runs the suites 🧪; **AF10** records the same version. Not pinned anywhere |
| **npm** | 11.19.0 | measured 🧪 |
| **JDK** | 17 (Zulu 17.0.20.1) | measured 🧪. Not pinned anywhere. `keytool`, needed for release signing, ships with it |
| **Android SDK platform** | **API 36** (`compileSdk` / `targetSdk` 36), min **API 24** | `node_modules/react-native/gradle/libs.versions.toml:3-5` 📐, reaching the build through `expoAutolinking.useExpoVersionCatalog()` at `android/settings.gradle:36` |
| Build tools / NDK | 36.0.0 / 27.1.12297006 | same catalog, `:6-7` 📐 |
| Gradle | 9.3.1 | `android/gradle/wrapper/gradle-wrapper.properties:3` 📐 — **the wrapper supplies it; do not install Gradle** |
| Android Gradle Plugin / Kotlin | 8.12.0 / 2.1.20 | same catalog, `:9` and `:32` 📐 |
| Expo SDK / React Native / React | ~57.0.18 / 0.86.3 / 19.2.3 | `package.json` 📐 |

You need **Android Studio or the Android command-line tools** for the SDK, a
platform-36 image, and `adb` on your `PATH`. The device evidence in this repo
was gathered on a physical phone and on the AVD `Pixel_9_API36` (API 36,
arm64-v8a, Google APIs image) 👁 — see **AF27**/**AF28**.

## Running it

```sh
npm install
npx expo run:android --device
```

That is the development loop (AD24 `D-L`): it builds the native app, installs it
over USB, and starts Metro to serve the JavaScript. `-d, --device [device]`
takes a device name — *"Device name to run the app on"*, per the CLI's own help
🧪. `npm run android` is the same command 📐.

**For an emulator:** start the AVD first, then run the same command **without**
`--device`, and it targets the running emulator. One caveat that matters more
here than in most projects — **AF35** measured emulator frame timing as *not* a
proxy for device timing (a 120.82 ms frame on the emulator against device maxima
of 31.03 and 33.98 ms), so judge anything about smoothness on hardware.

### Expo Go will not run this app

If you half-remember the Expo template offering it: **it does not work here**,
and it is not a configuration problem. This app depends on native modules that
Expo Go's fixed runtime does not contain — `react-native-mmkv` 4 (a Nitro
HybridObject), `react-native-nitro-modules`, and Reanimated 4 with
`react-native-worklets` 📐. `expo-dev-client` is not installed 🧪. Every device
run this repo records is a development build or a release build (**AF27**,
**AF42**), never Expo Go. You need `run:android`, which produces a real native
build. *(That Expo Go cannot load these modules is vendor runtime behaviour, not
something measured here* ❓*.)*

## Building a release APK

The delivery artifact is a **locally built, release-signed APK, installed by
hand, running with no laptop attached** (AD24 `D-L`, done in **AF42** 👁). A
*debug* APK cannot do that — it expects Metro to serve it JavaScript.

**1 · Generate a keystore.** Once, and keep it forever:

```sh
keytool -genkeypair -v -storetype PKCS12 \
  -keystore reading-aid-release.keystore \
  -alias <your-alias> -keyalg RSA -keysize 2048 -validity 10000
```

`keytool` prompts for the passwords, so none appears on the command line or in
any file you commit. **Whatever you put in `<your-alias>` must be the same
string you set as `keyAlias`** in the next step — if the two disagree, the build
fails with a message about a missing key. That failure is correct behaviour, but
it is confusing if you have not connected the two.

**2 · Fill in `keystore.properties`** at the repo root, using the template in
**[RELEASE-SIGNING.md](RELEASE-SIGNING.md) §2** — the file is gitignored, and
the template is not repeated here. The keystore itself is gitignored too, is
**not reproducible**, and if you lose it every future build is a different app
identity that cannot upgrade an installed one. Back it up outside this repo.

**3 · Build.**

```sh
cd android && ./gradlew assembleRelease
```

There is **no fallback to debug signing** (AD30): if `keystore.properties` is
missing or incomplete, the build fails before it compiles anything rather than
quietly emitting a debug-signed "release" APK. **AF42** measured that guard
firing — `BUILD FAILED`, `28 actionable tasks: 28 up-to-date`, so zero tasks
executed and no artifact was produced.

**4 · Verify the signature**, because this is the step that catches a lost
signing config:

```sh
apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
```

`CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US` means
the config was lost and the build fell back to the template default —
restore it from RELEASE-SIGNING.md §3 and rebuild.

**5 · Install it** — `adb install -r android/app/build/outputs/apk/release/app-release.apk`,
or copy the APK to the phone and open it there.

> **Read [RELEASE-SIGNING.md](RELEASE-SIGNING.md) before you run
> `npx expo prebuild`.** A bare `prebuild` is **clean by default** in SDK 57 and
> **destroys the signing configuration silently** — `android/` is gitignored, so
> nothing shows as dirty and there is no diff to restore from. That document
> exists to put it back, and it holds the three Gradle blocks verbatim.

## Verifying a change

```sh
npm run check
```

That runs, in order: `tsc --noEmit` over the app; `tsc -p tsconfig.core.json`,
the portability guard that typechecks `src/core/` in isolation with no DOM;
`scripts/check-core-baseline.mjs`, the fork baseline check; and then **14
headless suites — 357 checks** 🧪. Every suite esbuild-bundles real source and
asserts what it computes. Individual pieces: `npm run build`,
`npm run check:baseline`, `npm run test:core` (8 suites, 125 checks),
`npm run test:local` (6 suites, 232 checks).

**If you changed a file listed in [CORE-DIVERGENCE.md](CORE-DIVERGENCE.md), the
baseline check will fail until you update its row — in the same pull request.**
That is the check working as designed, not a bug; the manifest's §3 has the
three-step procedure, and [ARCHITECTURE.md](ARCHITECTURE.md) §5 explains why.

### What `npm run check` does NOT cover

**The suites are Node-only by construction** — they import `node:assert/strict`
and use `esbuild` as a library, so they cannot execute a worklet, a Reanimated
shared value, a `ScrollView`, a native view, or MMKV. Everything below is known
to work **only because a person ran it on a phone**, and **none of it is
reproducible from a clone**:

| What | Evidence |
|---|---|
| The highlight advances with **zero** React re-renders | **AF32** (physical device), **AF43** (emulator) 👁 |
| Bionic's `\p{L}` runs under device Hermes | **AF33** 👁 |
| `requestAnimationFrame` and `performance.now()` share a time base, so the ported clock needed no patch | **AF34** 👁 |
| Auto-scroll follows the active line; position survives a full app close | **AF38**, **AF39** 👁 |
| Tapping seeks; dragging scrolls instead | **AF40** 👁 |
| Release-mode Hermes bytecode runs at all | **AF42** 👁 — the **only** release-mode evidence this repo holds |

**And the emulator is not a substitute.** **AF35** measured it as materially
more pessimistic than hardware, so "I checked it on the emulator" produces false
alarms — it is documented here as such.

> **A developer who changes the highlight mechanism, sees a green check, and
> ships has re-proven nothing.** Re-run the device probes. `ARCHITECTURE.md` §4
> lists what must never happen on the per-tick path, and §6 lists every file
> with no automated coverage at all.

## The documents

| File | What it is | Mutable? |
|---|---|---|
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | **Scope.** What the app is, what was deliberately cut and what gates each return, the open spikes, known defects, and the decision index | mutable |
| [ARCHITECTURE.md](ARCHITECTURE.md) | **Structure.** Directory layout and what enforces each boundary, the end-to-end data flow, the two invariants and their blast radius, the per-tick hot path, the fork, and what has no test coverage | mutable |
| [DECISIONS.md](DECISIONS.md) | **Why.** One entry per judgment call — what was decided, why, and the alternative rejected. `AD1`–`AD37` | **APPEND-ONLY** — never rewritten; corrections are appended and marked |
| [FINDINGS.md](FINDINGS.md) | **What was learned** by building and testing, each entry tagged with how it was verified. `AF1`–`AF48` | **APPEND-ONLY** |
| [CORE-DIVERGENCE.md](CORE-DIVERGENCE.md) | The fork manifest — 26 baseline-pinned files, enforced by `npm run check` | mutable |
| [RELEASE-SIGNING.md](RELEASE-SIGNING.md) | The signing configuration's recovery record: the Gradle blocks verbatim, the properties template, and the restore procedure | mutable |
| [CLAUDE.md](CLAUDE.md) | The working agreement — branch discipline, docs-are-part-of-done, honest verification, and the two invariants that must never break | mutable |

Start with `PROJECT_CONTEXT.md` if you want to know **what** this is, and
`ARCHITECTURE.md` if you want to know **how** it works. `DECISIONS.md` and
`FINDINGS.md` are long, dated, and have change logs at the bottom.

**A note on identifiers you will meet in the logs.** Bare `D67`, `F16`,
`PORT-PLAN.md §5.2` and issue numbers like `#110` refer to a **separate web
repository** this app was ported from. It is frozen, there is **no live
dependency on it**, and **it is not required to build, test or ship this repo**
— see `PROJECT_CONTEXT.md` §3. `AD#` and `AF#` are local and live.

## If you know the Expo template

This started as `create-expo-app` and has diverged. Five things the template
teaches that are wrong here:

- **There is no `app/` directory.** Routes are at **`src/app/`** 🧪 — two files,
  a `Stack` layout and the reader screen.
- **There is no `reset-project` script.** The twelve scripts are `start`,
  `android`, `ios`, `web`, `build`, `build:core`, `test:core`, `test:local`,
  `test:all`, `check:baseline`, `check`, `lint` 🧪. Running it would have wiped
  the app.
- **Do not set up Jest.** There are already 14 suites and 357 checks behind
  `npm run check` 🧪; they are plain `.mjs` files run by Node.
- **`app.json` is not the whole config.** A root **`app.config.ts`** overlays
  it, and Expo resolves the dynamic one first 🧪. It returns `app.json`
  untouched unless `READING_AID_UAT` is set, in which case it rewrites the app's
  identity for a side-by-side UAT build (AD37). Read both before concluding what
  the app is called or which `applicationId` it builds.
- **`npx expo start` alone is not enough**, and Expo Go is not an option — see
  above. Use `npx expo run:android`.

The `ios` and `web` scripts are template leftovers. There is no `ios/`
directory 🧪, this is an Android-only project, and neither script has ever been
exercised here ❓.
