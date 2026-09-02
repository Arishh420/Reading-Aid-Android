/**
 * One word: a single top-level animated native view carrying the three static
 * bionic runs (AD21).
 *
 * The animated node is the BOX. Its children are static nested `Text`, which
 * AD21 records as the permitted case — only *animated* nested text is
 * unsupported. Confirmed on an Android emulator by the stage 1 acceptance
 * probe: the highlight moved across 3557 frames and 179 word advances with the
 * React render count frozen at 1.
 *
 * Nothing in here runs React on a pacer tick. The only per-tick work is the
 * worklet below: one integer comparison against a captured primitive.
 */

import { StyleSheet, Text, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { HIGHLIGHT_BG, HIGHLIGHT_NONE, LAYOUT, LIGHT } from './palette';
import type { PreparedWord } from './prepareDocument';

export interface WordBoxProps {
  word: PreparedWord;
  /** Resolved from the block's type/level by the caller — never recomputed here. */
  fontSize: number;
  lineHeight: number;
  /** The single source of the active index (CLAUDE.md guard 1: integers only). */
  currentIndex: SharedValue<number>;
  /**
   * Reports this word's block-relative Y, once, when layout arrives. Only Y is
   * read — no width, no x, no rect. This is the auto-scroll Y map, NOT the
   * measured-rect overlay, which stays deferred to `D-G`/`D-Q`.
   * Omitted when auto-scroll is off, so no layout work is done at all.
   */
  onMeasureY?: (index: number, y: number) => void;
}

export function WordBox({
  word,
  fontSize,
  lineHeight,
  currentIndex,
  onMeasureY,
}: WordBoxProps) {
  // Lift the index to a primitive BEFORE the worklet closes over it, so the
  // UI thread compares two numbers and never touches `word`.
  const index = word.index;

  const highlight = useAnimatedStyle(() => ({
    backgroundColor: currentIndex.value === index ? HIGHLIGHT_BG : HIGHLIGHT_NONE,
  }));

  const handleLayout = onMeasureY
    ? (e: LayoutChangeEvent) => onMeasureY(index, e.nativeEvent.layout.y)
    : undefined;

  return (
    <Animated.Text
      onLayout={handleLayout}
      style={[
        styles.word,
        { fontSize, lineHeight },
        // `types.ts:26-29`: a token with spaceBefore === false must sit flush
        // against the previous one. Normal spacing comes from the block's
        // columnGap — which, unlike a margin, adds no leading indent to a
        // wrapped line — so a flush token cancels exactly that one gap.
        word.spaceBefore ? null : styles.flush,
        highlight,
      ]}
    >
      {word.head ? (
        <>
          {word.lead}
          <Text style={styles.head}>{word.head}</Text>
          {word.tail}
        </>
      ) : (
        word.text
      )}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  word: {
    color: LIGHT.text,
    paddingHorizontal: LAYOUT.wordPadH,
    paddingVertical: LAYOUT.wordPadV,
    borderRadius: LAYOUT.highlightRadius,
  },
  flush: {
    marginLeft: -LAYOUT.wordGapH,
  },
  head: {
    fontWeight: LAYOUT.bionicHeadWeight,
  },
});
