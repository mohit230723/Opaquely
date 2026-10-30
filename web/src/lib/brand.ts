// The one place the logo is named. A logo swap replaces three files, with no component edit:
//   - web/public/brand/opaquely-wordmark.svg (header and footer wordmark, BRAND.wordmark)
//   - web/public/brand/opaquely-icon.svg (small-screen header icon, BRAND.icon)
//   - web/src/app/icon.svg (the favicon, served by Next from the app directory, not through BRAND)
// web/public/brand/opaquely-embossed.svg is the separate hero artwork (BRAND.embossed): the Array
// "Opaquely" glyphs outlined to one path. Regenerate it only if the lettering changes.
export const BRAND = {
  /** Eye-O wordmark, transparent background, viewBox 517.75 x 107. */
  wordmark: "/brand/opaquely-wordmark.svg",
  /** Eye-O icon on a rounded #050816 tile, square. */
  icon: "/brand/opaquely-icon.svg",
  /** Outlined "Opaquely" lettering for the embossed band under the hero, viewBox 497.25 x 97.25. */
  embossed: "/brand/opaquely-embossed.svg",
} as const;

/** Wordmark aspect ratio (width / height) from its viewBox. */
export const WORDMARK_RATIO = 517.75 / 107;

/** Embossed artwork aspect ratio (width / height) from its viewBox. */
export const EMBOSSED_RATIO = 497.25 / 97.25;
