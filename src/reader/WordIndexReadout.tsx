/**
 * The live word-index readout that sits above the transport button (AD42).
 *
 * ─── WHY THIS IS NOT A `Text` WITH `useState` ───────────────────────────────
 *
 * CLAUDE.md invariant 2 forbids re-rendering the document tree on the
 * per-pacer-tick path, and NOTHING in `src/` is memoised — a re-render of the
 * reader screen re-reconciles `ReaderSurface` -> `BlockView` -> every
 * `WordBox`. `useMemo` inside the surface saves the per-document COMPUTATION,
 * not the reconciliation. So a `useState` holding the index, at any frequency,
 * would re-reconcile the whole document once per update: at 1 Hz that is still
 * the exact cliff guard 2 names, merely slower. ARCHITECTURE.md §4 states the
 * rule flatly — "Do not put the current index into React state, or into a
 * prop, or into context" — and this component does not.
 *
 * ─── THE MECHANISM, AND WHY IT IS NOT ONE OF AD21's DEAD ONES ───────────────
 *
 * `useAnimatedProps` on an animated `TextInput`, writing the `text` PROP from
 * the UI thread. AD21 retired two mechanisms and this is neither:
 *
 *   - It is NOT `setNativeProps`. That is React Native's instance method, which
 *     does not work under the New Architecture. This is Reanimated's own
 *     UI-thread prop updater: `useAnimatedProps` is literally
 *     `useAnimatedStyle(updater, deps, adapters, true)`
 *     (`hook/useAnimatedProps.js:8`), and on native both land on the same
 *     `global.UpdatePropsManager.update(...)` (`updateProps/updateProps.js`).
 *     It is therefore the SAME machinery AF32 proved on physical hardware for
 *     the highlight, not a second mechanism needing its own proof.
 *
 *   - It is NOT animated nested `Text`. AD21's reason that nested text cannot
 *     be animated is that "`Text`'s children are separate nodes rather than
 *     props" — and `text` is a genuine prop of `TextInput`. AD21's own
 *     argument is what makes this work.
 *
 * Reanimated 4.5.1 ships this exact pattern itself, for a live FPS counter:
 * `component/PerformanceMonitor.js:42` is `createAnimatedComponent(TextInput)`
 * driven by `useAnimatedProps(() => ({ text, defaultValue: text }))` with
 * `editable: false`. Reanimated 4.x supports only the New Architecture, so that
 * is first-party use of the mechanism in the pinned version on the architecture
 * this app ships. `defaultValue` is set alongside `text` for the same reason it
 * is there: the input is uncontrolled, and `defaultValue` is what gives it a
 * value on first render.
 *
 * So a pacer tick still runs NO React here. The whole per-tick cost is one
 * string build in a worklet.
 *
 * ─── COSTS, RECORDED RATHER THAN GLOSSED ────────────────────────────────────
 *
 * A `TextInput` announces to a screen reader as an editable field, not as a
 * heading. That is mitigated structurally — `accessibilityRole="header"` on the
 * wrapper and `accessibilityRole="text"` on the input — but the mitigation is a
 * READ of React Native's accessibility mapping and has never been exercised
 * with TalkBack (AF53) ❓. AD21 already accepted a screen-reader cost on this
 * surface, so this is consistent with the reading surface rather than novel.
 *
 * `pointerEvents="none"` matters: without it the field could take a touch that
 * belongs to the transport button directly beneath it. The transparent
 * underline and zeroed padding are what make an input look like a label on
 * Android.
 *
 * ─── WHAT HAS NO COVERAGE ───────────────────────────────────────────────────
 *
 * This file has NO behavioural coverage and cannot have any: no Node suite can
 * execute a worklet, `useAnimatedProps`, or a native `TextInput`
 * (ARCHITECTURE.md §6.2). Its only testable half — the label string, including
 * the zero-word branch — is `formatWordIndexLabel` in `prepareDocument.ts`,
 * which is pure and covered there. The readout on screen is unverified until a
 * device run.
 */

import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { LIGHT } from './palette';
import { formatWordIndexLabel } from './prepareDocument';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export interface WordIndexReadoutProps {
  /** The clock's only output. CLAUDE.md guard 1: an integer, and nothing else. */
  currentIndex: SharedValue<number>;
  /**
   * Total words in the document. A stable primitive per document, so the
   * worklet closes over a number and never touches an object.
   */
  wordCount: number;
}

export function WordIndexReadout({ currentIndex, wordCount }: WordIndexReadoutProps) {
  // `wordCount` is lifted to a primitive before the worklet captures it, for the
  // same reason WordBox lifts `word.index`.
  const total = wordCount;

  const animatedProps = useAnimatedProps(() => {
    const text = formatWordIndexLabel(currentIndex.value, total);
    // Both, deliberately: the input is uncontrolled, so `defaultValue` is what
    // renders before the first UI-thread update.
    return { text, defaultValue: text };
  });

  return (
    <View style={styles.wrap} accessibilityRole="header">
      <AnimatedTextInput
        style={styles.readout}
        animatedProps={animatedProps}
        editable={false}
        pointerEvents="none"
        underlineColorAndroid="transparent"
        accessibilityRole="text"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  readout: {
    // Colours come from the palette; sizes are local, exactly as the transport
    // and WPM controls in the reader screen already do (AD26 scopes its
    // single-source rule to colour values).
    color: LIGHT.muted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    // An input carries chrome a label must not: strip all of it.
    padding: 0,
    margin: 0,
    minHeight: 0,
    includeFontPadding: false,
  },
});
