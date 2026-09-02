/**
 * Reader visual constants: the `light` theme's colours, and every layout value
 * the reading surface uses. One module, so any visual tuning is a single-file
 * edit — carried forward from the stage 1 probe's TUNING block, whose purpose
 * was exactly that. That probe's visual ruling (AF36 question (d)) is no longer
 * outstanding: AF39 records it as SHIP AS IS, so nothing here is retuned. The
 * one exception is the heading scale, which AD29 changes to fix the defect AD26
 * recorded as shipping — see `HEADING_SIZE_RATIO` below.
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

/**
 * Body type size, hoisted out of `LAYOUT` so the heading scale below can derive
 * from it. Still declared in exactly one place — `LAYOUT.bodyFontSize` reads
 * this constant rather than repeating the number.
 */
const BODY_FONT_SIZE = 19;

/**
 * Heading size ratios, applied to the LIVE body size (AD29).
 *
 * Two properties are load-bearing, and the thirteenth headless suite
 * (`palette-headless-test.mjs`) asserts both against THESE values rather than
 * against a copy of the resulting table:
 *
 *   1. STRICTLY DECREASING — h1 > h2 > ... > h6.
 *   2. EVERY LEVEL STRICTLY ABOVE BODY TEXT, whatever `bodyFontSize` becomes.
 *      That is the exact regression AD26 recorded and AD29 fixes: a size table
 *      pinned to one base (web's 18) while the base moved underneath it (to 19).
 *
 * Every ratio here is > 1 (the smallest is 1.1), but the ratios ALONE do not
 * guarantee either property once rounding is involved — `headingFontSizes`
 * below enforces both. See its docblock for the measured collision case.
 *
 * 1.9 and 1.4 are chosen to REPRODUCE the two levels that were actually judged
 * on-device — h1 36 and h2 27 against a body of 19 — rather than invented. The
 * seeded sample uses only `#` and `##` (sample.ts:2 and :8), so h3-h6 were
 * never on screen; h3 moving 21 -> 24 therefore retunes nothing that was ruled
 * on, and it is required by the fix, since three levels cannot sit
 * distinguishably between 21 and a body of 19.
 */
export const HEADING_SIZE_RATIO: Record<number, number> = {
  1: 1.9,
  2: 1.4,
  3: 1.27,
  4: 1.21,
  5: 1.16,
  6: 1.1,
};

/**
 * The heading size table for a given body size. Pure, and exported so the suite
 * can sweep it across bases instead of trusting one shipped table.
 *
 * BUILT FROM THE BOTTOM UP, and that is the whole point: h6 is floored at
 * `bodyFontSize + 1`, and every level above it is at least one pixel larger than
 * the level below. Both invariants then hold UNCONDITIONALLY, for any body size,
 * rather than holding by arithmetic luck at one particular base.
 *
 * The alternative — round each ratio independently — was measured and rejected:
 * adjacent ratios only 0.05 apart collide once the base is small enough that
 * 0.05 x base rounds to zero. At a body of 16 the 1.21 and 1.16 levels BOTH
 * round to 19, so h4 === h5 and the strictly-decreasing invariant fails. That is
 * the same class of silent, base-dependent breakage AD26 recorded, so it is
 * designed out here instead of being left for a future `bodyFontSize` edit to
 * rediscover.
 *
 * At the shipped body of 19 the enforcement is inert: every level takes its
 * ratio value unchanged, giving 36 / 27 / 24 / 23 / 22 / 21.
 */
export function headingFontSizes(bodyFontSize: number): Record<number, number> {
  const sizes: Record<number, number> = {};
  // The level nearest body text carries the floor; each level up clears the one
  // below it by at least a pixel.
  let atLeast = bodyFontSize + 1;
  for (let level = 6; level >= 1; level--) {
    const size = Math.max(Math.round(bodyFontSize * HEADING_SIZE_RATIO[level]), atLeast);
    sizes[level] = size;
    atLeast = size + 1;
  }
  return sizes;
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

  // ── Type. Body from index.css:629; heading sizes derived from it above. ──
  /**
   * 19, NOT web's 18. index.css:629 is `1.125rem` = 18px, and the stage 1
   * acceptance probe measured question (d) at 19 so that the pending visual
   * ruling would transfer to this surface with no translation step.
   *
   * THAT RULING IS NOW MADE. AF36 recorded question (d) as deferred with no
   * ruling; AF39 records the ruling itself, made by the project owner against
   * the real reader surface on a physical device and an emulator: SHIP AS IS.
   * So 19 stands, and so does every other value in this export — the heading
   * scale is the only thing AD29 changes.
   */
  bodyFontSize: BODY_FONT_SIZE,
  bodyLineHeight: 30,
  /**
   * Heading sizes, DERIVED from `bodyFontSize` by `headingFontSizes` above
   * (AD29). Web sets no heading font-size at all — `.reader-heading` carries
   * only margin and line-height, and web emits real `<h1>`..`<h6>`
   * (Reader.tsx:95-97, level clamped to 1-6) — so there is no web source for
   * these values, and React Native has no UA defaults to inherit.
   *
   * WHAT CHANGED, AND WHY. The MVP shipped the browser UA scale (h1 2em ... h6
   * 0.67em) multiplied by WEB'S 18px base while `bodyFontSize` here is 19. AD26
   * recorded the result as a KNOWN DEFECT: h4 came out at 18, SMALLER than body
   * text, with h5 (15) and h6 (12) smaller still — and at `headingWeight` 400
   * they had no weight advantage either, so an h4 was indistinguishable from a
   * paragraph.
   *
   * The UA ratios were the defect, not merely the base they multiplied. 1em /
   * 0.83em / 0.67em only ever work because a browser pairs them with bold 700;
   * `headingWeight` is deliberately 400 here so the bionic head stays visible
   * (see below), which leaves size to carry the signal alone. So the scale is
   * FLOORED ABOVE 1.0, not merely rebased.
   *
   * At a body of 19 this is 36 / 27 / 24 / 23 / 22 / 21. h1 and h2 are
   * unchanged from what shipped and was judged; h3-h6 now all sit above body
   * text. Residual, recorded in AD29 rather than left to be discovered: h4/h5/h6
   * are one pixel apart, so they are only NOMINALLY distinguished from each
   * OTHER. What is fixed is "deep headings read as diminished or vanish into
   * body text", not "all six levels are visually distinct".
   */
  headingFontSize: headingFontSizes(BODY_FONT_SIZE),
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
