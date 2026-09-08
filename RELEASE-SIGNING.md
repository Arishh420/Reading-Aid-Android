# Release build procedure and signing configuration

> **Purpose: this file covers the release build end to end.** `android/` is
> gitignored (`.gitignore:46`), so the release signing configuration in
> `android/app/build.gradle` exists nowhere in git — but **it is no longer a
> hand edit that has to be restored.** Since **AD38** it is GENERATED, on every
> prebuild, by the config plugin at
> [`plugins/withReleaseSigning.ts`](plugins/withReleaseSigning.ts), which
> `app.json` registers. That file is the single source of the signing block,
> and it is tracked, typechecked, linted and tested.
>
> §2 is the credentials template. **§3 is now a FALLBACK, not the mechanism** —
> a verbatim copy of what the plugin generates, kept only until the plugin has
> been proven by a real prebuild; §3 names the exact condition that retires it.
> §4 is what to do when the signing block is missing. §5 verifies a build. §7
> is the full release sequence, which belongs here rather than in a separate
> document because bumping `versionCode` drives the **same** prebuild that
> regenerates signing (AD36).
>
> This document is **mutable** — it must always describe the configuration and
> procedure that are live right now. If either changes, change it here in the
> same edit. **§3's blocks are checked, not merely written:**
> `plugins/withReleaseSigning-headless-test.mjs` asserts them against the
> plugin's own constants byte for byte inside `npm run check`, so the fallback
> cannot silently stop describing what is generated.
>
> **Why signing is a config plugin, and what that supersedes in AD30**, is
> **AD38**; the measurements are **AF50**. **Why the hand edit was chosen
> originally**, and why the conventional `exists()`-fallback pattern was
> rejected, is **AD30** — still the source of the Gradle design itself, which
> AD38 preserves byte for byte. The prebuild that preceded it is **AF41**, and
> the release-mode device evidence is **AF42**. **Why `versionCode` is set in
> `app.json`** is **AD36**. None of it is restated here (AD18).
>
> **No credential appears in this file, and none ever may.** Passwords and the
> key alias live only in `keystore.properties`, which is gitignored.

---

## 1. What happens to the signing config

**Nothing destroys it any more.** The plugin regenerates it, so every row below
that used to read DESTROYED now ends in a correctly signed project:

| Action | Effect on the signing config |
|---|---|
| `npx expo run:android` | **Untouched** — skips prebuild entirely when `android/` exists |
| `npx expo prebuild --no-clean` | **Preserved** — the file is reused, and the plugin detects its own previous output and returns it unchanged |
| `npx expo prebuild` | **Regenerated** — `clean` is the default in SDK 57, so `android/` is rebuilt from the stock template and the plugin re-applies |
| deleting `android/` by hand | **Regenerated** on the next prebuild |
| a **fresh clone**, or CI | **Generated** — the case the hand edit could never cover (AF47, AF49) |

**The plugin never fails quietly.** If the Expo template changes shape so that
an anchor no longer matches exactly once, it **throws** and the prebuild stops.
That is deliberate: a config plugin that gave up silently would leave the
template's own `release { signingConfig signingConfigs.debug }` in place, and
that build *succeeds* and emits an installable **debug-signed** "release" APK.
If you see `withReleaseSigning: anchor "…" matched 0 time(s)`, the template
moved — fix the plugin, and do not work around it by hand-editing the generated
file.

## 2. `keystore.properties` (repo root, gitignored by `.gitignore:48`)

Create it if missing. **Placeholders only below — fill in the real values
locally and never commit, paste, or transmit them.**

```properties
# Reading Aid — RELEASE SIGNING CREDENTIALS. NEVER COMMIT THIS FILE.
# Gitignored by .gitignore:48. Read by android/app/build.gradle (see RELEASE-SIGNING.md).
#
# storeFile is resolved relative to the REPO ROOT (this file's own directory).
# Replace the three CHANGEME values with the real ones. Do not paste them anywhere else.
storeFile=reading-aid-release.keystore
storePassword=CHANGEME
keyAlias=CHANGEME
keyPassword=CHANGEME
```

The keystore itself (`reading-aid-release.keystore`) is gitignored by
`.gitignore:47` (`*.keystore`). It is **not** reproducible — if it is lost, every
future build is a different app identity that cannot upgrade an installed one.
Back it up outside this repo.

## 3. FALLBACK — the three edits, verbatim

> **THIS IS NO LONGER THE MECHANISM.** These three blocks are what
> [`plugins/withReleaseSigning.ts`](plugins/withReleaseSigning.ts) generates on
> every prebuild. They are kept here as a fallback for one reason only: at the
> time of writing, **the plugin has never run in a real prebuild in this repo**
> — its output is proven by a string transform over a committed copy of the
> stock template, not by generation on disk. Until that changes, a human needs
> a way to put the block back by hand.
>
> **THE EXIT CONDITION, stated so that "fallback only until proven" cannot
> quietly become permanent.** §3 is deleted, and §4 with it, once **a real
> `npx expo prebuild --platform android` has run in this repo and the
> `android/app/build.gradle` it generates hashes to**
>
> ```
> 0b322188fa0661d91389c80c86a65c3d10dbd5996e8dc44d24031f539bdefcb9
> ```
>
> (`shasum -a 256 android/app/build.gradle`, with `versionCode` still `1` — a
> bump per §7 changes this hash by design, so record the comparison against the
> value in the plugin's suite rather than against a stale number). That single
> run is the whole condition. When it happens, record it as an `AF` entry,
> delete §3 and §4, and repoint §5 at the plugin.
>
> **These blocks are CHECKED against the plugin, not merely written beside it.**
> `plugins/withReleaseSigning-headless-test.mjs` parses the four fenced `gradle`
> blocks below and asserts each byte for byte against the plugin's own
> constants, inside `npm run check`. Two copies of the same text with no
> mechanism keeping them in step is precisely the unguarded duplication this
> repo has watched drift three times (AD2, AF8, AD26); that assertion is what
> makes keeping them affordable. **If you edit a block below, the suite fails
> until the plugin agrees — and the plugin is the one that is right.**

Verbatim. Anchors are given as the surrounding template text so they can be
relocated if line numbers shift.

### 3a. Preamble — inserted immediately **before** the `android {` block

Anchor: the line `def jscFlavor = '…'`, then a blank line, then `android {`.
Insert between the blank line and `android {`.

```gradle
/* ---------------------------------------------------------------------------
 * Reading Aid release signing. See RELEASE-SIGNING.md and DECISIONS.md AD30.
 *
 * Credentials are read from keystore.properties at the REPO ROOT, which is
 * gitignored and must never be committed. This file lives inside the generated
 * android/ directory, which is ALSO gitignored -- RELEASE-SIGNING.md holds the
 * verbatim copy of this block so it can be restored after `npx expo prebuild`.
 *
 * There is deliberately NO fallback to debug signing. The Expo template shipped
 * `release { signingConfig signingConfigs.debug }`, which makes assembleRelease
 * succeed and emit an installable DEBUG-SIGNED "release" APK -- a wrong artifact
 * that surfaces only later, as an install-time signature mismatch.
 * ------------------------------------------------------------------------- */
def keystorePropertiesFile = rootProject.file('../keystore.properties')
def keystoreProperties = new Properties()
def releaseSigningError = null

if (!keystorePropertiesFile.exists()) {
    releaseSigningError = "keystore.properties not found at ${keystorePropertiesFile.canonicalPath}"
} else {
    keystorePropertiesFile.withInputStream { keystoreProperties.load(it) }
    def missingKeys = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'].findAll {
        !keystoreProperties.getProperty(it)?.trim()
    }
    if (missingKeys) {
        releaseSigningError = "keystore.properties is missing or has an empty value for: ${missingKeys.join(', ')}"
    } else {
        def resolvedStore = rootProject.file('../' + keystoreProperties.getProperty('storeFile').trim())
        if (!resolvedStore.exists()) {
            releaseSigningError = "keystore file not found at ${resolvedStore.canonicalPath} (storeFile in keystore.properties)"
        }
    }
}

// Hard-fail, but ONLY when a release task is actually in the task graph, so debug
// builds still work on a machine with no keystore. Configuration-time throws would
// break `npx expo run:android` too.
gradle.taskGraph.whenReady { taskGraph ->
    if (releaseSigningError != null && taskGraph.allTasks.any { it.name =~ /(?i)release/ }) {
        throw new GradleException(
            "Release signing is not configured: ${releaseSigningError}.\n" +
            "See RELEASE-SIGNING.md for the keystore.properties template.\n" +
            "Refusing to fall back to debug signing -- that would produce an installable but wrongly-signed APK."
        )
    }
}
```

`rootProject` for this build is `<repo>/android`, because the settings file is
`android/settings.gradle`. So `rootProject.file('../keystore.properties')`
resolves to the repo root.

### 3b. A `release` entry inside `signingConfigs`

Anchor: the template's `signingConfigs { debug { … } }`. Add `release` after the
closing brace of `debug`, still inside `signingConfigs`. **Leave `debug`
untouched.**

```gradle
        release {
            // Populated only when keystore.properties is present and complete.
            // If it is not, this stays empty, the release buildType below gets NO
            // signing config -- an UNSIGNED apk, never a debug-signed one -- and the
            // taskGraph.whenReady guard above throws before execution regardless.
            if (releaseSigningError == null) {
                storeFile rootProject.file('../' + keystoreProperties.getProperty('storeFile').trim())
                storePassword keystoreProperties.getProperty('storePassword')
                keyAlias keystoreProperties.getProperty('keyAlias')
                keyPassword keystoreProperties.getProperty('keyPassword')
            }
        }
```

### 3c. Repoint the `release` buildType

Inside `buildTypes { release { … } }`, **replace** these three template lines:

```gradle
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
```

**with:**

```gradle
            // Signed from keystore.properties via signingConfigs.release (AD30).
            // NEVER point this at signingConfigs.debug -- that is the template default
            // and it emits an installable debug-signed "release" APK. See RELEASE-SIGNING.md.
            signingConfig releaseSigningError == null ? signingConfigs.release : null
```

Nothing else in `buildTypes.release` changes — `shrinkResources`,
`minifyEnabled`, `proguardFiles` and `crunchPngs` keep their template values,
and `buildTypes.debug` is not touched at all.

## 4. If the signing block is missing

**Reach for the plugin first. The hand edit is the last resort, not the first.**

1. `git status --porcelain` — confirm the keystore and `keystore.properties`
   do **not** appear. If either does, stop and fix `.gitignore` first.
2. Confirm `keystore.properties` exists at the repo root and is filled in (§2).
3. Confirm `app.json`'s `plugins` array still ends with
   `"./plugins/withReleaseSigning"`. If it does not, that is the whole bug.
4. Run `npx expo prebuild --platform android --no-clean` (§7 step 2) and
   verify with §5. The plugin regenerates the block.
5. **Only if the plugin itself is broken or absent** — and it should be fixed
   rather than bypassed — open `android/app/build.gradle` and apply §3a, §3b,
   §3c at their anchors, then verify with §5. A hand edit made here is invisible
   to `npm run check` and will be overwritten by the next prebuild that runs
   with a working plugin.

If the prebuild fails with `withReleaseSigning: anchor "…" matched 0 time(s)`,
the Expo template has changed shape. **Fix the plugin's anchors** — do not
hand-edit around it, because the next fresh checkout gets no hand edit.

## 5. Verifying the result

Confirm the plugin's three blocks are present in the generated file:

```sh
grep -n "signingConfigs.release\|releaseSigningError" android/app/build.gradle
```

After a release build, confirm the APK is **not** debug-signed:

```sh
apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
```

A debug-signed artifact reports
`CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US`. Seeing
that means the signing config never reached the generated project and the build
fell back to the template default. Work through §4 — the usual cause is the
plugin missing from `app.json`'s `plugins` array, not a lost hand edit.

## 6. What a successful release build does and does not establish

Stated here so a green build is not read as covering more than it does.

- **`minifyEnabled` is `false`.** `android/app/build.gradle` derives it from
  `findProperty('android.enableMinifyInReleaseBuilds') ?: false`, and that
  property is absent from `android/gradle.properties`. **R8/Proguard is not
  exercised.**
- **Hermes bytecode precompilation *is* exercised** (`hermesEnabled=true` in
  `android/gradle.properties`). That is the genuinely new surface relative to
  every debug-build observation this repo holds.
- The APK is **universal across four ABIs** — `armeabi-v7a, arm64-v8a, x86,
  x86_64`, with no split configured. Fine for manual install; it is just large.

See FINDINGS **AF26 point 3** and **AF27** for the release-mode evidence gap as
it was originally stated, and **AF42** for how much of it is now closed. AF42
records the first release-mode evidence this repo has ever held, and it splits
the gap in two: the **Hermes half is CLOSED** — release-mode bytecode
precompilation works on the project owner's device, where every prior
observation was a debug build — while the **R8/Proguard half is NOT**, because
`minifyEnabled` is `false` for the reason given above, so R8 never ran. A green
release build is evidence for the first half only. AF42 also narrows rather than
closes ABI coverage: the APK ships four ABIs and exactly one was exercised.

## 7. The full release build sequence

**Run these in order, every release.** Rationale for each step, and for the
alternatives rejected, is **AD36** — not restated here.

1. **Bump `expo.android.versionCode` in `app.json`.** It is a plain integer
   field, no scheme, no suffix. Bump it by exactly 1 from whatever is
   currently installed on the target device's `applicationId`
   (`com.arishh.readingaid`) — Android refuses to install an update whose
   `versionCode` is not strictly greater than what is already installed,
   **for that same `applicationId`**. A different `applicationId` (a UAT
   build, once one exists) tracks its own `versionCode` sequence
   independently; there is no shared counter to reconcile (AD36).

2. **`npx expo prebuild --platform android --no-clean`.**
   **`--no-clean` is still not optional, but the reason has changed.** It is no
   longer protecting the signing block — AD38's plugin regenerates that either
   way. Keep it because a bare `npx expo prebuild` is **clean by default** in
   SDK 57 (`prebuild/index.js:112`, `clean: !args['--no-clean']`) and **deletes
   and regenerates `android/` outright**, which discards the Gradle build caches
   and anything else under `android/` that is not reproduced by a config plugin.
   Today the signing block is the only thing that was ever hand-edited there —
   measured for AF50, 53 of 54 non-build files in one generation-minute and
   exactly one later — but *no other hand edits exist today* is not the same
   claim as *a clean prebuild is safe*, and this step is not the place to find
   out. `--no-clean` reuses the existing directory and lets config-plugin mods
   — including the one that writes `versionCode`, and this repo's own signing
   plugin — transform the existing files in place.

3. **Verify the signing block is present.** This is a verification, not a
   restore. `--no-clean` reuses `build.gradle`, and the plugin recognises its
   own previous output and returns it unchanged, so nothing should have moved.
   Confirm with §5's `grep`. If it is missing, work through §4 — and treat it
   as a plugin bug rather than something to patch by hand, because the next
   fresh checkout gets no patch.

4. **Build.** `cd android && ./gradlew assembleRelease`, then verify with §5
   that the output is signed with the release key, not the debug one.

**The trap this sequence exists to name.** `npx expo run:android` **skips
prebuild entirely when `android/` already exists**
(`ensureNativeProject.js:40` checks `fs.existsSync` and returns immediately if
true). So bumping `app.json`'s `versionCode` and then running
`npx expo run:android` — the ordinary development command — **changes
nothing on disk**: `android/app/build.gradle` keeps whatever `versionCode` the
last prebuild wrote, silently. **Step 2 above is not skippable by using the
everyday dev loop instead.** There is no error, no warning, and no visible
sign that the bump did not take effect — the only way to notice is to read
`android/app/build.gradle:142` or run `aapt dump badging` on the output and
find the old number.
