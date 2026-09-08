/**
 * Expo config plugin — release signing for android/app/build.gradle.
 *
 * WHY THIS FILE EXISTS, and every judgment call in it, is DECISIONS.md AD38.
 * The measurements it rests on are FINDINGS.md AF50. Neither is restated here
 * (AD18). This file states only what the code does.
 *
 * WHAT IT REPLACES. The signing configuration used to be a hand edit applied to
 * the generated, gitignored android/app/build.gradle, with RELEASE-SIGNING.md
 * §3 holding a prose copy so a human could put it back. That works on a machine
 * where someone has already done it once. It does not work anywhere else: a
 * fresh checkout has no android/ at all, so prebuild regenerates from the stock
 * template, whose `release { signingConfig signingConfigs.debug }` makes
 * assembleRelease SUCCEED and emit a debug-signed "release" APK (AF47, AF49).
 * Generation, not restoration, is what makes that unreachable.
 *
 * THE GRADLE SEMANTICS ARE UNCHANGED — AD30's design is preserved byte for
 * byte, and that is the point rather than a coincidence. The three constants
 * below reproduce the hand-edited file exactly, so AF42's device evidence still
 * describes the artifact this plugin generates. Only the delivery changed.
 *
 * MOD ORDERING. Expo's own appBuildGradle mods are Package.withPackageGradle,
 * Version.withVersion and GoogleServices.withApplyPlugin; none of the three
 * touches signingConfigs or buildTypes, so the field is uncontested (AF47,
 * re-verified at @expo/config-plugins@57.0.9 for AF50). withMod runs its action
 * and then calls nextMod (withMod.js:197-202), so the last-registered mod runs
 * first; user plugins are registered before the built-ins, so this one runs
 * LAST and sees a fully identity-resolved file. Nothing downstream can undo it.
 *
 * THIS FILE MUST STAY ERASABLE TYPESCRIPT — no `enum`, no `namespace`, no
 * parameter properties, no value-position type imports. Expo resolves a `.ts`
 * plugin through plugin-resolver.js:39 and loads it with @expo/require-utils'
 * loadModuleSync (:136), which is the SAME two-transpiler path app.config.ts
 * takes: typescript's transpileModule when present, Node's
 * module.stripTypeScriptTypes when it is not. The second accepts only erasable
 * syntax. `tsc` does not enforce this and the primary loader accepts an `enum`
 * quite happily, so the failure would appear only on a machine that took the
 * fallback — which is why withReleaseSigning-headless-test.mjs runs the real
 * stripper over this file's own source. See AF50.
 */

import { withAppBuildGradle } from '@expo/config-plugins';

/**
 * Types are STRUCTURAL and declared here rather than imported.
 * `@expo/config-plugins` is a transitive, unpinned dependency — no direct
 * dependency of this repo declares it (AF50) — so typing every USE against a
 * local declaration keeps this file's typecheck from being hostage to a package
 * nothing here controls. That is AD37's reasoning for `@expo/config-types`,
 * applied to the one import a config plugin cannot avoid making at runtime.
 */
type AppBuildGradleModResults = {
  /** 'groovy' | 'kt'. The transform below is Groovy-only and says so. */
  language: string;
  contents: string;
};

type AppBuildGradleConfig = {
  modResults: AppBuildGradleModResults;
  [key: string]: unknown;
};

type ExpoConfigLike = {
  [key: string]: unknown;
};

type WithAppBuildGradle = (
  config: ExpoConfigLike,
  action: (config: AppBuildGradleConfig) => AppBuildGradleConfig,
) => ExpoConfigLike;

const withAppBuildGradleTyped = withAppBuildGradle as unknown as WithAppBuildGradle;

/* ─── The three edits, verbatim ──────────────────────────────────────────────
 *
 * These reproduce RELEASE-SIGNING.md §3a/§3b/§3c byte for byte, and the suite
 * asserts exactly that against a committed copy of the stock template.
 * Backticks and dollar-brace sequences inside the Gradle text are escaped for
 * the TypeScript template literal and are NOT part of the emitted bytes.
 */

/** §3a — inserted immediately before the top-level `android {` block. */
const SIGNING_PREAMBLE = `/* ---------------------------------------------------------------------------
 * Reading Aid release signing. See RELEASE-SIGNING.md and DECISIONS.md AD30.
 *
 * Credentials are read from keystore.properties at the REPO ROOT, which is
 * gitignored and must never be committed. This file lives inside the generated
 * android/ directory, which is ALSO gitignored -- RELEASE-SIGNING.md holds the
 * verbatim copy of this block so it can be restored after \`npx expo prebuild\`.
 *
 * There is deliberately NO fallback to debug signing. The Expo template shipped
 * \`release { signingConfig signingConfigs.debug }\`, which makes assembleRelease
 * succeed and emit an installable DEBUG-SIGNED "release" APK -- a wrong artifact
 * that surfaces only later, as an install-time signature mismatch.
 * ------------------------------------------------------------------------- */
def keystorePropertiesFile = rootProject.file('../keystore.properties')
def keystoreProperties = new Properties()
def releaseSigningError = null

if (!keystorePropertiesFile.exists()) {
    releaseSigningError = "keystore.properties not found at \${keystorePropertiesFile.canonicalPath}"
} else {
    keystorePropertiesFile.withInputStream { keystoreProperties.load(it) }
    def missingKeys = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'].findAll {
        !keystoreProperties.getProperty(it)?.trim()
    }
    if (missingKeys) {
        releaseSigningError = "keystore.properties is missing or has an empty value for: \${missingKeys.join(', ')}"
    } else {
        def resolvedStore = rootProject.file('../' + keystoreProperties.getProperty('storeFile').trim())
        if (!resolvedStore.exists()) {
            releaseSigningError = "keystore file not found at \${resolvedStore.canonicalPath} (storeFile in keystore.properties)"
        }
    }
}

// Hard-fail, but ONLY when a release task is actually in the task graph, so debug
// builds still work on a machine with no keystore. Configuration-time throws would
// break \`npx expo run:android\` too.
gradle.taskGraph.whenReady { taskGraph ->
    if (releaseSigningError != null && taskGraph.allTasks.any { it.name =~ /(?i)release/ }) {
        throw new GradleException(
            "Release signing is not configured: \${releaseSigningError}.\\n" +
            "See RELEASE-SIGNING.md for the keystore.properties template.\\n" +
            "Refusing to fall back to debug signing -- that would produce an installable but wrongly-signed APK."
        )
    }
}`;

/** §3b — appended inside `signingConfigs`, after the template's `debug` block. */
const RELEASE_SIGNING_CONFIG = `        release {
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
        }`;

/** §3c — replaces the template's three-line release signingConfig. */
const RELEASE_BUILD_TYPE = `            // Signed from keystore.properties via signingConfigs.release (AD30).
            // NEVER point this at signingConfigs.debug -- that is the template default
            // and it emits an installable debug-signed "release" APK. See RELEASE-SIGNING.md.
            signingConfig releaseSigningError == null ? signingConfigs.release : null`;

/* ─── The three anchors ──────────────────────────────────────────────────────
 *
 * Each is measured unique in the stock template. Each must match EXACTLY ONCE
 * or the transform throws: a config plugin that silently no-ops re-emits the
 * template default, which is an installable debug-signed release APK — the
 * failure AD30 exists to prevent, reached a different way.
 */

const ANCHOR_ANDROID_BLOCK = '\nandroid {\n';

/** The template's signingConfigs block, up to and including the debug entry. */
const STOCK_SIGNING_CONFIGS_HEAD = [
  '    signingConfigs {',
  '        debug {',
  "            storeFile file('debug.keystore')",
  "            storePassword 'android'",
  "            keyAlias 'androiddebugkey'",
  "            keyPassword 'android'",
  '        }',
].join('\n');

/**
 * Anchor and replacement are built from one shared head so they cannot drift
 * apart, and by concatenation rather than String.replace so that no dollar
 * sequence in the Gradle text could ever be read as a substitution pattern.
 * (That hazard is not hypothetical: it corrupted an editing script during this
 * plugin's own development. See AF50.)
 */
const ANCHOR_SIGNING_CONFIGS = `${STOCK_SIGNING_CONFIGS_HEAD}\n    }\n`;

const SIGNING_CONFIGS_REPLACEMENT = `${STOCK_SIGNING_CONFIGS_HEAD}\n${RELEASE_SIGNING_CONFIG}\n    }\n`;

/**
 * THE TWO COMMENT LINES ARE LOAD-BEARING, NOT DECORATION.
 * `signingConfig signingConfigs.debug` occurs TWICE in the stock template — once
 * here in buildTypes.release, which is the defect, and once in buildTypes.debug,
 * where it is CORRECT and must survive untouched. Anchoring on the bare
 * statement would match both and would silently break debug signing. Anyone
 * rewriting this plugin must keep the anchor disambiguated.
 */
const ANCHOR_RELEASE_BUILD_TYPE = [
  '            // Caution! In production, you need to generate your own keystore file.',
  '            // see https://reactnative.dev/docs/signed-apk-android.',
  '            signingConfig signingConfigs.debug',
  '',
].join('\n');

const DOC = 'See RELEASE-SIGNING.md §3 and DECISIONS.md AD38.';

function replaceExactlyOnce(
  contents: string,
  anchor: string,
  replacement: string,
  label: string,
): string {
  const parts = contents.split(anchor);
  if (parts.length !== 2) {
    throw new Error(
      `withReleaseSigning: anchor "${label}" matched ${parts.length - 1} time(s) in ` +
        `android/app/build.gradle; exactly 1 was required. The Expo template has ` +
        `probably changed shape. Refusing to continue: a plugin that gives up quietly ` +
        `here leaves the template default in place, and that emits an installable ` +
        `DEBUG-SIGNED "release" APK. ${DOC}`,
    );
  }
  return parts[0] + replacement + parts[1];
}

/**
 * Rewrite the app's build.gradle to sign release builds from keystore.properties.
 *
 * Three outcomes, deliberately, rather than two:
 *
 *  1. ALREADY APPLIED  -> returned unchanged. This is not a nicety. A release
 *     runs `expo prebuild --no-clean` (AD36 §7), which reuses the existing
 *     build.gradle, so this mod re-runs on its own previous output every time.
 *     A transform that only knew "apply" and "throw" would fail every release.
 *  2. NOT APPLIED, all three anchors present exactly once -> applied.
 *  3. ANYTHING ELSE — an anchor missing, an anchor ambiguous, or a partially
 *     applied file -> throws. Loudly, because the quiet alternative ships a
 *     wrongly-signed artifact.
 */
export function transformAppBuildGradle(contents: string): string {
  const present = [
    contents.includes(SIGNING_PREAMBLE),
    contents.includes(RELEASE_SIGNING_CONFIG),
    contents.includes(RELEASE_BUILD_TYPE),
  ];
  const appliedCount = present.filter(Boolean).length;

  if (appliedCount === present.length) {
    // Case 1. Belt and braces: fully applied AND the template default still
    // present means someone hand-edited the file into a state where the release
    // buildType could still be pointed at debug signing. Never guess past that.
    if (contents.includes(ANCHOR_RELEASE_BUILD_TYPE)) {
      throw new Error(
        'withReleaseSigning: android/app/build.gradle already carries the release ' +
          'signing configuration AND still contains the template default ' +
          '`signingConfig signingConfigs.debug` in buildTypes.release. That file has ' +
          `been hand-edited into an inconsistent state. ${DOC}`,
      );
    }
    return contents;
  }

  if (appliedCount !== 0) {
    // Case 3, partial. Applying the missing pieces would be guesswork.
    throw new Error(
      `withReleaseSigning: android/app/build.gradle is PARTIALLY configured for ` +
        `release signing (${appliedCount} of ${present.length} blocks present). ` +
        `Refusing to repair it by guesswork — delete android/ and prebuild again. ${DOC}`,
    );
  }

  // Case 2.
  let out = contents;
  out = replaceExactlyOnce(
    out,
    ANCHOR_ANDROID_BLOCK,
    `\n${SIGNING_PREAMBLE}\n${ANCHOR_ANDROID_BLOCK}`,
    'android-block',
  );
  out = replaceExactlyOnce(out, ANCHOR_SIGNING_CONFIGS, SIGNING_CONFIGS_REPLACEMENT, 'signing-configs');
  out = replaceExactlyOnce(
    out,
    ANCHOR_RELEASE_BUILD_TYPE,
    `${RELEASE_BUILD_TYPE}\n`,
    'release-build-type',
  );
  return out;
}

const withReleaseSigning = (config: ExpoConfigLike): ExpoConfigLike =>
  withAppBuildGradleTyped(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error(
        `withReleaseSigning: android/app/build.gradle is ` +
          `"${gradleConfig.modResults.language}", not Groovy. This plugin's anchors are ` +
          `Groovy text and it will not guess at another dialect. ${DOC}`,
      );
    }
    gradleConfig.modResults.contents = transformAppBuildGradle(gradleConfig.modResults.contents);
    return gradleConfig;
  });

export default withReleaseSigning;

/**
 * The four Gradle blocks, exported for the suite alone — nothing in the plugin
 * path reads this.
 *
 * RELEASE-SIGNING.md §3 keeps a prose copy of these blocks as a fallback, which
 * is a second copy of the same text with no mechanism keeping the two in step —
 * exactly the unguarded duplication PORT-PLAN.md §5.1 diagnoses in F-PRESETS-5,
 * and which this repo has recorded drifting three times (AD2, AF8, AD26). The
 * suite closes that by asserting the document's fenced blocks against these
 * constants, so the fallback cannot quietly stop describing what is generated.
 */
export const SIGNING_BLOCKS = {
  preamble: SIGNING_PREAMBLE,
  releaseSigningConfig: RELEASE_SIGNING_CONFIG,
  templateReleaseBuildType: ANCHOR_RELEASE_BUILD_TYPE.replace(/\n$/, ''),
  releaseBuildType: RELEASE_BUILD_TYPE,
};
