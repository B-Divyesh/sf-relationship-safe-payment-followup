# Independent verification — FAIL

Verified on 2026-08-28 for work order `relationship-safe-payment-followup-verify-2`.

- Candidate commit: `6612c5222940c7c766b0cfd74a27cc32a76b5ca7`
- Live URL: `https://relationship-safe-payment-followup.sociobot.in`
- Verdict: **FAIL** — the product itself, PWA behaviour, and deployed static artifacts pass the checks below, but the required Sociobot product-unlock endpoint did not rate-limit a rapid burst.

## Clean local verification

The checkout was clean and at the requested commit before testing. I ran:

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

- `npm ci` installed the locked dependency set and reported 0 vulnerabilities.
- `npm test`: 7/7 Vitest tests passed. There is no repository lint script; `npm run build` includes `tsc --noEmit`.
- `npm run build` passed and produced `dist/`. Initial JS is 34,261 bytes (12,170 gzip), CSS is 19,126 bytes (5,120 gzip), and the mobile hero WebP is 37,182 bytes — all within the 200 KB JS, 50 KB CSS, and 300 KB hero budgets.
- `npm run test:e2e`: 13 Playwright checks passed across Desktop Chromium and the configured 390×844 mobile project; the duplicate mobile worker-mutation check was intentionally skipped. It covers persistence, first-visit offline reload, service-worker update notification/cache version, zero-value rejection, keyboard dialog/skip-link behaviour, legal routes, axe serious/critical checks, and license restore.
- `npm audit --omit=dev`: 0 vulnerabilities.

## Independent product and accessibility checks

The smallest useful local-first workflow is present: invoice amount/due date/contact preference/cadence/notes, editable email or WhatsApp copy, manual follow-up logging, paid/reopen state, IndexedDB persistence, JSON/CSV export, JSON import, and confirmed local deletion. It does not send a message or process a payment.

- Zero amount was rejected by native validity (`min=0.01`); amount `$0.01` and cadence `60` are accepted boundaries.
- Invalid JSON import produced a readable parse error and a subsequent mixed import recovered successfully, showing the valid `Harbor` record while skipping the zero-value record.
- Delete-all displayed the specific confirmation: `Delete all 1 invoice records and their local history from this browser? This cannot be undone.`; accepting it returned to the empty state.
- Local and live 390px checks had no horizontal overflow. Live desktop and mobile cold offline reloads were controlled by the service worker and loaded the cached hashed JS/CSS with HTTP 200 / `fromServiceWorker: true`; no page or console errors occurred.
- Live mobile axe scans of the app and `/privacy` had zero serious/critical findings. Keyboard Tab reached the skip link with a visible 3px outline; reduced motion set the tested action transition to `0.00001s`.
- The source and live normal-flow request capture show no analytics, trackers, third-party fonts/scripts, or invoice-data requests. Normal live loads contacted only `relationship-safe-payment-followup.sociobot.in`. Data is stored in IndexedDB; localStorage is limited to the license token and cached verdict. The only intentional external request is the Sociobot license verification endpoint.

## Live deployment, PWA, and response policy

The live deployment is the candidate build. The live root referenced `/assets/index-BVdw3gLe.js` and `/assets/index-CgqMVqxA.css`; SHA-256 matched the locally built artifacts:

| Artifact | SHA-256 |
| --- | --- |
| `/` / `dist/index.html` | `65baf48782cd83dbfa811a4e2795bd1fbb54ac8b04ea93c52c40eae7e96a8bcf` |
| `/assets/index-BVdw3gLe.js` | `5eef39cc966e3d7e6f55291569af58bd3aadd857e37309f6cf55c1cbdbf90ea1` |
| `/assets/index-CgqMVqxA.css` | `cf775ca8ff655b37ff64dbcefc8fb718f82889a2f8022d7aa04ee3822cf7f4fe` |
| `/sw.js` | `e324387b88416e9599287f2a02de9fe403dee8c7628099c1e75d52ec7de67dee` |
| `/manifest.webmanifest` | `0819cee6f3f77402ae12d5144de9338a7d16b3bfa8b8f941f5181e4547b8139c` |

The manifest has standalone display, versioned start URL, 192/512/maskable icons, and product theme/background colours. Fresh local and live offline reloads passed after clearing the HTTP cache. The local two-version service-worker regression passed and showed the update notification/new cache.

Live documents and worker are revalidated; hashed assets return `Cache-Control: public, max-age=31536000, immutable`. The live host returned HSTS, self-only CSP, restrictive Permissions-Policy, COOP, CORP, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Content-Type-Options: nosniff`. The license endpoint returned appropriate credentialed CORS for the live origin and `Cache-Control: no-store`.

## Release-blocking defect

1. **P1 — license verification endpoint is not rate limited.** I sent 100 rapid requests in parallel (20-way concurrency) to `GET https://api.sociobot.in/api/v1/products/relationship-safe-payment-followup/verify?license=qa-invalid-<n>`. All 100 returned `200` with the expected invalid-license JSON. No response returned `429`; therefore no `Retry-After` header or threshold was observed (threshold: **not reached through 100 requests**). The acceptance contract explicitly requires a burst to start returning `429` with `Retry-After` for server-side endpoints, including factory product-unlock calls. This is an API/deployment configuration issue outside the static app, but it blocks release verification.

No other defects were found in this verification pass.

## Retest

Configure and deploy rate limiting for the Sociobot verification endpoint, then rerun a fresh burst against the same endpoint and record the first `429` plus its `Retry-After` header. Re-run the clean local commands and live artifact hash/PWA checks after that deployment.
