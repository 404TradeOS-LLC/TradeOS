# TradeOS logo usage

## Artwork
The carpenter's-square T is built from a heavy top and vertical rule. Its evenly spaced ruler cuts and five square modules preserve the supplied reference. The `mark-small` version drops fine ruler cuts for 16–48 px use. Lettering is converted to vector outlines; no font installation is required.

## Colors
| Color | HEX | RGB | Intended use |
|---|---|---|---|
| Copper | #C98460 | 201, 132, 96 | Brand mark and “OS” |
| Charcoal | #222426 | 34, 36, 38 | “Trade”, dark app icon field |
| Warm ivory | #F7F5F1 | 247, 245, 241 | Optional light surface |
| White | #FFFFFF | 255, 255, 255 | Reversed text and mark |

The color values are digital specifications. Ask the printer for a CMYK proof on the actual stock before a large run; automatic CMYK conversion will depend on its press profile.

## Choose a file
- Website and software: `vector/tradeos-horizontal-*.svg` in headers; `web/favicon.svg` and `web/app-icon.svg` for app branding; `web/pwa-*.png` for install icons.
- Documents and ads: horizontal logo PNG for ordinary placement, transparent background. Use `print/*.pdf` for professional print production.
- Profile photos: `web/app-icon.svg` or `web/pwa-512.png`.
- Shirts, hats, vinyl, engraving: `vector/*-mono.svg`, or `print/*-mono.eps` where required. Use the full one-color icon at ordinary size and the simplified icon for small embroidery.
- Narrow placements: `vector/tradeos-wordmark-*.svg`. Square or vertical placements: `vector/tradeos-stacked-*.svg`.

## Clear space and minimum size
Allow clear space on all sides equal to at least half the T stem width. Use the horizontal lockup at 160 px wide or larger on screen and 35 mm or larger in print. Use the full standalone mark at 48 px or larger; below that use `mark-small` or the prepared favicon. Verify legibility on the actual surface before producing embroidery or signage.

## Handling
Do not stretch, rotate, recolor the two-color version, add effects, or put the charcoal lettering on a dark background. `-dark` refers to the version meant for a dark surface and has white “Trade”. SVG and PDF masters have transparent backgrounds unless an app icon is intended. JPG cannot preserve transparency and is intentionally omitted from the master logos. The EPS is provided only for the one-color vendor artwork.

## Contents
`vector/` has editable, scalable SVG variants (with text outlined). `web/` has transparent PNGs plus favicon and app icon. `print/` has vector PDFs and one-color EPS. `preview/` contains the presentation sheet.
