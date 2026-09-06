# Independent verification 4 — FAIL

Verified on 2026-09-06 for work order `relationship-safe-payment-followup-verify-4`.

- Verdict: **FAIL**
- Finding count: **2**
- Untested claim count: **0**
- Implementation reviewed: `cf7504011166c0b283236794132d23c6f8a831e9`
- Documentation baseline: `bf94e11bdab4fe38e2bafe89a1fa46a0478957e1`
- Live URL: `https://relationship-safe-payment-followup.sociobot.in`

The free local-first product and all seven declared claims pass. Release still fails because the advertised paid purchase path returns HTTP 404. A populated workspace also has one moderate axe landmark-structure finding.

## Findings

### P1 — The advertised $19 purchase cannot be completed

The live **Buy once — $19** link points to the required Sociobot URL:

```text
https://api.sociobot.in/api/v1/products/relationship-safe-payment-followup/checkout
```

On 2026-09-06 it returned:

```text
HTTP 404
{"error":"enabled factory product","status":404}
```

This is a failed user path, not the deliberate designed 404 used for unknown product-site routes. A visitor cannot buy the advertised one-time license. The recorded-fixture test for an already verified license passes, but a real purchase, return token, refund, and fresh-browser restore cannot be exercised until the offer is registered externally.

Required action: enable the `relationship-safe-payment-followup` production offer in the Sociobot billing catalog, then verify hosted checkout, return, verification, restore, and refund revocation. No product-provider credential or direct payment integration belongs in this repository.

### P3 — Populated workspace exposes a nested complementary landmark

Live axe-core 4.10.2 reports one moderate best-practice violation on `/demo`:

```text
landmark-complementary-is-top-level
Aside should not be contained in another landmark
target: aside.limit-note
```

The free-limit note is an `<aside>` inside the invoice queue `<section>`. It becomes a complementary landmark nested in another landmark. Use a non-landmark element for this inline status/action, or restructure and label it so the landmark hierarchy is valid.

No serious or critical axe findings were found. Landing, Privacy, Terms, and the designed 404 returned no axe violations.

## First screen and one-click sample

Fresh 1366×900 desktop and 390×844 phone contexts showed all required information before scrolling:

- Job: **Write and track invoice follow-ups**.
- Audience: freelancers and family businesses wanting consistent reminders without automatic debt collection.
- First action: **Try it with sample data**.
- Facts: browser-local data, offline use after the first visit, five free active invoices, and the $19 Plus price.

The visible instructions use invoice and follow-up terms rather than map metaphors. The cartography remains visual styling.

The sample opened in one click. It showed the persistent **Demo — sample data, nothing is saved to your records** label, Northwind Studio and Harbor & Pine, a realistic $1,250 invoice, notes, next dates, and editable email copy. After editing and logging the sample draft, **Reset demo** restored the original draft and empty Northwind history. **Start for real** returned to a pre-existing `QA Real Ledger` record; no sample record entered the real database. IndexedDB exposed separate `gentle-chase` and `gentle-chase-demo` databases.

## Clean checkout and declared claims

A fresh clone of `main` resolved to documentation SHA `bf94e11bdab4fe38e2bafe89a1fa46a0478957e1`. Only `.factory/handoff.md` differs from implementation SHA `cf7504011166c0b283236794132d23c6f8a831e9`; no later product code exists.

The documented setup and quality gates passed sequentially:

```text
npm ci                 PASS — 60 packages, 0 vulnerabilities
npm test               PASS — 8/8
npm run build          PASS — dist/index.html produced
npm run test:e2e       PASS — 30 passed, 2 intentional project skips
npm audit --omit=dev   PASS — 0 vulnerabilities
```

Every command from `.factory/claims.json` was run separately from that clean checkout:

| Claim | Result | Observable evidence |
| --- | --- | --- |
| `offline-reload` | PASS | Fresh `/demo`, worker control, HTTP cache cleared, offline reload; built JS and CSS returned 200 from the worker. |
| `demo-sandbox` | PASS | A real invoice survived demo entry/reset/exit; sample records did not enter real storage. |
| `local-data` | PASS | Created record persisted after reload; requests remained same-origin. |
| `manual-drafts` | PASS | Edited, copied, and logged the draft; no client or external request occurred. |
| `data-export` | PASS | JSON parsed with three records; CSV had the header and three rows. |
| `free-limit` | PASS | Five active invoices saved; the sixth opened licensing and was not stored. |
| `plus-limit` | PASS | Recorded valid verification response unlocked and persisted a sixth invoice. |

Untested claim count is zero. The paid checkout was tested and failed, so it is recorded as a finding rather than an untested claim.

## Live functional and recovery checks

- Normal workflow: created and persisted a real invoice with amount, due date, contact, cadence, and relationship note; the populated draft named the client, invoice, amount, and due date.
- Invalid and boundary input: amount `0`, cadence `0`, and malformed email remained in the dialog with native invalid states. Amount `0.01` and cadence `60` saved.
- Impossible import: `2026-99-99` reported `0 invoice records imported; 1 skipped`; a valid existing record survived reload.
- Damaged existing storage: a directly seeded impossible date produced the visible recovery warning. **Remove damaged record** removed only the bad record, and the valid record survived another reload.
- Deletion: **Delete all local data** named the exact one-record scope and returned to the empty landing state after confirmation.
- Export: both JSON and CSV passed the declared sample-data claim.
- Network and console: fresh landing and demo flows produced no page/console errors and no off-origin requests.

## Accessibility, keyboard, mobile, and motion

- `verify-url.sh` passed live `/` and `/demo`: title, language, one h1, main landmark, alt text, button names, and no console/page errors.
- Live axe scans covered fresh desktop and phone landing screens, populated demo, Privacy, Terms, and 404. The single moderate issue is finding P3; there were no serious/critical issues.
- Tab focused the skip link with a 3px coral outline. Enter focused `main`. The invoice dialog focused its first field; Escape closed it and returned focus to the opener.
- Internal route changes and browser back/forward updated the title and focused the new h1.
- Reduced motion computed to `0.00001s` for transition and animation duration.
- All visible links and buttons measured in the populated 390×844 demo and settings dialog were at least 44×44 CSS px. The repaired controls measured 157.86×50.66 (**See one-time purchase**), 44×44 (Terms and Privacy), and 187.78×50.34 (**Buy once — $19**).
- The 390px layout had no clipping in the reviewed first-screen and full-page captures. A 640 CSS-pixel viewport, equivalent to 200% zoom on a 1280px desktop, kept `scrollWidth` equal to `innerWidth` and retained all 16 workspace buttons.

## PWA, privacy, routes, links, and deployment

- Fresh live `/demo` gained service-worker control, cleared the HTTP cache, went offline, and reloaded with the sample. Hashed JS and CSS returned 200 with `fromServiceWorker: true`.
- The worker cache contains the document shell, designed 404/offline pages, manifest, icons, original art, social image, and current hashed JS/CSS.
- The local two-version worker test passed and observed the update notice plus a new cache version.
- `/`, `/demo`, `/privacy`, and `/terms` return 200 with distinct correct titles. `/verification-4-missing` deliberately returns HTTP 404 with the designed **Page not found** page and a working route home.
- Every live link discovered from the populated demo/settings surface returned 200 except the broken checkout in finding P1. The GitHub source link returned 200.
- Root and demo requested only the product origin. The invalid-license API permits the exact product origin and returns `Cache-Control: no-store`. Invoice data stayed in IndexedDB; no analytics, trackers, CDN scripts, or hosted fonts were observed.
- Documents revalidate. Hashed JS/CSS use one-year immutable caching. CSP, HSTS, Permissions-Policy, COOP, CORP, strict referrer policy, and `nosniff` are live.
- This is a static PWA. Product-owned backend tenancy, SQLite restart persistence, and a product health route do not apply.
- The external verification endpoint still rate-limits correctly: requests 1–30 returned 200; request 31 returned 429 with `Retry-After: 3`. A later request with the live Origin returned exact-origin CORS and `Cache-Control: no-store`.

Live Lighthouse mobile results:

| Category/metric | Result |
| --- | ---: |
| Performance | 100 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |
| FCP | 1.0 s |
| LCP | 1.3 s |
| TBT | 60 ms |
| CLS | 0 |

Initial assets remain within budget: JavaScript 40,541 B raw / 13.90 KB gzip; CSS 20,909 B raw / 5.43 KB gzip; mobile hero 37,182 B; no web fonts.

## Candidate identity

The live deployment is byte-identical to the clean build from the reviewed implementation:

| Artifact | SHA-256 |
| --- | --- |
| `index.html` | `f91f8fce119f1c334696d7e711a7ac78aca70ca9c0085e3f2eec15fc4f7aa971` |
| `assets/index-DTSC-vzS.js` | `3c30b2b7fa0e0ffb958282a8673dd4b60f5bce7c6787fb4d3955bff82fe5f3c5` |
| `assets/index-BE4BjwZa.css` | `ba94cf64967d3c6f02c2e8f14d63ba4b910280f258d12d515124daf8e9ffeb3b` |
| `sw.js` | `af48b86df2a89323ac8f1a21d8bcec86a2bcec5f8a5a18b168b849020a6d17bf` |
| `manifest.webmanifest` | `a472def00dc84b7ac7653e2e8b11444ef0aaccbce66e9ce81e0b0146aababf17` |

## Earlier finding disposition

| Earlier finding | Current disposition |
| --- | --- |
| Verification 1: cold shell omitted JS/CSS | Fixed; clean claim and independent live offline reload pass. |
| Verification 1: worker updates were not announced/versioned | Fixed; local two-version regression passes. |
| Verification 1: zero-dollar invoice accepted | Fixed; live form and tests reject zero. |
| Verification 1: weak caching and missing security headers | Fixed and verified live. |
| Verification 2: verification API lacked 429/Retry-After | Fixed; request 31 returned 429 with `Retry-After: 3`. |
| Verification 3: impossible date bricked every reload | Fixed; invalid imports skip safely and stored damage has recovery controls. |
| Verification 3: three mobile targets below 44px | Fixed; all measured targets meet 44×44. |
| Verification 3: purchase endpoint returned 404 | **Open; finding P1.** |

## Evidence

- `/work/.evidence/verification4-live-probe.json`
- `/work/.evidence/verification4-desktop-first-screen.png`
- `/work/.evidence/verification4-phone-first-screen.png`
- `/work/.evidence/verification4-lighthouse.json`
- `/work/.evidence/verify4-root/verify.json`
- `/work/.evidence/verify4-demo/verify.json`
- `/work/.evidence/verify4-root/screenshot-desktop.png`
- `/work/.evidence/verify4-root/screenshot-mobile.png`
- `/work/.evidence/verify4-demo/screenshot-desktop.png`
- `/work/.evidence/verify4-demo/screenshot-mobile.png`

The prior handoff referenced `/work/.evidence/billing-offer.json`; that file was not present in this fresh verifier container. This does not change the observed checkout failure or authorize changes outside this product repository.

## Final decision

**FAIL — 2 findings, 0 untested claims.** Do not declare the product accepted until the Sociobot offer is enabled and the populated-workspace landmark issue is corrected and independently rechecked.
