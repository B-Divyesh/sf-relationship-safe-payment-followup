# Gentle Chase — visual thesis

## Direction: topographic cartography

Chasing an invoice should feel like finding the next safe route, not turning up pressure. Gentle Chase borrows the practical language of field maps: warm paper, contour lines, coordinate-like metadata, route markers, and a single coral trail. The metaphor explains the product: every overdue invoice has a known position and a deliberate next checkpoint, while the user remains the navigator.

This is intentionally a light, paper-like single-mode interface. Dark mode is not used because a mixed map/table workspace becomes less legible and more visually severe; the warm parchment canvas is painted explicitly in every route and installed-app splash.

## Tokens

- Background `#F4F0E5` (“map paper”); surface `#FCFAF4`; raised surface `#FFFFFF`.
- Text `#182D2A` (“deep survey green”); muted text `#52655F`; subtle line `#C9C6B8`.
- Accent `#C84D36` (“trail coral”), with white text; dark accent `#973824` for hover/focus.
- Success `#236B4F`; warning `#8B5A12`; danger `#9B2C2C`. Status is always repeated in text or shape.
- Contours use `#A7BEB1` and `#D9D8C9` at low contrast as non-textural guidance, never behind long copy.

All body text combinations meet WCAG AA: deep green on paper is over 12:1, muted green on paper is over 5.5:1, and white on dark coral is over 6:1.

## Type

- Display: Georgia, Cambria, `Times New Roman`, serif. Its bracketed forms make headings feel like annotations in an older field atlas without downloading a font.
- Interface/body: Inter where installed, `Avenir Next`, `Segoe UI`, sans-serif. It keeps dates, currency, and actions contemporary and compact.
- Scale: 14px metadata, 16px body, 20px section title, 28px workspace title, clamp(40–64px) marketing statement. Body line-height is 1.55; numeric data uses tabular figures.

## Spacing and layout

The base unit is 4px. Primary gaps use 8, 12, 16, 24, 32, 48, and 64px. Content sits inside a 1180px survey-sheet frame. Desktop uses a 7/5 split for queue and detail; phone screens stack and drop the decorative hero illustration after onboarding so the next action remains first. Touch targets are at least 44px.

Independent invoices are “map rows” separated by rules, not generic cards. The active invoice gets a left trail marker and a raised paper detail sheet. Rounded corners stay modest (8–18px) and asymmetric route pins provide identity.

## Interaction grammar

- “Add invoice” plants a new route marker and opens a focused sheet.
- Selecting an invoice moves the detail sheet in from the row’s direction.
- The primary cue is always “Review draft”; the product never labels anything “send” because it cannot and must not contact a client.
- Copy actions become “Copied — paste into …” and logging a follow-up advances the next checkpoint. Users can undo the log for eight seconds.
- Destructive actions name the client/invoice and require confirmation.
- Keyboard users receive a 3px coral/cream double focus ring. Dialogs trap focus and restore it to their opener.

## Motion

Changes use 180–240ms ease-out transitions on opacity and transform only. Detail sheets translate no more than 8px; markers scale once when created. Nothing loops. With `prefers-reduced-motion: reduce`, transforms and smooth scrolling are removed and transitions become effectively instant while hierarchy remains through borders, spacing, and elevation.

## Asset plan and provenance

### Hero: `assets/hero-topography.webp`

Use case: stylized-concept. A tactile, overhead editorial still life in which an ivory paper topographic map, a dark green pencil, and three coral route pins imply a gentle planned path. No people, screens, currency, invoices, brands, writing, logos, or watermarks. The object cluster stays on the right with quiet paper on the left for copy. Soft north-window light; warm parchment, sage contour ink, deep survey green, trail coral; natural paper fibers; restrained premium editorial realism; no gradients, glossy 3D, dramatic shadows, fake text, hands, or clutter.

Generated on 2026-08-28 with the factory `factory-image` deployment through `/opt/fleet/lib/gen-image.sh`. The output is original to this product and disclosed in the footer. Source PNG and prompt sidecar live in `assets/src/`; the reviewed, cropped WebP ships in `public/assets/`. Hand-authored contour and pin SVG assets are MIT-licensed with the application.

## Responsive intent

At 390px the marketing header compresses to the mark and compact utility actions. The queue becomes a single column and the selected invoice detail opens as the next document section rather than an overlay. Dense desktop metadata is restacked into labeled pairs. Legal and settings actions remain reachable without a fixed bar, and safe-area padding protects installed-app controls.
