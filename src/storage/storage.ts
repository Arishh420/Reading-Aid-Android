/**
 * Generic MMKV wrapper — the app's first and only persistence layer.
 * All keys are namespaced under STORAGE_PREFIX so future schema versions can
 * coexist with or migrate from the v1 layout.
 *
 * Ported from the web repo's src/storage/storage.ts, which is a localStorage
 * wrapper. Its docblock anticipated this port ("Designed to be thin and
 * swappable: the three public functions are the only calls that touch the
 * platform API, so an Android port can substitute AsyncStorage (or similar)
 * behind the same interface with minimal friction"), and AD6 settles the
 * engine as MMKV, synchronous. So ONLY the backing store changes here: the
 * exported surface — STORAGE_PREFIX, storageGet, storageSet, storageRemove —
 * keeps the web signatures and semantics exactly.
 *
 * Two differences from the web original, both forced by the platform:
 *
 *   1. MMKV 4's API is `createMMKV()`, not the `new MMKV()` of 2.x/3.x, and it
 *      returns a Nitro HybridObject. It is created LAZILY, inside the
 *      accessors, never at module load. That is deliberate and load-bearing:
 *      the web suite's docblock relies on "storage.ts only calls localStorage
 *      inside function bodies (never at module-load time), so import order
 *      relative to the stub assignment is safe", and the headless suite here
 *      depends on the same property to substitute an in-memory stub.
 *
 *   2. MMKV signals an absent key with `undefined`; localStorage uses `null`.
 *      The seam's contract is `T | null`, so `storageGet` maps one to the
 *      other rather than leaking `undefined` to callers.
 *
 * All operations stay wrapped in try/catch. The web reason was private-browsing
 * and quota; here it is a native call that can throw if the store cannot be
 * opened. Either way a storage failure must degrade to "no saved position"
 * rather than take down the reader.
 */

import { createMMKV, type MMKV } from 'react-native-mmkv';

export const STORAGE_PREFIX = 'readingaid_v1:';

let store: MMKV | null = null;

/** The MMKV instance, created on first use. See difference (1) above. */
function backing(): MMKV {
  if (store === null) store = createMMKV();
  return store;
}

export function storageGet<T>(key: string): T | null {
  try {
    const raw = backing().getString(STORAGE_PREFIX + key);
    // MMKV's absent-key sentinel is undefined, not null. See difference (2).
    if (raw === undefined) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Returns false if the write fails (store unavailable, value not settable). */
export function storageSet<T>(key: string, value: T): boolean {
  try {
    backing().set(STORAGE_PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function storageRemove(key: string): void {
  try {
    backing().remove(STORAGE_PREFIX + key);
  } catch {
    // ignore — key was absent or storage is unavailable
  }
}
