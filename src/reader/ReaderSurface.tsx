/**
 * The reading surface: a ScrollView, one flexWrap View per block, one word box
 * per word (AD21, AD24 `D-G` — no virtualization for the MVP).
 *
 * OWNS NO STATE AND NO CLOCK. It takes a document and a shared value and
 * renders. `usePacer`, play/pause and the WPM control are stage 4's and live
 * above this component, which keeps this independently composable and testable.
 *
 * ─── CLAUDE.md §4, and how each part is satisfied ───────────────────────────
 *
 * The document tree must not re-render on the per-tick path. It does not: the
 * only per-tick work is one integer comparison per word box, inside a worklet
 * on the UI thread (see WordBox). React is not involved.
 *   - Guard 1 (integer-only seam): this component's entire input from the clock
 *     is `currentIndex: SharedValue<number>`. No element, rect or style crosses.
 *   - Guard 2 (index is never React state): it is a shared value; there is no
 *     `useState` anywhere in this file.
 *   - Guard 3 (a mounted-range / viewability callback may NEVER scroll): there
 *     is no such callback here. Scrolling is driven ONLY by a change in the
 *     active word's line, via `useAnimatedReaction` on `currentIndex`, so it
 *     cannot fire on the user's own scrolling and cannot fight them.
 *
 * ─── Auto-scroll: what it is, and what it deliberately is not ───────────────
 *
 * §4 requires the mechanism to "locate word N, move a highlight to it, and
 * scroll only on line change". That is implemented here, scoped tightly:
 *
 *   - Each word box reports ONLY its block-relative Y from `onLayout`; each
 *     block reports ONLY its own Y. Absolute Y = block Y + word Y. No width,
 *     no x, no rect is ever read.
 *   - A line change is detected as "the active word's absolute Y differs from
 *     the Y we last scrolled for". Words on one line share a Y, so a same-line
 *     advance compares equal and does NOT scroll.
 *   - The scroll runs on the UI thread through `useAnimatedRef` + `scrollTo`,
 *     never by round-tripping through React.
 *   - If the Y map is absent, short, or still unmeasured for the active word,
 *     the reaction NO-OPS. Layout arrives asynchronously, so a partially
 *     measured document must never jump to a wrong position.
 *
 * This is NOT the measured-rect overlay. AD21 deferred the overlay as a
 * HIGHLIGHT MECHANISM — one animated node sliding to a measured rect instead of
 * per-word derived styles — and that stays deferred to `D-G`/`D-Q`. Reading a
 * word's Y in order to scroll is a different use of the same primitive, and
 * AD21's own choice makes it cheap: word boxes are real native views, so every
 * word already has an `onLayout` being mounted regardless.
 *
 * Block-level scrolling was rejected as a substitute: one long paragraph is a
 * single block spanning many lines, so the highlight would still run off the
 * bottom of the screen.
 */

import { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import type { Document } from '../core/model/types';
import { BIONIC_RATIO } from '../core/reader/bionic';
import { LAYOUT, LIGHT } from './palette';
import {
  buildWordBlockMap,
  countWords,
  prepareDocument,
  type PreparedBlock,
} from './prepareDocument';
import { WordBox } from './WordBox';

export interface ReaderSurfaceProps {
  doc: Document;
  /** The clock's only output. CLAUDE.md guard 1. */
  currentIndex: SharedValue<number>;
  /** Bionic intensity. Defaults to medium, matching web's DEFAULT_BIONIC. */
  bionicRatio?: number;
  /**
   * Follow the active word by scrolling on line change. On by default;
   * switchable off without editing this file, so device testing can isolate
   * the highlight from the scroll.
   */
  autoScroll?: boolean;
}

/** One block: a flexWrap row of word boxes, sized by its type and level. */
function BlockView({
  block,
  currentIndex,
  onMeasureBlockY,
  onMeasureWordY,
}: {
  block: PreparedBlock;
  currentIndex: SharedValue<number>;
  onMeasureBlockY?: (blockId: string, y: number) => void;
  onMeasureWordY?: (index: number, y: number) => void;
}) {
  const isHeading = block.type === 'heading';
  const fontSize = isHeading
    ? LAYOUT.headingFontSize[block.level]
    : LAYOUT.bodyFontSize;
  const lineHeight = isHeading
    ? Math.round(fontSize * LAYOUT.headingLineHeightRatio)
    : LAYOUT.bodyLineHeight;

  const handleLayout = onMeasureBlockY
    ? (e: LayoutChangeEvent) => onMeasureBlockY(block.id, e.nativeEvent.layout.y)
    : undefined;

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.block,
        isHeading ? styles.headingBlock : styles.paragraphBlock,
      ]}
    >
      {block.words.map((w) => (
        <WordBox
          key={w.index}
          word={w}
          fontSize={fontSize}
          lineHeight={lineHeight}
          currentIndex={currentIndex}
          onMeasureY={onMeasureWordY}
        />
      ))}
    </View>
  );
}

export function ReaderSurface({
  doc,
  currentIndex,
  bionicRatio = BIONIC_RATIO.medium,
  autoScroll = true,
}: ReaderSurfaceProps) {
  // The ONLY per-document computation: splitBionic once per word, plus the
  // Word.id -> number conversion. One memo for the whole document.
  const blocks = useMemo(() => prepareDocument(doc, bionicRatio), [doc, bionicRatio]);
  const wordBlock = useMemo(() => buildWordBlockMap(blocks), [blocks]);
  const wordCount = useMemo(() => countWords(blocks), [blocks]);
  const blockIndexById = useMemo(() => {
    const m = new Map<string, number>();
    blocks.forEach((b, i) => m.set(b.id, i));
    return m;
  }, [blocks]);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  /** Absolute Y per flat word index. -1 means "not measured yet" -> no-op. */
  const wordAbsY = useSharedValue<number[]>([]);
  /** The Y we last scrolled for. -1 so the first positioned word does scroll. */
  const lastScrolledY = useSharedValue(-1);

  // Raw layout inputs, held in refs: React must not re-render on layout.
  const blockYRef = useRef<number[]>([]);
  const wordYRef = useRef<number[]>([]);
  const publishPendingRef = useRef(false);

  /**
   * Rebuild the absolute Y array and publish it to the UI thread.
   *
   * Coalesced behind a single timeout: mounting a document fires one layout
   * event per word plus one per block, and rebuilding on each would be
   * quadratic. Coalescing makes it a handful of O(n) passes instead.
   */
  const publish = useCallback(() => {
    if (publishPendingRef.current) return;
    publishPendingRef.current = true;
    setTimeout(() => {
      publishPendingRef.current = false;
      const abs = new Array<number>(wordCount).fill(-1);
      for (let i = 0; i < wordCount; i++) {
        const b = wordBlock[i];
        if (b === undefined) continue;
        const by = blockYRef.current[b];
        const wy = wordYRef.current[i];
        if (by === undefined || wy === undefined) continue;
        abs[i] = by + wy;
      }
      wordAbsY.value = abs;
    }, 0);
  }, [wordCount, wordBlock, wordAbsY]);

  const onMeasureBlockY = useCallback(
    (blockId: string, y: number) => {
      const bi = blockIndexById.get(blockId);
      if (bi === undefined) return;
      blockYRef.current[bi] = y;
      publish();
    },
    [blockIndexById, publish],
  );

  const onMeasureWordY = useCallback(
    (index: number, y: number) => {
      wordYRef.current[index] = y;
      publish();
    },
    [publish],
  );

  // Scroll on line change only. Runs entirely on the UI thread.
  useAnimatedReaction(
    () => currentIndex.value,
    (index) => {
      if (!autoScroll) return;
      const ys = wordAbsY.value;
      // Guard every way the map can be unusable: absent, short, or this word
      // not yet measured. Each must no-op rather than scroll somewhere wrong.
      if (index < 0 || index >= ys.length) return;
      const y = ys[index];
      if (y === undefined || y < 0) return;
      // Same line -> same Y -> not a line change -> do not scroll.
      if (y === lastScrolledY.value) return;
      lastScrolledY.value = y;
      scrollTo(scrollRef, 0, Math.max(0, y - LAYOUT.scrollTopInset), true);
    },
    [autoScroll],
  );

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {blocks.map((block) => (
        <BlockView
          key={block.id}
          block={block}
          currentIndex={currentIndex}
          onMeasureBlockY={autoScroll ? onMeasureBlockY : undefined}
          onMeasureWordY={autoScroll ? onMeasureWordY : undefined}
        />
      ))}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: LIGHT.bg,
  },
  content: {
    paddingHorizontal: LAYOUT.contentPaddingH,
    paddingVertical: LAYOUT.contentPaddingV,
    maxWidth: LAYOUT.readingMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  block: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // columnGap (not a margin) so a wrapped line gets no leading indent;
    // WordBox cancels exactly one gap for a spaceBefore === false token.
    columnGap: LAYOUT.wordGapH,
    rowGap: LAYOUT.wordGapV,
  },
  headingBlock: {
    marginTop: LAYOUT.headingMarginTop,
    marginBottom: LAYOUT.headingMarginBottom,
  },
  paragraphBlock: {
    marginBottom: LAYOUT.paragraphMarginBottom,
  },
});
