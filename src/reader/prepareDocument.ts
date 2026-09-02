/**
 * Turn a parsed Document into render-ready data, ONCE per document.
 *
 * This is the whole of the reader's per-word computation. It exists as its own
 * module, free of React and React Native, for two reasons: its headless suite
 * can bundle it without stubbing either, and keeping it pure makes it obvious
 * that nothing here can run on a pacer tick.
 *
 * Two invariants are load-bearing and both are CLAUDE.md's:
 *
 *  1. `Word.id` IS the flat word index (invariant 1; parsers call
 *     `reindexWords` last). It is a STRING — `types.ts:16` — holding the
 *     decimal form of that index, as AF29 records. `Number(w.id)` converts it
 *     here, at prepare time, exactly once per word. That conversion must never
 *     happen inside a worklet: the highlight compares a shared value against
 *     this number on the UI thread every frame, and parsing a string there
 *     would put string work on the render path the architecture exists to keep
 *     empty. This is NOT a second indexing scheme — it is the same index in
 *     numeric form, and no other index is introduced anywhere.
 *
 *  2. `splitBionic` is called here and nowhere else, so the three bionic runs
 *     are data by the time a word box sees them.
 */

import type { Document } from '../core/model/types';
import { splitBionic } from '../core/reader/bionic';

export interface PreparedWord {
  /** The flat word index: `Number(Word.id)`. What the shared value compares against. */
  index: number;
  /** The raw token, used when there is no bionic head to anchor on. */
  text: string;
  /** Bionic lead / head / tail (`splitBionic`). `head` is '' for a no-letter token. */
  lead: string;
  head: string;
  tail: string;
  /**
   * False when this token must render flush against the previous one with no
   * space — `types.ts:26-29` says renderers that re-insert inter-token
   * whitespace "must honor" it, and this renderer does (see WordBox).
   */
  spaceBefore: boolean;
}

export interface PreparedBlock {
  id: string;
  type: 'heading' | 'paragraph';
  /** 1-6. Clamped the same way web does it (Reader.tsx:95), so a malformed
   *  level cannot index outside the heading size table. Always 1 for a
   *  paragraph, where it is meaningless and unused. */
  level: number;
  words: PreparedWord[];
}

/** Mirrors web Reader.tsx:95 — `Math.min(Math.max(block.level ?? 1, 1), 6)`. */
function clampLevel(level: number | undefined): number {
  return Math.min(Math.max(level ?? 1, 1), 6);
}

/**
 * Prepare every block's words. `ratio` is the bionic intensity (use
 * `BIONIC_RATIO`); AD23 ships bionic always on, so there is no "off" path.
 */
export function prepareDocument(doc: Document, ratio: number): PreparedBlock[] {
  return doc.blocks.map((block) => ({
    id: block.id,
    type: block.type,
    level: clampLevel(block.level),
    words: block.words.map((w) => {
      const { lead, head, tail } = splitBionic(w.text, ratio);
      return {
        index: Number(w.id),
        text: w.text,
        lead,
        head,
        tail,
        spaceBefore: w.spaceBefore,
      };
    }),
  }));
}

/**
 * Flat-word-index -> containing block index, derived from `Word.id` alone.
 *
 * Used only by the auto-scroll Y map, which needs a word's block to add that
 * block's own offset to the word's block-relative `onLayout` Y. It introduces
 * no new numbering: every entry is keyed by the same flat index `Word.id`
 * already defines.
 */
export function buildWordBlockMap(blocks: PreparedBlock[]): number[] {
  const map: number[] = [];
  blocks.forEach((block, blockIndex) => {
    for (const w of block.words) map[w.index] = blockIndex;
  });
  return map;
}

/** Total word count = highest flat index + 1, or 0 for an empty document. */
export function countWords(blocks: PreparedBlock[]): number {
  let max = -1;
  for (const block of blocks) {
    for (const w of block.words) if (w.index > max) max = w.index;
  }
  return max + 1;
}
