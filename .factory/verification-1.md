# Independent verification — FAIL

Verified on 2026-08-28 for work order `relationship-safe-payment-followup-verify-1`.

- Candidate commit: `1028348335bf630eaadf32acdce9b2586b79ad5b`
- Live URL: `https://relationship-safe-payment-followup.sociobot.in`
- Verdict: **FAIL** — the live deployment is the requested candidate, but its PWA offline and update behavior do not meet the `pwa-offline` acceptance contract.

## What was run

From a clean checkout at the candidate:

```sh
npm ci
npm test
npm run build
npm run test:e2e
```

All passed: `npm ci` completed with 0 audit vulnerabilities; Vitest passed 6/6; `npm run build` ran `tsc --noEmit` and generated `dist/`; Playwright passed 6/6 across Desktop Chromium and the repository's 390 x 844 mobile profile. There is no separate lint script.

The production build is within the stated static budgets: JS 34,159 bytes (12,140 gzip), CSS 19,126 bytes (5,120 gzip), mobile hero WebP 37,182 bytes. No third-party scripts, fonts, analytics, ads, or normal-flow outbound requests were observed on either local production build or live site. The only intentional network path in code is the Sociobot license verification endpoint when a license is entered.

## Representative product checks

Passed manually in a fresh Chromium context against the production build:

- Added a normal overdue invoice (client, contact, invoice number, amount, date, email, cadence, and relationship note); neutral email draft rendered.
- Edited the draft, blurred it, logged a follow-up, reloaded, and confirmed the draft/history persisted in IndexedDB.
- Marked the invoice paid, reopened it, and exported CSV successfully.
- Native invalid-input recovery rejected cadence `61` (`max=60` and dialog remained open).
- 390px viewport had no horizontal overflow (`scrollWidth === innerWidth === 390`); no page/console errors on local desktop, local mobile, or live load.
- Keyboard smoke test: visible 3px focus ring on skip link; Enter moved to main; invoice dialog focused the first field and Escape closed it. Reduced motion gave `0.01ms` transition duration. Axe found zero serious/critical findings on the mobile app; the included Playwright suite also scans app and privacy route.
- `/privacy` and `/terms` load with one h1 and a main landmark. Manifest supplies 192, 512, and maskable icons, standalone display, and versioned start URL.

Boundary defect observed: the UI accepts amount `0` and creates an active `$0.00` invoice. This is not a valid invoice amount for the product's overdue-payment workflow.

## PWA evidence and release blockers

### P1 — cold offline reload cannot start the app

The worker's pre-cache contains `/`, `/index.html`, offline page, manifest, icons, and hero assets, but omits the built hashed JS and CSS (`/assets/index-C-CZ2_0l.js` and `/assets/index-CgqMVqxA.css`). On a fresh online visit, after `navigator.serviceWorker.ready`, I cleared the browser HTTP cache with CDP, set Playwright offline, and reloaded.

Expected: the cached application shell should boot offline and show the workspace.

Actual: requests for the JS/CSS received service-worker `503 Offline`; the page remained at `Opening your private follow-up map…`. The cache inspection contained only:

```text
/, /index.html, /offline.html, /manifest.webmanifest, /robots.txt,
/icons/icon.svg, /icons/icon-192.png, /icons/icon-512.png,
/icons/icon-maskable-512.png, /assets/hero-topography-768.webp,
/assets/hero-topography.webp, /assets/hero-topography.jpg
```

The repository's offline test passes only after an additional online reload, which warm-caches the missing assets. That does not satisfy an offline PWA's required precached app shell.

### P1 — worker update notification is inoperative for normal deployments

`public/sw.js` uses the fixed cache name `gentle-chase-v1`. I served the exact build, loaded and activated the worker, changed only the served worker bytes, then called `registration.update()`.

Expected: a new versioned cache and the in-app “update available” toast/signal.

Actual: cache keys remained `["gentle-chase-v1"]`, `/update-signal` was absent, and no toast appeared. The worker's `isUpdate` test explicitly treats an existing cache with the same fixed name as not an update. A future deployment that changes the app/worker without manually changing this constant will silently fail the required update UX.

## Live deployment and response-policy checks

The live HTML points to `index-C-CZ2_0l.js` and `index-CgqMVqxA.css`, exactly as this candidate's `dist/index.html`. SHA-256 values matched local/live for all of the following:

| Artifact | SHA-256 |
| --- | --- |
| JS | `9aa476fee662bc152adfb2df5b47b4ec49a718d0161a2b6fe88932595ecb3e17` |
| CSS | `cf775ca8ff655b37ff64dbcefc8fb718f82889a2f8022d7aa04ee3822cf7f4fe` |
| service worker | `47ff5b9026abd4d214cad54bebb93e2c5a7a0db934e1152d099512c890b46521` |
| manifest | `0819cee6f3f77402ae12d5144de9338a7d16b3bfa8b8f941f5181e4547b8139c` |

Live root, JS, CSS, worker, manifest, and offline page all responded 200 over HTTPS with HSTS, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Content-Type-Options: nosniff`. They are all served with `Cache-Control: public, must-revalidate, max-age=30`; therefore immutable hashed JS/CSS do **not** receive the required long-lived immutable caching. No `Content-Security-Policy`, Permissions-Policy, COOP, or CORP header was present. The short caching and absent CSP are recorded as deployment hardening/performance findings; the PWA defects above independently cause the FAIL.

## Defects by severity

1. **P1 / release blocker:** cold offline reload fails because the actual JS/CSS app shell is not pre-cached.
2. **P1 / release blocker:** service-worker update toast/signal fails when worker bytes change without manually changing the fixed cache name.
3. **P2:** amount `0` is accepted as a live invoice and displayed as `$0.00`; require an amount greater than zero.
4. **P2 (deployment):** hashed static assets are cached for only 30 seconds, not long-lived immutable as required.
5. **P3 (deployment hardening):** no Content-Security-Policy or related browser isolation/policy headers.

## Retest guidance

Precache the generated hashed JS and CSS (or generate the worker manifest at build time); derive a new worker cache version per build; test a first-visit cold offline reload after clearing HTTP cache; and run a two-version worker update test that asserts the update toast. Reject zero amounts. Configure immutable cache headers for hashed assets and a suitable CSP. Then rerun the commands and scenarios above against a freshly deployed build.
