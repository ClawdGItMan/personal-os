/**
 * Shared layout constants — design README §Spacing & structure. Bands are
 * full-bleed (borders edge to edge) with content padded by `gutter`.
 */
export const layout = {
  /** Screen side gutter — content padding inside full-bleed bands. */
  gutter: 24,
  /** Band vertical padding (~15–19pt in the spec; 17 is the locked midpoint). */
  bandPadV: 17,
  /** Ledger time column width (README: timeline time column 58pt). */
  timeCol: 58,
  radius: {
    /** Capture button (50×50). */
    capture: 14,
    /** Focus week calendar cells. */
    weekCell: 8,
    /** Pills, chips, bars. */
    pill: 999,
  },
} as const;
