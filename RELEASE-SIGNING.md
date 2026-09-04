# Release build procedure and signing recovery record

> **Purpose: this file covers the release build end to end, and the signing
> half is the reason it exists.** `android/` is gitignored (`.gitignore:46`),
> so the release signing configuration in `android/app/build.gradle` exists
> nowhere in git and has no history to restore from — a bare `npx expo
> prebuild` deletes it with no diff left behind. §§2–6 are that recovery
> record: everything needed to put the signing block back, verbatim. §7 is
> broader — the full sequence a release build actually requires, of which
> restoring the signing block (when a prebuild has destroyed it) is one step
> among several. It belongs in this file rather than a separate one because
> the other step that matters, bumping `versionCode`, drives the **same**
> prebuild that can destroy signing (AD36), so the two share one
> "prebuild-destroys-things" narrative rather than needing to cross-reference
> two documents on every release.
>
> This document is **mutable** — it must always describe the configuration and
> procedure that are live right now. If either changes, change it here in the
> same edit.
>
> **Why the signing approach was chosen** — over an Expo config plugin, and why
> the conventional `exists()`-fallback pattern was rejected — is **not**
> restated here. It is **AD30** in [DECISIONS.md](DECISIONS.md). The evidence
> from the prebuild that preceded it is **AF41** in [FINDINGS.md](FINDINGS.md).
> **Why `versionCode` is set in `app.json` rather than edited directly in
> `android/app/build.gradle`, and why a product flavour and a config plugin
> were both rejected**, is likewise not restated here — it is **AD36**.
>
> **No credential appears in this file, and none ever may.** Passwords and the
> key alias live only in `keystore.properties`, which is gitignored.

---

## 1. When you need this

Run the restore in §4 after **any** of these:

| Action | Effect on the signing config |
|---|---|
| `npx expo run:android` | **Safe** — skips prebuild entirely when `android/` exists |
| `npx expo prebuild --no-clean` | **Safe** — reuses the existing `android/` |
| `npx expo prebuild` | **DESTROYED** — `clean` is the default in SDK 57 |
| deleting `android/` by hand | **DESTROYED** |

There is no warning when it is destroyed. The dirty-git guard cannot fire,
because `android/` is gitignored and so never shows as dirty.

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

## 3. The three edits to `android/app/build.gradle`

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

## 4. Restore procedure

1. `git status --porcelain` — confirm the keystore and `keystore.properties`
   do **not** appear. If either does, stop and fix `.gitignore` first.
2. Confirm `keystore.properties` exists at the repo root and is filled in (§2).
3. Open `android/app/build.gradle` and apply §3a, §3b, §3c at their anchors.
4. Verify with §5.

## 5. Verifying the result

Confirm the three edits are present:

```sh
grep -n "signingConfigs.release\|releaseSigningError" android/app/build.gradle
```

After a release build, confirm the APK is **not** debug-signed:

```sh
apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
```

A debug-signed artifact reports
`CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US`. Seeing
that means the signing config was lost and the build fell back to the
template default — restore from §3 and rebuild.

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
   **`--no-clean` is not optional.** A bare `npx expo prebuild` is **clean by
   default** in SDK 57 (`prebuild/index.js:112`, `clean: !args['--no-clean']`)
   and **deletes and regenerates `android/` outright**, taking the §§2–6
   signing block with it. `--no-clean` reuses the existing directory and lets
   config-plugin mods — including the one that writes `versionCode` into
   `android/app/build.gradle` — transform the existing files in place.

3. **Check whether the signing block survived.** `--no-clean` reuses
   `build.gradle` rather than regenerating it from the template, so the
   signing block is **not** touched by this step in the ordinary case. Verify
   with §5's `grep`; if it is gone, restore it with §4 before continuing.

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
