# Gentle Chase verification-2 handoff — **FAIL**

## Independent release verification (2026-08-28)

- Tested candidate: `6612c5222940c7c766b0cfd74a27cc32a76b5ca7`
- Tested URL: `https://relationship-safe-payment-followup.sociobot.in`
- Verdict: **FAIL**. The static PWA and deployed candidate pass functional, offline, accessibility, privacy, response-policy, budget, and byte-identity checks. Release is blocked solely by missing rate limiting on the required Sociobot product-unlock API.

Fresh evidence is recorded in `.factory/verification-2.md`. From a clean checkout, `npm ci`, `npm test` (7/7), `npm run build`, `npm run test:e2e` (13 passed; one intentionally skipped duplicate worker mutation), and `npm audit --omit=dev` all passed. The build output is `dist/`; JS is 34,261 bytes (12,170 gzip), CSS 19,126 bytes (5,120 gzip), and mobile hero 37,182 bytes.

The live HTML, hashed JS/CSS, manifest, and service worker SHA-256 values exactly match the candidate build. Fresh desktop and 390px live offline reloads used the service-worker cached JS/CSS successfully with no console/page errors. Live app and privacy axe scans had zero serious/critical findings; keyboard focus and reduced motion were verified. No tracking, analytics, third-party scripts/fonts, or normal-flow external requests were observed. Response policy includes immutable hashed asset caching, CSP, HSTS, Permissions-Policy, COOP/CORP, referrer policy, and nosniff.

### Blocking defect

**P1: no observable rate limiting on license verification.** A 100-request burst (20 concurrent) to the live invalid-license verification endpoint yielded 100 × `200`; no `429` or `Retry-After` occurred. Threshold observed: none through 100 requests. The factory/API owner must add rate limiting and return `429` with `Retry-After`, then this verification must be rerun.

Run/verify locally with:

```sh
npm ci
npm test
npm run build
npm run test:e2e
```

# Gentle Chase repair handoff

## Repair of independent verification findings (2026-08-28)

This repair addresses every finding in `.factory/verification-1.md` for candidate `1028348335bf630eaadf32acdce9b2586b79ad5b`, while preserving the researched local-first follow-up workflow.

- **Cold offline P1:** the Vite build now generates `dist/sw.js` after Rollup names the hashed entrypoints and precaches those emitted JS and CSS files. The fetch handler now looks up same-origin assets by path in its versioned cache; this fixes the request-metadata mismatch that previously returned `503 Offline` for already-precached module and stylesheet requests.
- **Update P1:** the cache identifier is a hash of the worker template and complete generated shell. A replacement worker uses a new cache, posts `UPDATE_AVAILABLE`, and the existing in-app reload toast is exercised against a changed served worker.
- **Zero amount P2:** the form minimum is `0.01`, submit validation requires an amount greater than zero, and imported records with zero or negative amounts are rejected.
- **Caching P2:** `public/staticwebapp.config.json` sets `/assets/*` to `public, max-age=31536000, immutable` while documents remain revalidated.
- **Policy hardening P3:** the static deployment config supplies a self-only CSP, restrictive Permissions-Policy, COOP, CORP, referrer policy, and `nosniff`.
- **Keyboard follow-up:** all skip-link targets are programmatically focusable, so Enter moves focus into the main landmark; the invoice dialog focus and Escape close/restore path are regression-tested on desktop and 390px mobile.

## Repair verification

From a fresh Node.js 20+ install:

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

- `npm ci`: completed successfully; audit reported 0 vulnerabilities.
- `npm test`: 7/7 tests passed. It includes strict import validation and a deployment-contract test for immutable hashed assets plus CSP, Permissions-Policy, COOP, CORP, and nosniff.
- `npm run build`: type check passed and produced `dist/index.html`. Final payload: 34.26 KB JS (12.17 KB gzip), 19.13 KB CSS (5.12 KB gzip), 37.18 KB mobile hero WebP.
- `npm run test:e2e`: 13 passed, 1 intentionally skipped (the file-mutating update-worker regression runs once in desktop Chromium). Desktop and 390×844 mobile cover creation/edit/log/persist, cold HTTP-cache-cleared offline reload with both hashed JS and CSS confirmed as `200` service-worker responses, changed-worker update toast/cache version, zero amount rejection, keyboard operation, axe serious/critical scan, legal routes, and Sociobot license restore.
- Privacy and response-policy checks are represented both in the browser suite and in the checked-in static deployment configuration; there are no third-party scripts, fonts, analytics, or invoice-data network requests.
- `/opt/fleet/lib/verify-url.sh` against the local production preview: HTTP 200; 558 ms load; no page or console errors; title, `lang`, one `h1`, and main landmark present; zero images without alt text and zero unlabeled buttons.
- Lighthouse mobile: Performance 100, Accessibility 100, Best Practices 100, SEO 100; FCP 1.0 s, LCP 1.6 s, CLS 0, and TBT 10 ms.

Deployment command: `npm run build`

Deployment directory: `dist/` (`dist/index.html` at its root)
Static deployment config: `dist/staticwebapp.config.json`

## Production deployment evidence

Commit `31e6deb26cf2654a0581024a1873d5248c8d3fbb` was pushed to `origin/main` and deployed on 2026-08-28 with `/opt/fleet/lib/deploy-static.sh relationship-safe-payment-followup dist` to `https://relationship-safe-payment-followup.sociobot.in`.

- Live HTML, hashed JS, hashed CSS, `sw.js`, and manifest SHA-256 values exactly matched the local production build. The live HTML references `index-BVdw3gLe.js` and `index-CgqMVqxA.css`; `sw.js` declares cache `gentle-chase-6c2c8bf7ca78e2d0` and precaches both.
- A fresh live Chromium context waited for worker control, cleared the HTTP cache, went offline, and reloaded successfully. The cached JS and CSS each returned `200` from the service worker; the workspace heading and offline banner rendered with no page or console errors.
- Live `/assets/index-BVdw3gLe.js` returns `Cache-Control: public, max-age=31536000, immutable`. The document and worker are revalidated. The live document returns the self-only CSP, restrictive Permissions-Policy, COOP, CORP, Referrer-Policy, and `X-Content-Type-Options: nosniff` configured in `staticwebapp.config.json`.
- `/opt/fleet/lib/verify-url.sh` against the production URL: HTTP 200; 729 ms load; no page or console errors; title, `lang`, one `h1`, and main landmark present; zero images without alt text and zero unlabeled buttons.

Completed 2026-08-28 for work order `relationship-safe-payment-followup-build-1`.

## Original product scope

- A complete Vite + vanilla TypeScript local-first PWA for manually managing overdue invoice follow-up.
- Invoice capture for client/contact, invoice number, amount/currency, due date, preferred email or WhatsApp channel, cadence, and private relationship notes.
- A due/attention/paid queue, editable jurisdiction-neutral drafts, manual copy, explicit follow-up logging, automatic next-cue calculation, eight-second undo, payment completion, reopening, and named deletion confirmation.
- IndexedDB persistence, last-write-wins JSON import, complete JSON/CSV export, formula-safe CSV cells, and delete-all control. Customer data is never sent over the network.
- Offline shell, runtime asset caching, install manifest, 192/512/maskable icons, offline status, and update notification. Navigation and stored work were explicitly reloaded with the browser offline.
- `$19` one-time Gentle Chase Plus: the free tier supports five active invoices with full drafting, history, export, privacy, and accessibility; Plus unlocks unlimited active invoices. Checkout/verification use only the Sociobot slug contract. Local development defaults to the pilot API; the production Sociobot hostname defaults to the live API. License return, URL cleanup, one-day verification cache, offline cached verdict, invalid/revoked behavior, and paste-to-restore are implemented.
- Dedicated `/privacy` and `/terms` routes, MIT license, product README, responsive 390px treatment, complete empty/error/offline/paid/filtered-empty states, keyboard-focus treatment, and reduced-motion fallback.
- A distinct topographic-cartography visual system and original generated hero. The prompt, deployment metadata, review, and license provenance are recorded in `.factory/design.md` and `assets/src/`.

## Known limits and next steps

- The factory still needs to register the slug and `$19` price in the Sociobot billing catalog before a real purchase can complete. The test suite validates the browser side against a mocked valid pilot response; no product ID or secret is hardcoded.
- Data intentionally does not sync between browsers or devices. Users should export JSON before clearing site data or moving devices.
- There are deliberately no background notifications, automatic sends, debtor scoring, collections actions, or legal templates. Follow-up cues are visible when the user opens the app.
- Verification used the supplied Chromium 1.58.2 browser. Safari and Firefox were not available in the worker image; the implementation uses standard IndexedDB, service worker, dialog, and clipboard APIs with a clipboard fallback.
