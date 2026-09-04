/**
 * Dynamic Expo config — the UAT variant overlay.
 *
 * WHY THIS FILE EXISTS, and every judgment call in it, is DECISIONS.md AD37.
 * The measurements it rests on are FINDINGS.md AF48. Neither is restated here
 * (AD18). This file states only what the code does.
 *
 * HOW IT IS REACHED. `app.json` stays the base and is NOT replaced: Expo
 * resolves `./app.config` ahead of the static config and passes the static one
 * in as `request.config` (`@expo/config/build/Config.js:291-296`). `.ts` is
 * first in `DYNAMIC_CONFIG_EXTS` (`Config.js:326`), so this file wins over any
 * `app.config.js`. The export is called as `result(request)`
 * (`evalConfig.js:68-70`).
 *
 * THE UNSET PATH RETURNS `config` BY REFERENCE, DELIBERATELY. Expo stamps a
 * `Symbol('non-standard')` marker onto the object it hands in and then checks
 * whether the returned object still carries it, reporting
 * `mayHaveUnusedStaticConfig` when it does not (`evalConfig.js:59-62`,
 * `:79-81`). Returning the same reference keeps that marker, so tooling such as
 * `expo-doctor` does not warn that the static config went unused. Returning a
 * fresh object — even a faithful copy — would be a behaviour change, not a
 * stylistic one.
 *
 * TYPES ARE STRUCTURAL AND DECLARED INLINE. `ExpoConfig` from
 * `@expo/config-types` is deliberately NOT imported: it is a transitive,
 * unpinned dependency (AD37).
 *
 * THIS FILE MUST STAY ERASABLE TYPESCRIPT — no `enum`, no `namespace`, no
 * parameter properties, no value-position type imports. It is loaded by
 * `typescript`'s `transpileModule` when that API is present and by Node's
 * `module.stripTypeScriptTypes` when it is not
 * (`@expo/require-utils/build/load.js:316` and `:335-341`), and the second
 * accepts only erasable syntax. `tsc` does NOT enforce this, so
 * `app.config-headless-test.mjs` does — it runs the real stripper over this
 * file's own source.
 */

/** Only the fields this overlay reads or writes are named; the rest ride through. */
type AdaptiveIcon = {
  backgroundColor?: string;
  foregroundImage?: string;
  backgroundImage?: string;
  monochromeImage?: string;
  [key: string]: unknown;
};

type AndroidConfig = {
  package?: string;
  /** Android's versionName. Overrides the root `version` (`Version.js:63-65`). */
  version?: string;
  versionCode?: number;
  adaptiveIcon?: AdaptiveIcon;
  [key: string]: unknown;
};

type StaticConfig = {
  name?: string;
  scheme?: string | string[];
  android?: AndroidConfig;
  [key: string]: unknown;
};

/** The shape Expo calls the default export with. Only `config` is read here. */
type ConfigContext = {
  config: StaticConfig;
};

/**
 * The two environment variables this file reads. They are accessed as LITERAL
 * `process.env.NAME` properties below rather than through these constants:
 * `eslint-plugin-expo`'s `no-dynamic-env-var` rule forbids computed access,
 * because Expo inlines env vars statically and a computed key cannot be seen.
 * The names are kept here so the two that matter are findable in one place.
 *
 * - `READING_AID_UAT`   — any truthy value resolves the UAT variant.
 * - `UAT_VERSION_CODE`  — optional deterministic versionCode override.
 */
const VERSION_CODE_ENV = 'UAT_VERSION_CODE';

/**
 * The UAT identity. Every value here differs from `app.json` on purpose:
 *
 * - `package` is what makes a side-by-side install possible at all. Android
 *   keys an installed app — and its versionCode sequence — by applicationId.
 * - `scheme` differs because two installed apps claiming `readingaidandroid`
 *   produce a deep-link disambiguation chooser (AF47). This is a defect fix.
 * - `iconBackgroundColor` reaches the launcher ONLY because the overlay drops
 *   `backgroundImage`; a background image otherwise wins outright
 *   (`withAndroidIcons.js:239`). See AF48.
 */
const UAT = {
  name: 'BETA Reading Aid',
  scheme: 'readingaiduat',
  androidPackage: 'com.arishh.readingaid.uat',
  androidVersionName: '1.0.0-uat',
  iconBackgroundColor: '#FFEB3B',
} as const;

/** Android's own ceiling is int32; 2.1e9 is the lower, stricter Play limit. */
const MAX_VERSION_CODE = 2100000000;

function isUatBuild(): boolean {
  const raw = process.env.READING_AID_UAT;
  if (raw === undefined) return false;
  const value = raw.trim().toLowerCase();
  return value !== '' && value !== '0' && value !== 'false';
}

/**
 * UAT versionCode: the `UAT_VERSION_CODE` override when set, otherwise whole
 * minutes since the Unix epoch.
 *
 * The clock default exists so that successive local UAT builds install over one
 * another with no human step — a constant would reproduce the upgrade failure
 * AD36 was written to prevent, and an override alone relies on remembering to
 * bump it. Minutes rather than seconds: seconds leave under a decade of
 * headroom below `MAX_VERSION_CODE`, minutes leave millennia (AF48).
 *
 * KNOWN LIMIT: two prebuilds inside the same wall-clock minute produce the SAME
 * versionCode, and the second APK will not install over the first. Use the
 * override if that happens.
 *
 * An unusable override THROWS rather than falling back to the clock: silently
 * substituting a different number for the one that was asked for is the
 * silent-wrong-artifact class of failure AD30 exists to prevent.
 */
function uatVersionCode(): number {
  const raw = process.env.UAT_VERSION_CODE;
  if (raw !== undefined && raw.trim() !== '') {
    const parsed = Number(raw.trim());
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_VERSION_CODE) {
      throw new Error(
        `${VERSION_CODE_ENV} must be an integer between 1 and ${MAX_VERSION_CODE}; got "${raw}".`,
      );
    }
    return parsed;
  }
  return Math.floor(Date.now() / 60000);
}

export default ({ config }: ConfigContext): StaticConfig => {
  if (!isUatBuild()) {
    // By reference, not a copy. See the docblock.
    return config;
  }

  const android: AndroidConfig = config.android ?? {};

  // `backgroundImage` is omitted rather than overwritten: while it is present it
  // is the adaptive icon's background layer and `backgroundColor` is written to
  // colors.xml but referenced by nothing (withAndroidIcons.js:239, AF48).
  // `ignoreRestSiblings` is why the discarded binding is not an unused-var error.
  const { backgroundImage: _droppedForYellowBackground, ...carriedIcon } =
    android.adaptiveIcon ?? {};

  return {
    ...config,
    name: UAT.name,
    scheme: UAT.scheme,
    android: {
      ...android,
      package: UAT.androidPackage,
      version: UAT.androidVersionName,
      versionCode: uatVersionCode(),
      adaptiveIcon: {
        ...carriedIcon,
        backgroundColor: UAT.iconBackgroundColor,
      },
    },
  };
};
