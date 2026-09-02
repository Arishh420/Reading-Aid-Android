/**
 * Choosing the word index to resume at (web issues #48 and #76).
 *
 * Reimplemented rather than ported: on web this logic is the body of
 * `handleResume` in App.tsx (lines 250-280), a React component function closing
 * over component state (`words`, `resumeRecord`), so there is nothing
 * importable. The Android copy is a pure function over its three inputs.
 *
 * Both issues it encodes are subtle enough to be worth restating, because
 * getting either wrong loses the user's place silently rather than loudly:
 *
 *  - #48. The fingerprint identifies the CONTENT, not the tokenization. The
 *    same bytes can re-tokenize to a different word count if the parser
 *    changes, and then the saved raw `wordIndex` points at the wrong word.
 *    When drift is detected, resume by the saved `percent` instead.
 *
 *  - #76. Drift must be judged against the SNAPSHOT's own `wordCount`, not the
 *    record-level one. `BookRecord.wordCount` is overwritten on every save, so
 *    it reflects only the most recent save's tokenization; a later save can
 *    re-converge it to match the current parse while an older snapshot was
 *    saved under a different count. Comparing record-level counts alone then
 *    reports "no drift" for that older snapshot and reuses its stale index.
 *    Snapshots written before this field existed have no `wordCount`, so the
 *    record-level value remains the fallback for them.
 *
 * The web original also `console.info`s on drift; that is omitted here, as the
 * MVP has no console consumer for it. Behaviour is otherwise identical.
 */

import type { PositionSnapshot } from './readingPosition';

/**
 * The index to seek to when resuming `snapshot`.
 *
 * @param snapshot          the snapshot being resumed (usually `record.latest`)
 * @param recordWordCount   `BookRecord.wordCount` — used only as the pre-#76
 *                          fallback for snapshots that carry no `wordCount`
 * @param currentWordCount  the live flattened word count for this parse
 */
export function resolveResumeTarget(
  snapshot: PositionSnapshot,
  recordWordCount: number | undefined,
  currentWordCount: number,
): number {
  const len = currentWordCount;
  const savedWordCount = snapshot.wordCount ?? recordWordCount;

  let target: number;
  if (savedWordCount !== undefined && savedWordCount !== len) {
    // Drift: the raw index is untrustworthy, but percent still is.
    target = len > 1 ? Math.round(snapshot.percent * (len - 1)) : 0;
  } else {
    target = snapshot.wordIndex;
  }

  // Clamp at both ends: guards a corrupted percent (>1) and a stale index past
  // the end of a now-shorter document.
  return Math.max(0, Math.min(target, len - 1));
}
