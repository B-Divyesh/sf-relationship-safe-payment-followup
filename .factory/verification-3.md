# Independent verification 3 — FAIL

Verified on 2026-08-28 for work order `relationship-safe-payment-followup-verify-3`.

- Candidate commit: `6612c5222940c7c766b0cfd74a27cc32a76b5ca7`
- Live URL: `https://relationship-safe-payment-followup.sociobot.in`
- Verdict: **FAIL**
- Release blockers: a semantically invalid imported date is persisted and then bricks every reload; the advertised one-time purchase endpoint returns HTTP 404.
- Prior blocker status: **resolved**. The Sociobot verification endpoint now rate-limits and returns `429` with `Retry-After`.

## Clean candidate gates

I created a clean detached worktree at the exact candidate commit. It was clean before and after verification. Commands and results:

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

- `npm ci`: passed; 60 packages installed from the lockfile; audit reported 0 vulnerabilities.
- `npm test`: **7/7 passed** in two Vitest files.
- There is no lint script. The available type check is `tsc --noEmit`, which is part of `npm run build` and passed.
- `npm run build`: passed and produced `dist/` using the exact production command.
- `npm run test:e2e`: **13 passed, 1 intentionally skipped**. The skip is the duplicate mobile execution of the test that mutates the generated worker once. Desktop Chromium and the configured 390×844 mobile project passed creation, persistence, populated offline reload, cold-shell offline reload, service-worker update notification/cache replacement, zero-value rejection, keyboard dialog and skip-link behavior, axe checks, legal routes, and mocked license restoration.
- `npm audit --omit=dev`: 0 vulnerabilities.

Production payload sizes are within the contract:

| Initial asset | Raw | Gzip/build output | Budget |
| --- | ---: | ---: | ---: |
| JavaScript | 34,261 B | 12,170 B | ≤ 200 KB |
| CSS | 19,126 B | 5,120 B | ≤ 50 KB |
| Mobile hero WebP | 37,182 B | n/a | ≤ 300 KB |
| Web fonts | 0 B | n/a | ≤ 120 KB |

The sourcemap is not requested during initial load. The build target is ES2022.

## Independent product QA

I ran additional Playwright probes against the production build on desktop and 390×844 mobile, separate from the repository suite.

Passing behavior:

- Created and persisted an invoice at the accepted minimum amount `$0.01` and cadence `1`; cadence `60` also imported successfully.
- Native validation rejected amount `0`, cadence `0`, cadence `61`, and a malformed email, after which corrected values saved normally.
- Created email and WhatsApp routes, verified editable relationship-neutral drafts, changed and persisted a draft, copied each channel, and confirmed the UI stated that nothing was sent. No outbound messaging request occurred.
- Logged a follow-up, advanced the cue, used the eight-second undo, reloaded, marked paid, reopened, and retained the stored draft and notes.
- The free tier accepted five active invoices, opened the license panel instead of accepting a sixth, and allowed a new active invoice after one was marked paid.
- JSON export contained the private note; CSV export prefixed a formula-like client value (`=Harbor & Sons`) with an apostrophe. A structurally invalid bundle produced a readable error. A subsequent mixed import accepted one valid record and skipped a zero-amount record.
- “Delete all local data” named the exact one-record scope in its confirmation, then returned to the usable empty state.
- No normal-flow page or console errors occurred. No horizontal overflow appeared at 390 px.

Failing invalid-input recovery:

1. Open **Data, license, and settings**.
2. Import a JSON bundle containing an otherwise valid record whose `dueDate` is `2026-99-99`.
3. The record passes `normalizeInvoice`, is written to IndexedDB, and formatting it raises `Invalid time value`.
4. Reload the page.
5. The same `Invalid time value` page error occurs and the app remains indefinitely on **“Opening your private follow-up map…”**. There is no import/delete/recovery control on that shell.

I reproduced this both against the clean local production build and the live URL. Existing records remain in IndexedDB but the UI is inaccessible; a normal user can only recover by clearing all site storage and losing those records. This violates the required invalid-input recovery and usable error-state contract.

## Accessibility, keyboard, and visual checks

- Repository axe runs on the populated workspace and privacy route reported **0 serious/critical findings** in desktop and mobile projects.
- Independent live axe runs on the landing screen at desktop and 390 px also reported **0 serious/critical findings**.
- Live markup has `lang="en"`, a non-empty title, exactly one `<h1>`, a `<main>`, image alt text, and labeled buttons. `/privacy` and `/terms` each return 200 and render their dedicated content client-side.
- Keyboard Tab reveals a designed 3 px focus outline on the skip link; Enter moves focus to the main landmark. The invoice dialog focuses its first field, Escape closes it, and focus returns to the opener.
- With `prefers-reduced-motion: reduce`, the tested button transition computed to `0.00001s`; smooth scrolling and transforms are disabled by the reduced-motion rule.
- Visual inspection of full-page desktop and 390 px screenshots found coherent hierarchy, legible content, and no clipping or horizontal overflow.
- Minor target-size miss: in a populated 390 px workspace, **See one-time unlock** measured 148×43 px. In the settings fine print, **Terms** measured 35×14 px and **Privacy** 43×14 px. These are below the supplied 44×44 px touch-target rule.

`/opt/fleet/lib/verify-url.sh` against production passed: HTTP 200, title/lang/main present, one `<h1>`, no missing image alt text, no unlabeled buttons, and no console/page errors.

Lighthouse mobile on the live URL:

| Category/metric | Result |
| --- | ---: |
| Performance | 98 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |
| FCP | 1.04 s |
| LCP | 1.31 s |
| TBT | 154.5 ms |
| CLS | 0 |

## Privacy and outbound requests

- Fresh live landing loads at desktop and mobile contacted only `relationship-safe-payment-followup.sociobot.in`.
- The source contains no analytics, advertising, tracking SDK, third-party script/font, beacon, or customer-data upload. The only programmatic external request is Sociobot license verification.
- Invoice data is stored in IndexedDB. A live invalid-license check stored only the `sb_license:relationship-safe-payment-followup` token and its cached verdict in `localStorage`; it stripped `?license=` from the URL before showing the result.
- The live invalid-license browser flow made exactly one API request, containing only the test token. It quietly kept Plus locked.
- The verification API returned credentialed CORS for the exact live origin and `Cache-Control: no-store`.
- The app has no sign-in requirement, so the Microsoft Entra tenant requirement is not applicable.

## Live identity, PWA, caching, and policies

The live deployment is byte-identical to the candidate production build for all boot-critical artifacts:

| Artifact | Candidate and live SHA-256 |
| --- | --- |
| `index.html` | `65baf48782cd83dbfa811a4e2795bd1fbb54ac8b04ea93c52c40eae7e96a8bcf` |
| `assets/index-BVdw3gLe.js` | `5eef39cc966e3d7e6f55291569af58bd3aadd857e37309f6cf55c1cbdbf90ea1` |
| `assets/index-CgqMVqxA.css` | `cf775ca8ff655b37ff64dbcefc8fb718f82889a2f8022d7aa04ee3822cf7f4fe` |
| `sw.js` | `e324387b88416e9599287f2a02de9fe403dee8c7628099c1e75d52ec7de67dee` |
| `manifest.webmanifest` | `0819cee6f3f77402ae12d5144de9338a7d16b3bfa8b8f941f5181e4547b8139c` |

- The manifest has a versioned ID/start URL, standalone display, product colors, 192×192 and 512×512 icons, and a separate 512×512 maskable declaration.
- Fresh live desktop and 390 px contexts waited for worker control, cleared the HTTP cache, went offline, and reloaded. The hashed JS and CSS each returned 200 from the service worker; the UI and offline banner rendered with no errors.
- The local two-version service-worker test changed the generated worker, observed the update toast, installed a different cache version, and passed. The worker uses a build-derived cache name, `skipWaiting`, `clients.claim`, and old-cache deletion.
- Documents and `sw.js` use `public, max-age=0, must-revalidate`; an `If-None-Match` request returned 304. Hashed assets use `public, max-age=31536000, immutable`.
- The live root returns HSTS, self-only CSP without unsafe script/style allowances, restrictive Permissions-Policy, COOP `same-origin`, CORP `same-origin`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Content-Type-Options: nosniff`.

This is a static PWA with no product-owned backend, health endpoint, server persistence, library package, or CLI. Those backend/library-only checks are not applicable.

## Sociobot endpoint results

The earlier rate-limit blocker is fixed.

- After an idle reset, a rapid sequential burst to `GET https://api.sociobot.in/api/v1/products/relationship-safe-payment-followup/verify?license=...` returned 30 × HTTP 200 and HTTP **429 on request 31**.
- The 429 included `Retry-After: 3` and `X-RateLimit-After: 3`.
- A rapid parallel burst of 160 requests at concurrency 20 returned 31 × 200 and 129 × 429.
- A throttled request carrying the production Origin also returned `Access-Control-Allow-Origin: https://relationship-safe-payment-followup.sociobot.in`.

However, the advertised purchase path is not operational:

```text
GET https://api.sociobot.in/api/v1/products/relationship-safe-payment-followup/checkout
HTTP 404
{"error":"enabled factory product","status":404}
```

The live settings dialog links its primary **Buy once — $19** action to that exact URL. A user therefore cannot purchase the advertised Plus unlock.

## Defects by severity

### P1 — Imported impossible date persistently bricks the app

`normalizeInvoice` checks only the `YYYY-MM-DD` shape and accepts `2026-99-99`. Import writes the record before rendering; date formatting then throws. Every reload repeats the exception and leaves only the loading shell, with no in-app recovery. Reproduced locally and live.

Required remediation: validate dates by parsing and round-tripping them (including imported history timestamps), reject/skip invalid records before any write, and ensure a corrupt stored record leads to a usable error/recovery surface rather than an uncaught render failure.

### P1 — The advertised one-time purchase endpoint returns 404

The live **Buy once — $19** CTA targets the required Sociobot checkout route, but that route says the factory product is not enabled. Free functionality remains usable, but the promised paid product cannot be bought.

Required remediation: register/enable the slug and `$19` product in the production Sociobot billing catalog, then verify that this GET redirects to hosted checkout and that a returned license unlocks and restores on another clean browser.

### P3 — Three mobile settings/workspace targets miss 44×44 px

The one-time-unlock inline button is 43 px tall, while the inline Terms and Privacy links in settings are 14 px tall and narrower than 44 px. Increase their hit areas without changing the visual text size.

## Retest

After fixing both P1 issues, rerun the clean commands, import an impossible date into a browser that already contains valid records and verify graceful rejection plus reload, exercise a real test-mode checkout/license return/restore, repeat artifact hashes and live offline reloads, and reconfirm the 31st-request rate-limit behavior.
