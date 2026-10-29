// The one place the logo files are named. To swap in another logo, replace these two files in
// web/public/brand/ (and web/src/app/icon.svg for the favicon); no component needs editing.
export const BRAND = {
  /** Eye-O wordmark, transparent background, viewBox 517.75 x 107. */
  wordmark: "/brand/opaquely-wordmark.svg",
  /** Eye-O icon on a rounded #050816 tile, square. */
  icon: "/brand/opaquely-icon.svg",
} as const;

/** Wordmark aspect ratio (width / height) from its viewBox. */
export const WORDMARK_RATIO = 517.75 / 107;
