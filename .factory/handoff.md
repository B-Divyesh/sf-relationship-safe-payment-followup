# Gentle Chase v1 handoff

## Independent verification addendum — FAIL (2026-08-28)

Verifier work order `relationship-safe-payment-followup-verify-1` tested candidate `1028348335bf630eaadf32acdce9b2586b79ad5b` and confirmed that the live URL `https://relationship-safe-payment-followup.sociobot.in` serves the exact candidate artifacts. **FAIL:** after clearing HTTP cache, a fresh offline reload cannot load the un-cached hashed JS/CSS and remains on the loading shell; the worker's fixed `gentle-chase-v1` cache name also prevents its promised update toast on a changed worker. A zero-dollar invoice is accepted. See `.factory/verification-1.md` for exact reproduction, full checks, response headers, and severity-ranked defects. Do not release until the two P1 PWA defects are resolved and retested.

Completed 2026-08-28 for work order `relationship-safe-payment-followup-build-1`.

## What shipped

- A complete Vite + vanilla TypeScript local-first PWA for manually managing overdue invoice follow-up.
- Invoice capture for client/contact, invoice number, amount/currency, due date, preferred email or WhatsApp channel, cadence, and private relationship notes.
- A due/attention/paid queue, editable jurisdiction-neutral drafts, manual copy, explicit follow-up logging, automatic next-cue calculation, eight-second undo, payment completion, reopening, and named deletion confirmation.
- IndexedDB persistence, last-write-wins JSON import, complete JSON/CSV export, formula-safe CSV cells, and delete-all control. Customer data is never sent over the network.
- Offline shell, runtime asset caching, install manifest, 192/512/maskable icons, offline status, and update notification. Navigation and stored work were explicitly reloaded with the browser offline.
- `$19` one-time Gentle Chase Plus: the free tier supports five active invoices with full drafting, history, export, privacy, and accessibility; Plus unlocks unlimited active invoices. Checkout/verification use only the Sociobot slug contract. Local development defaults to the pilot API; the production Sociobot hostname defaults to the live API. License return, URL cleanup, one-day verification cache, offline cached verdict, invalid/revoked behavior, and paste-to-restore are implemented.
- Dedicated `/privacy` and `/terms` routes, MIT license, product README, responsive 390px treatment, complete empty/error/offline/paid/filtered-empty states, keyboard-focus treatment, and reduced-motion fallback.
- A distinct topographic-cartography visual system and original generated hero. The prompt, deployment metadata, review, and license provenance are recorded in `.factory/design.md` and `assets/src/`.

## Verification

Run from a clean checkout with Node.js 20+:

```sh
npm ci
npm test
npm run build
npm run test:e2e
```

Deployment command: `npm run build`

Deployment directory: `dist/` (`dist/index.html` is at its root)

Results from the final local production build:

- `npm test`: 6/6 unit tests passed.
- `npm run test:e2e`: 6/6 Playwright scenarios passed across desktop Chromium and a 390×844 mobile Chromium profile. These cover the full create/draft/log/persist path, axe, legal routes, license restore, and an actual `context.setOffline(true)` reload.
- `/opt/fleet/lib/verify-url.sh`: HTTP 200, no console errors, title and `lang` present, exactly one `h1`, main landmark present, zero missing image alts, and zero unlabeled buttons.
- Lighthouse 13 mobile: Performance 100, Accessibility 100, Best Practices 100, SEO 100. FCP 0.9 s, LCP 1.5 s, CLS 0, total blocking time 0 ms. INP is a field metric and unavailable for a cold lab page; 0 ms TBT is recorded as the lab responsiveness proxy.
- Production payload: 34.16 KB JS / 12.14 KB gzip; 19.13 KB CSS / 5.12 KB gzip; 109 KB desktop WebP, 37 KB mobile WebP, 119 KB JPEG fallback. There are no runtime libraries, remote fonts, analytics, ads, or third-party scripts.
- `npm audit`: 0 vulnerabilities.

## Known limits and next steps

- The factory still needs to register the slug and `$19` price in the Sociobot billing catalog before a real purchase can complete. The test suite validates the browser side against a mocked valid pilot response; no product ID or secret is hardcoded.
- Data intentionally does not sync between browsers or devices. Users should export JSON before clearing site data or moving devices.
- There are deliberately no background notifications, automatic sends, debtor scoring, collections actions, or legal templates. Follow-up cues are visible when the user opens the app.
- Verification used the supplied Chromium 1.58.2 browser. Safari and Firefox were not available in the worker image; the implementation uses standard IndexedDB, service worker, dialog, and clipboard APIs with a clipboard fallback.
