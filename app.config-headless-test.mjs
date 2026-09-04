/**
 * Headless checks for the UAT config overlay (the fourteenth suite).
 *
 * esbuild-bundles the REAL app.config.ts and calls its default export. That
 * file imports nothing, so this suite needs no Expo, React Native or DOM stub.
 *
 * WHY THIS SUITE EXISTS. app.config.ts computes the app's IDENTITY — launcher
 * name, applicationId, scheme, versionName, versionCode. A defect in it is
 * silent in every direction that matters: `tsc` proves the shape and says
 * nothing about the values, and the overlay's whole contract is that it does
 * NOTHING at all unless one environment variable is set. A file that quietly
 * started rewriting release identity would typecheck, lint, and ship. That is
 * the AF14 gap the `.ts` choice was made to close, and typechecking alone does
 * not close it (AD37).
 *
 * The load-bearing assertion is the INERT one: with READING_AID_UAT unset, the
 * resolved config must equal app.json for every field the overlay touches — and
 * must be the SAME OBJECT REFERENCE that was passed in. That reference identity
 * is not a style preference. Expo stamps a Symbol marker onto the object it
 * hands the config function and warns `mayHaveUnusedStaticConfig` if the
 * returned object has lost it (evalConfig.js:59-62, :79-81). A well-meaning
 * refactor to `return { ...config }` would keep every check below green except
 * that one.
 *
 * TWO LOADERS ARE EXERCISED, NOT ONE. Expo loads a `.ts` config through
 * `typescript`'s transpileModule when that API exists and falls back to Node's
 * `module.stripTypeScriptTypes` when it does not (require-utils load.js:316 and
 * :335-341) — and TypeScript 7 removes transpileModule, which Expo's own source
 * comment at load.js:77-79 anticipates. The fallback accepts ONLY erasable
 * TypeScript: no `enum`, no `namespace`, no parameter properties. `tsc` does not
 * enforce erasability, so nothing but this suite would catch an `enum` added
 * later — and the failure would appear only on a machine that took the fallback
 * path. So the real stripper is run over the real source, and both loaders'
 * resolved configs are compared against each other. See AF48.
 */

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// stripTypeScriptTypes is flagged experimental and warns when it is first
// reached. Node installs its own stderr printer as a 'warning' listener at
// startup and an added listener does NOT displace it, so the default one is
// removed first. Everything other than this one warning is re-printed
// unchanged. The handler must be in place BEFORE node:module is reached, and
// static ESM imports hoist above module-body code -- hence the dynamic import.
process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.name !== 'ExperimentalWarning' || !/stripTypeScriptTypes/.test(w.message)) {
    console.warn(w);
  }
});

const { stripTypeScriptTypes } = await import('node:module');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_TS = path.join(__dirname, 'app.config.ts');
const APP_JSON = path.join(__dirname, 'app.json');

/** Write `code` beside this suite, import it, and always clean up. */
async function importCode(code, tag) {
  const tmpPath = path.join(__dirname, `.headless-appconfig-${tag}-${process.pid}.mjs`);
  await writeFile(tmpPath, code);
  try {
    return await import(`${tmpPath}?t=${Date.now()}`);
  } finally {
    await unlink(tmpPath);
  }
}

const source = await readFile(CONFIG_TS, 'utf8');

// Loader 1 — esbuild, standing in for typescript's transpileModule.
const bundled = await build({
  entryPoints: [CONFIG_TS],
  bundle: true,
  write: false,
  format: 'esm',
  target: 'node18',
  platform: 'node',
});
const viaEsbuild = (await importCode(bundled.outputFiles[0].text, 'esbuild')).default;

// Loader 2 — Node's native stripper, the real fallback path. If app.config.ts
// ever stops being erasable, this throws and the suite fails here.
let strippedSource = null;
let strippedError = null;
try {
  strippedSource = stripTypeScriptTypes(source);
} catch (err) {
  strippedError = err;
}
const viaStripper = strippedSource === null
  ? null
  : (await importCode(strippedSource, 'stripped')).default;

const appJson = JSON.parse(await readFile(APP_JSON, 'utf8'));
/** The static config exactly as app.json declares it. Never mutated. */
const PRISTINE = appJson.expo;

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    console.log(`  PASS  ${label}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${label}: ${err.message}`);
    failed++;
  }
}

function ok(label, cond, msg) {
  try {
    assert.ok(cond, msg);
    console.log(`  PASS  ${label}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${label}: ${err.message}`);
    failed++;
  }
}

/** Resolve the overlay under an exact environment, restoring it afterwards. */
function resolve(env, { loader = viaEsbuild, base } = {}) {
  const saved = {
    READING_AID_UAT: process.env.READING_AID_UAT,
    UAT_VERSION_CODE: process.env.UAT_VERSION_CODE,
  };
  for (const key of Object.keys(saved)) delete process.env[key];
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  try {
    const config = base ?? structuredClone(PRISTINE);
    return { config, result: loader({ config }) };
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

const UAT_ON = { READING_AID_UAT: '1' };
/** A pinned versionCode, so UAT resolutions are comparable to one another. */
const UAT_PINNED = { READING_AID_UAT: '1', UAT_VERSION_CODE: '424242' };

console.log('\napp.config UAT overlay — headless checks\n');

// ─── 1. Erasability, and the two loader paths ───────────────────────────────
{
  ok(
    'app.config.ts is ERASABLE TypeScript (node stripTypeScriptTypes accepts it)',
    strippedError === null,
    `stripTypeScriptTypes threw: ${strippedError && strippedError.message}`,
  );

  ok('both loader paths produced a callable default export',
    typeof viaEsbuild === 'function' && typeof viaStripper === 'function',
    `esbuild=${typeof viaEsbuild} stripper=${typeof viaStripper}`);

  if (typeof viaStripper === 'function') {
    check(
      'UNSET: the two loaders resolve identical configs',
      resolve({}, { loader: viaStripper }).result,
      resolve({}, { loader: viaEsbuild }).result,
    );
    check(
      'UAT: the two loaders resolve identical configs',
      resolve(UAT_PINNED, { loader: viaStripper }).result,
      resolve(UAT_PINNED, { loader: viaEsbuild }).result,
    );
  }
}

// ─── 2. INERT when READING_AID_UAT is unset ─────────────────────────────────
{
  const { config: input, result } = resolve({});

  ok(
    'UNSET: returns the SAME OBJECT REFERENCE it was given (keeps Expo’s marker)',
    result === input,
    'the overlay returned a copy; evalConfig would report mayHaveUnusedStaticConfig',
  );

  check('UNSET: name is app.json’s', result.name, PRISTINE.name);
  check('UNSET: scheme is app.json’s', result.scheme, PRISTINE.scheme);
  check('UNSET: android.package is app.json’s', result.android.package, PRISTINE.android.package);
  check('UNSET: android.versionCode is app.json’s', result.android.versionCode, PRISTINE.android.versionCode);
  check('UNSET: android.adaptiveIcon is app.json’s, all four fields', result.android.adaptiveIcon, PRISTINE.android.adaptiveIcon);

  ok(
    'UNSET: android.version stays ABSENT (app.json declares no versionName override)',
    !('version' in result.android),
    `android.version leaked in as ${JSON.stringify(result.android.version)}`,
  );

  check('UNSET: the WHOLE resolved config equals app.json’s expo block', result, PRISTINE);

  for (const [label, value] of [['empty', ''], ['0', '0'], ['false', 'false'], ['FALSE', 'FALSE']]) {
    const r = resolve({ READING_AID_UAT: value }).result;
    ok(
      `READING_AID_UAT="${label}" is treated as UNSET (release identity intact)`,
      r.android.package === PRISTINE.android.package && r.name === PRISTINE.name,
      `got package=${r.android.package} name=${r.name}`,
    );
  }
}

// ─── 3. The UAT identity ────────────────────────────────────────────────────
{
  const { result } = resolve(UAT_PINNED);

  check('UAT: name', result.name, 'BETA Reading Aid');
  check('UAT: scheme', result.scheme, 'readingaiduat');
  check('UAT: android.package', result.android.package, 'com.arishh.readingaid.uat');
  check('UAT: android.version (versionName)', result.android.version, '1.0.0-uat');
  check('UAT: adaptiveIcon.backgroundColor is yellow', result.android.adaptiveIcon.backgroundColor, '#FFEB3B');

  // The Q1 guard. While backgroundImage is present it IS the adaptive icon's
  // background layer and backgroundColor is written to colors.xml unreferenced
  // (withAndroidIcons.js:239). Re-adding the key silently un-yellows the icon.
  ok(
    'UAT: adaptiveIcon has NO backgroundImage key, so backgroundColor reaches the launcher',
    !('backgroundImage' in result.android.adaptiveIcon),
    'backgroundImage is present, so @color/iconBackground is referenced by nothing and the yellow is a no-op',
  );

  check('UAT: adaptiveIcon.foregroundImage is carried through', result.android.adaptiveIcon.foregroundImage, PRISTINE.android.adaptiveIcon.foregroundImage);
  check('UAT: adaptiveIcon.monochromeImage is carried through', result.android.adaptiveIcon.monochromeImage, PRISTINE.android.adaptiveIcon.monochromeImage);
  check('UAT: untouched android fields ride through (predictiveBackGestureEnabled)', result.android.predictiveBackGestureEnabled, PRISTINE.android.predictiveBackGestureEnabled);

  for (const key of ['slug', 'version', 'orientation', 'icon', 'userInterfaceStyle', 'ios', 'web', 'plugins', 'experiments']) {
    check(`UAT: top-level "${key}" rides through unchanged`, result[key], PRISTINE[key]);
  }

  ok(
    'UAT: does not mutate the config object it was handed',
    resolve(UAT_PINNED).config.android.package === PRISTINE.android.package,
    'the overlay mutated its input',
  );
}

// ─── 4. Side-by-side install depends entirely on the package differing ──────
{
  const release = resolve({}).result.android.package;
  const uat = resolve(UAT_PINNED).result.android.package;
  ok(
    'the two android.package values DIFFER (side-by-side install)',
    release !== uat,
    `both resolved to ${release}`,
  );
  ok(
    'the UAT package is a distinct id, not a suffix-free variant of release',
    uat === `${release}.uat`,
    `release=${release} uat=${uat}`,
  );
}

// ─── 5. versionCode: override, validation, and the clock default ────────────
{
  check('UAT: UAT_VERSION_CODE override is honoured verbatim', resolve(UAT_PINNED).result.android.versionCode, 424242);

  for (const bad of ['0', '-5', 'abc', '1.5', '2100000001']) {
    let threw = false;
    try {
      resolve({ READING_AID_UAT: '1', UAT_VERSION_CODE: bad });
    } catch {
      threw = true;
    }
    ok(
      `UAT_VERSION_CODE="${bad}" THROWS rather than silently falling back to the clock`,
      threw,
      'an unusable override was accepted',
    );
  }

  const clock = resolve(UAT_ON).result.android.versionCode;
  ok(
    'clock default is a positive integer below the 2.1e9 ceiling',
    Number.isInteger(clock) && clock > 0 && clock < 2100000000,
    `got ${clock}`,
  );

  // Monotonicity is the whole point: successive local UAT builds must install
  // over one another. Date.now is stubbed so this is deterministic rather than
  // a test that would have to wait a minute.
  const realNow = Date.now;
  try {
    Date.now = () => 1_800_000_000_000;
    const first = resolve(UAT_ON).result.android.versionCode;
    Date.now = () => 1_800_000_000_000 + 60_000;
    const second = resolve(UAT_ON).result.android.versionCode;
    Date.now = () => 1_800_000_000_000 + 59_999;
    const sameMinute = resolve(UAT_ON).result.android.versionCode;

    ok('clock default STRICTLY INCREASES one minute later', second > first, `${first} -> ${second}`);
    check('clock default advances by exactly 1 per minute', second - first, 1);
    ok(
      'KNOWN LIMIT, pinned deliberately: two builds in the same minute collide',
      sameMinute === first,
      `expected ${first}, got ${sameMinute}`,
    );
  } finally {
    Date.now = realNow;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
