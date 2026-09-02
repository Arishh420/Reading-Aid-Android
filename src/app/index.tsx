/**
 * The reader screen — the MVP's only screen (AD24 `D-J`).
 *
 * Replaces the stage 1 acceptance probe, whose four questions are now answered
 * and recorded as FINDINGS AF32-AF36. What ships here: Markdown only (AD20),
 * Flowing Highlight only (AD19), bionic always on and natural pauses always on
 * (AD23), one theme (AD19), one user control — WPM (AD19/AD23), the seeded
 * sample plus a paste box and no file picker (AD24 `D-H`), and reading position
 * persisted and nothing else (AD24 `D-I`).
 *
 * ─── This component owns the clock; ReaderSurface owns the rendering ────────
 *
 * The seam between them is CLAUDE.md guard 1's integer callback and nothing
 * else: `pacer.subscribe` hands over an index, and the only thing done with it
 * is a write into a Reanimated shared value. No element, rect or style crosses,
 * and the index is never React state (guard 2) — so a pacer tick re-renders
 * nothing. `ReaderSurface` takes `{ doc, currentIndex }` and is unaware a pacer
 * exists.
 *
 * WPM and the play state ARE ordinary React state, and that is correct: they
 * change on a human gesture, not on a tick. Web makes the same split
 * (PacerControls.tsx:10 — "WPM and the play state are ordinary React state
 * (user-driven, rare)").
 *
 * ─── Click-to-jump (AD28) ───────────────────────────────────────────────────
 *
 * `pacer.seek` is handed to the surface directly, so a tap goes through the very
 * same seam a tick does. Two rulings are recorded in AD28 and both are visible
 * here as the ABSENCE of code:
 *
 *   - A tap SEEKS ONLY; it never starts or stops playback. Web does the same
 *     (App.tsx:410, :434 are both `onSeekWord={pacer.seek}`), and the rule is
 *     uniform in both directions: while playing, `seek` zeroes the accumulator
 *     and the rAF loop simply continues from the new word.
 *   - At end of document nothing is special-cased. `usePacer`'s `startedRef` is
 *     deliberately NOT cleared by `seek` (F23/D89), so tapping the last
 *     word-like token leaves Play disabled and the transport below still reads
 *     Restart; tapping BACKWARDS flips `atEnd` false inside `commit` and Play
 *     becomes available again with no Restart needed. Both fall out of the
 *     ported clock unchanged.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { flattenWords } from '../core/model/tokenize';
import { buildDwellMultipliers } from '../core/pacer/dwell';
import { parseMarkdown } from '../core/parsers/markdown';
import { SAMPLE_MARKDOWN } from '../core/ui/sample';
import { usePacer } from '../pacer/usePacer';
import { LAYOUT, LIGHT } from '../reader/palette';
import { ReaderSurface } from '../reader/ReaderSurface';
import { fingerprintText } from '../storage/fingerprint';
import { loadBookRecord, saveReadingPosition } from '../storage/readingPosition';
import { resolveResumeTarget } from '../storage/resumeTarget';

/** Web's defaults, read from the web repo: App.tsx:68 and PacerControls.tsx:25-26.
 *  The floor of 50 (not 100) is deliberate there — see that file's comment on
 *  issue #38 item 6: 50 is the lowest WPM that still meaningfully "plays". */
const WPM_DEFAULT = 300;
const WPM_MIN = 50;
const WPM_MAX = 1000;
/** Step per tap. No slider: React Native has no built-in one and
 *  @react-native-community/slider is not installed (and adding it is out of
 *  scope), so WPM is adjusted by stepped buttons. */
const WPM_STEP = 25;

/**
 * Reading position is flushed on a timer rather than on every advance.
 *
 * Web saves on a 30 s interval plus `visibilitychange` and `pagehide`. Android
 * can have the process killed with no JS callback at all, so a much shorter
 * interval is the safer trade: at 2 s the worst case loses about two seconds of
 * reading, while the pacer's own subscriber stays free of I/O — it only marks a
 * ref dirty, which is what keeps the clock seam cheap.
 */
const SAVE_INTERVAL_MS = 2000;

const SAMPLE_TITLE = 'Sample document';
const PASTED_TITLE = 'Pasted text';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export default function Index() {
  // The document source. AD24: the seeded sample on first launch, a paste box
  // as the only other way in.
  const [source, setSource] = useState(SAMPLE_MARKDOWN);
  const [title, setTitle] = useState(SAMPLE_TITLE);

  const [wpm, setWpm] = useState(WPM_DEFAULT);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [draft, setDraft] = useState('');

  // Everything derived from the source, computed once per source change.
  const doc = useMemo(() => parseMarkdown(source, title), [source, title]);
  const words = useMemo(() => flattenWords(doc), [doc]);
  /**
   * AD23 ships natural pauses ALWAYS ON. Built once at load, and
   * `naturalPauses: true` is passed EXPLICITLY below: `usePacer`'s option
   * defaults to `false` (`options.naturalPauses ?? false`), so relying on the
   * default would silently ship them off.
   */
  const dwell = useMemo(() => buildDwellMultipliers(doc), [doc]);
  /** Book identity for persistence (AD27). The MVP has no File, so the
   *  fingerprint is taken over the source string's UTF-8 bytes. */
  const fingerprint = useMemo(() => fingerprintText(source), [source]);

  const pacer = usePacer(words, wpm, { dwell, naturalPauses: true });

  /** The clock's sole output to the view. CLAUDE.md guards 1 and 2. */
  const currentIndex = useSharedValue(0);

  // ── The seam: integer in, shared-value write out. Nothing else. ──
  useEffect(() => {
    currentIndex.value = pacer.indexRef.current;
    return pacer.subscribe((index: number) => {
      currentIndex.value = index;
    });
  }, [pacer, currentIndex]);

  // ── Persistence bookkeeping. Deliberately separate from the seam above, and
  //    deliberately free of I/O: it marks a ref, and the timer does the write.
  const latestIndexRef = useRef(0);
  const dirtyRef = useRef(false);

  useEffect(() => {
    latestIndexRef.current = pacer.indexRef.current;
    return pacer.subscribe((index: number) => {
      latestIndexRef.current = index;
      dirtyRef.current = true;
    });
  }, [pacer]);

  const flushPosition = useCallback(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    saveReadingPosition(fingerprint, title, latestIndexRef.current, words.length);
  }, [fingerprint, title, words.length]);

  // Flush on a timer, and once more on unmount or document change.
  useEffect(() => {
    const id = setInterval(flushPosition, SAVE_INTERVAL_MS);
    return () => {
      clearInterval(id);
      flushPosition();
    };
  }, [flushPosition]);

  // Flush the moment the reader pauses, so a deliberate stop is never lost.
  useEffect(() => {
    if (!pacer.playing) flushPosition();
  }, [pacer.playing, flushPosition]);

  // ── Restore, once per document ──
  //
  // Guarded by a ref rather than effect deps: `pacer` is memoised on `playing`
  // and `atEnd`, so its identity changes when the user hits Play. Without this
  // guard, that would re-run the restore and yank the reader back to the saved
  // position mid-sentence.
  //
  // Ordering is load-bearing and correct by construction: usePacer's own
  // `[words]` effect resets the index to the first word-like token, and hook
  // effects run before this component's, so the seek below always lands after
  // that reset rather than being overwritten by it.
  const restoredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (restoredForRef.current === fingerprint) return;
    restoredForRef.current = fingerprint;

    const record = loadBookRecord(fingerprint);
    if (!record) return;
    const target = resolveResumeTarget(record.latest, record.wordCount, words.length);
    if (target > 0) pacer.seek(target);
  }, [fingerprint, words.length, pacer]);

  // ── Controls ──

  const applyPaste = () => {
    const next = draft.trim();
    if (!next) return;
    flushPosition(); // keep the outgoing document's place before switching
    setSource(next);
    setTitle(PASTED_TITLE);
    setPasteOpen(false);
  };

  const useSample = () => {
    flushPosition();
    setSource(SAMPLE_MARKDOWN);
    setTitle(SAMPLE_TITLE);
    setDraft('');
    setPasteOpen(false);
  };

  /**
   * At the end of the document `play()` deliberately refuses to restart
   * (usePacer's `atEnd && startedRef` check, web F23/D89), so the transport
   * offers Restart instead — otherwise the button would look broken.
   */
  const atEnd = pacer.atEnd;
  const transportLabel = atEnd ? 'Restart' : pacer.playing ? 'Pause' : 'Play';
  const onTransport = () => {
    if (atEnd) {
      pacer.restart();
      return;
    }
    pacer.toggle();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.controls}>
        <Pressable style={styles.primaryButton} onPress={onTransport}>
          <Text style={styles.primaryButtonText}>{transportLabel}</Text>
        </Pressable>

        {/* The MVP's ONE setting (AD19/AD23). Not persisted — AD24 `D-I` scopes
            storage to position only: a reset WPM costs one gesture, a reset
            position costs the whole product. */}
        <View style={styles.wpmGroup}>
          <Pressable
            style={styles.stepButton}
            onPress={() => setWpm((w) => clamp(w - WPM_STEP, WPM_MIN, WPM_MAX))}
          >
            <Text style={styles.stepButtonText}>−</Text>
          </Pressable>
          <Text style={styles.wpmValue}>{wpm} WPM</Text>
          <Pressable
            style={styles.stepButton}
            onPress={() => setWpm((w) => clamp(w + WPM_STEP, WPM_MIN, WPM_MAX))}
          >
            <Text style={styles.stepButtonText}>+</Text>
          </Pressable>
        </View>

        <Pressable style={styles.ghostButton} onPress={() => setPasteOpen((o) => !o)}>
          <Text style={styles.ghostButtonText}>{pasteOpen ? 'Close' : 'Paste'}</Text>
        </Pressable>
      </View>

      {pasteOpen ? (
        <View style={styles.pastePanel}>
          <TextInput
            style={styles.pasteInput}
            value={draft}
            onChangeText={setDraft}
            placeholder="Paste Markdown here, then tap Read this."
            placeholderTextColor={LIGHT.muted}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.pasteActions}>
            <Pressable style={styles.primaryButton} onPress={applyPaste}>
              <Text style={styles.primaryButtonText}>Read this</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={useSample}>
              <Text style={styles.ghostButtonText}>Use sample</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <ReaderSurface doc={doc} currentIndex={currentIndex} onSeekWord={pacer.seek} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: LIGHT.bg,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: LAYOUT.contentPaddingH,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: LIGHT.border,
    backgroundColor: LIGHT.surface,
  },
  primaryButton: {
    backgroundColor: LIGHT.accent,
    borderRadius: 6,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: LIGHT.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: LIGHT.border,
    borderRadius: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  ghostButtonText: {
    color: LIGHT.text,
    fontSize: 14,
    fontWeight: '600',
  },
  wpmGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepButton: {
    borderWidth: 1,
    borderColor: LIGHT.border,
    borderRadius: 6,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    color: LIGHT.text,
    fontSize: 17,
    fontWeight: '600',
  },
  wpmValue: {
    color: LIGHT.text,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 72,
    textAlign: 'center',
  },
  pastePanel: {
    paddingHorizontal: LAYOUT.contentPaddingH,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: LIGHT.border,
    backgroundColor: LIGHT.surface,
    gap: 10,
  },
  pasteInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: LIGHT.border,
    borderRadius: 6,
    padding: 10,
    color: LIGHT.text,
    fontSize: 14,
    backgroundColor: LIGHT.bg,
  },
  pasteActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
