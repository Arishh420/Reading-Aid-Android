/**
 * Reader visual constants: the `light` theme's colours, and every layout value
 * the reading surface uses. One module, two exports (`LIGHT`, `LAYOUT`), so any
 * visual tuning is a single-file edit — carried forward from the stage 1 probe's
 * TUNING block, whose purpose was exactly that and whose visual ruling is still
 * outstanding.
 *
 * Colours and layout live together rather than in separate files because the
 * active-word highlight is BOTH: it is the accent colour at a given opacity.
 * Splitting them would put the highlight's two halves in two places, which is
 * the opposite of the point.
 *
 * ─── PROVENANCE, AND A WARNING (AD26) ────────────────────────────────────────
 *
 * `src/core/ui/theme.ts` contains NO colour values — it is the `Theme` union,
 * a label list and `DEFAULT_THEME`. The actual colours are CSS custom
 * properties in the WEB repo's `src/index.css`, which React Native cannot read.
 *
 * So every value below is a HAND-COPIED DUPLICATION ACROSS THE REPO BOUNDARY,
 * with NO SYNC MECHANISM. If the web theme is retuned, nothing updates this
 * file and nothing warns anyone. This is a `D-D` surface — alongside the twelve
 * seeded `src/core/` files and the ported `src/pacer/usePacer.ts` — and it is
 * recorded as one in DECISIONS.md AD26 rather than left implicit.
 *
 * Sources, each verified by reading the web file directly:
 *   - Colours          index.css:12-18  (`:root, :root[data-theme='light']`)
 *   - Highlight        index.css:634-644 (`.pacer-overlay`) — radius `4px` at
 *                      line 640, `color-mix(in srgb, var(--accent) 32%,
 *                      transparent)` at line 641.
 *   - Body type        index.css:629 — `font-size: var(--reader-font-size, 1.125rem)`
 *   - Heading spacing  index.css:650-653 (`.reader-heading`) — `margin:
 *                      1.8rem 0 0.6rem`, `line-height: 1.3`
 *   - Paragraph spacing index.css:655-657 (`.reader-paragraph`) — `margin: 0 0 1.1rem`
 *   - Reading width    index.css:54 — `--reading-width: 42rem`
 *
 * `rem` is the UA default 16px: no `font-size` is set on `html`, `:root` or
 * `body` anywhere in index.css (checked). So 1.125rem = 18, 1.8rem = 28.8,
 * 0.6rem = 9.6, 1.1rem = 17.6, 42rem = 672.
 */

/** The `light` theme — the MVP's only theme (AD19). Verified: index.css:12-18. */
export const LIGHT = {
  bg: '#faf9f7',
  surface: '#ffffff',
  text: '#1c1b19',
  muted: '#6b6a67',
  border: '#e6e3de',
  accent: '#3b6ea5',
  anchor: '#c0392b',
} as const;

/** `#rrggbb` + alpha -> `rgba(r, g, b, a)`, which React Native accepts.
 *  Derived from LIGHT.accent rather than hard-coded so the highlight cannot
 *  drift away from the accent it is supposed to be a tint of. */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const LAYOUT = {
  // ── Word boxes (AD21). Carried from the probe's TUNING block. ──
  /** Space between adjacent word boxes on the same line. Applied as
   *  `columnGap`, which — unlike a margin — adds no leading indent to a
   *  wrapped line. */
  wordGapH: 5,
  /** Space between wrapped lines of word boxes. */
  wordGapV: 3,
  /** Padding inside a word box: the highlight's inset around the glyphs. */
  wordPadH: 2,
  wordPadV: 1,

  // ── Type. Body from index.css:629; heading sizes derived below. ──
  /**
   * 19, NOT web's 18. index.css:629 is `1.125rem` = 18px, but the stage 1
   * acceptance probe measured question (d) at 19 and the project owner's
   * visual ruling is pending against THAT value. Matching the probe means the
   * ruling transfers to this surface with no translation step. A deliberate
   * +1 over web, and a one-value edit to revert.
   */
  bodyFontSize: 19,
  bodyLineHeight: 30,
  /**
   * Heading sizes. The web CSS sets NO font-size for headings — `.reader-heading`
   * carries only margin and line-height, and web emits real `<h1>`..`<h6>`
   * (Reader.tsx:95-97, level clamped to 1-6), so the sizes come from browser UA
   * defaults. React Native has no such defaults, so the UA scale is applied
   * explicitly: h1 2em, h2 1.5em, h3 1.17em, h4 1em, h5 0.83em, h6 0.67em,
   * rounded to whole pixels.
   *
   * These derive from WEB'S 18px base, NOT from `bodyFontSize` above, which is
   * 19. That mismatch is a KNOWN DEFECT recorded in DECISIONS.md AD26 and
   * deliberately left in place for this change: h4 (18) is SMALLER than body
   * text (19), and at `headingWeight` 400 it has no weight advantage either, so
   * an h4 is indistinguishable from a paragraph; h5 (15) and h6 (12) are
   * smaller still. Markdown `####` produces exactly this. The seeded sample
   * uses only `#` and `##`, so the MVP's default document does not exhibit it.
   * Fix deferred to a follow-up, to be settled with AF36's pending tuning
   * ruling since both concern this same table.
   */
  headingFontSize: { 1: 36, 2: 27, 3: 21, 4: 18, 5: 15, 6: 12 } as Record<number, number>,
  /** index.css:652 — `line-height: 1.3` on `.reader-heading`. */
  headingLineHeightRatio: 1.3,
  /**
   * 400, a DELIBERATE DIVERGENCE from web, recorded in AD26.
   *
   * Web emits real `<h1>`..`<h6>` (Reader.tsx:95-97) and sets no heading
   * font-weight anywhere, so headings inherit the UA's bold 700. But
   * `.bionic-head` is ALSO 700 (index.css:243-244), so head and tail render at
   * the same weight and THE BIONIC ANCHOR IS INVISIBLE INSIDE EVERY WEB
   * HEADING. Reproducing that faithfully would throw away the reading aid's
   * one signal on exactly the lines a reader scans hardest.
   *
   * So headings here are distinguished by SIZE ALONE, at normal weight, with
   * the bionic head at 700 exactly as in body text. The web behaviour is
   * arguably a defect, but it is web-layer rather than shared surface, so it
   * carries no cross-repo obligation and is not being filed.
   */
  headingWeight: '400',
  /** Weight of the bionic head run. index.css:243-244 — `.bionic-head { font-weight: 700 }`. */
  bionicHeadWeight: '700',

  // ── Block spacing (index.css:650-657), rem = 16px. ──
  headingMarginTop: 28.8, // 1.8rem
  headingMarginBottom: 9.6, // 0.6rem
  paragraphMarginBottom: 17.6, // 1.1rem

  // ── The active-word highlight (index.css:640-641). ──
  highlightRadius: 4,
  highlightOpacity: 0.32,

  /**
   * Auto-scroll: how far below the viewport top the active line is parked on a
   * line change. Fixed rather than derived from viewport height so the scroll
   * path needs no measurement beyond the per-word Y it already collects.
   */
  scrollTopInset: 140,

  // ── Surface. index.css:54 — `--reading-width: 42rem`. ──
  readingMaxWidth: 672,
  contentPaddingH: 16,
  contentPaddingV: 16,
} as const;

/** The active-word highlight: accent at 32%, matching web's `.pacer-overlay`. */
export const HIGHLIGHT_BG = withAlpha(LIGHT.accent, LAYOUT.highlightOpacity);

/** What a word box paints when it is NOT the active word. */
export const HIGHLIGHT_NONE = 'transparent';
