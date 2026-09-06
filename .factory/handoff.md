# Gentle Chase verification-4 handoff

Independent verification completed on 2026-09-06 for `relationship-safe-payment-followup-verify-4`.

- Verdict: **FAIL**
- Findings: **2**
- Untested claims: **0**
- Implementation reviewed: `cf7504011166c0b283236794132d23c6f8a831e9`
- Documentation baseline: `bf94e11bdab4fe38e2bafe89a1fa46a0478957e1`
- Full report: `.factory/verification-4.md`

All seven declared claim commands pass from a fresh clone. The full suite passes with 8/8 unit tests and 30 Playwright checks (2 intentional project skips). Live desktop and phone flows, demo isolation/reset, invalid-date recovery, keyboard/focus, reduced motion, 44px targets, legal/404 routes, privacy request capture, cold offline reload, caching, headers, and artifact hashes pass. Live Lighthouse scored 100/100/100/100.

Release remains blocked by two findings:

1. **P1:** the advertised **Buy once — $19** checkout still returns HTTP 404 from Sociobot, so a real purchase and paid return/restore cannot complete.
2. **P3:** axe-core reports `landmark-complementary-is-top-level` on the populated workspace because `aside.limit-note` is nested inside the invoice queue landmark.

The earlier cold-offline, worker-update, zero-amount, cache/header, rate-limit, impossible-date, and mobile-target findings are fixed and independently rechecked. The verification endpoint returned 429 on request 31 with `Retry-After: 3`.

Evidence is under `/work/.evidence/`, including `verification4-live-probe.json`, first-screen captures, URL verifier output, and `verification4-lighthouse.json`. The prior handoff's `/work/.evidence/billing-offer.json` was not present in this fresh verifier container.

## Prior repair-3 handoff

Repair work completed on 2026-09-06 for `relationship-safe-payment-followup-repair-3`.

- Live URL: `https://relationship-safe-payment-followup.sociobot.in`
- Implementation SHA: `cf7504011166c0b283236794132d23c6f8a831e9`
- Base verification report SHA: `bc63b5041f9644c1b0a9d9b3a7f19c4ebd120420`
- Deployment: `/opt/fleet/lib/deploy-static.sh relationship-safe-payment-followup dist`
- Live artifact state: deployed and byte-identical to the implementation build

## What changed

### Impossible-date recovery

- Calendar dates now parse and round-trip before an invoice can enter storage.
- Imported creation, update, and follow-up timestamps receive strict date and time checks.
- An invalid invoice or invalid history timestamp is skipped before any import write.
- Existing damaged IndexedDB records no longer stop the app from opening.
- A visible warning opens a recovery panel where damaged records can be removed without deleting valid invoices.
- Date display also has a defensive fallback instead of throwing `Invalid time value`.

Browser regressions cover an impossible imported date alongside a valid invoice, reload persistence, direct seeding of an already-damaged IndexedDB record, and removal while valid data remains usable.

### Mobile targets

The one-time-purchase control and the settings Terms and Privacy links now have explicit hit areas. Fresh live 390×844 measurements were:

- **See one-time purchase:** 157.86×50.66 CSS px
- **Terms:** 44×44 CSS px
- **Privacy:** 44×44 CSS px
- **Buy once — $19:** 187.78×50.34 CSS px

### Demo, claims, and site contract

- `/demo` now seeds three realistic invoices in `gentle-chase-demo`, separate from the real `gentle-chase` IndexedDB database.
- The persistent demo banner provides **Reset demo** and **Start for real**. Browser tests prove demo actions do not alter a pre-existing real invoice.
- The first phone and desktop screens state the job, audience, and sample action before scrolling.
- Interface headings and instructions use invoice and follow-up terms instead of map metaphors.
- `.factory/claims.json`, `.factory/demo.md`, `.factory/copy-audit.md`, and the verb-first catalog description are present.
- Route titles, canonical and social metadata, a 1200×630 original-art derivative, a 180px touch icon, explicit deep-link rewrites, and a designed HTTP 404 are present.
- Unknown live paths return HTTP 404; `/`, `/demo`, `/privacy`, and `/terms` return 200.

## Verification

From the documented clean setup:

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

Results:

- `npm ci`: passed; 60 packages installed; 0 audit vulnerabilities.
- `npm test`: 8/8 passed.
- `npm run build`: passed and produced `dist/index.html`.
- `npm run test:e2e`: 30 passed across desktop Chromium and 390×844 mobile; 2 intentional project-specific skips.
- Every command in `.factory/claims.json` was also run separately and passed.
- Initial JS: 40,541 B raw / 13.90 KB gzip.
- CSS: 20,909 B raw / 5.43 KB gzip.
- Mobile hero: 37,182 B. No web fonts ship.
- Live Lighthouse mobile: Performance 100, Accessibility 100, Best Practices 100, SEO 100; FCP 1.0 s, LCP 1.3 s, TBT 0 ms, CLS 0.
- Live axe checks on the populated demo, Privacy, and Terms returned 0 serious or critical findings.
- `verify-url.sh` passed on live `/` and `/demo`: title, `lang`, one `h1`, main landmark, image alts, button names, and console/page errors all passed.
- Fresh live desktop and phone contexts made no off-origin request during the landing and demo flows and logged no console/page error.
- A fresh live service-worker-controlled demo reloaded offline after clearing the HTTP cache and retained sample data.
- Reduced-motion transitions computed to `0.00001s`.
- Live hashed JS and CSS and `sw.js` match local `dist/` by SHA-256. Hashed assets return one-year immutable caching; documents revalidate.
- Live security headers include HSTS, self-only CSP, Permissions-Policy, COOP, CORP, strict referrer policy, and `nosniff`.

Evidence is under `/work/.evidence/`, including phone/desktop screenshots, Lighthouse JSON, URL-verifier output, the catalog description, and billing offer metadata.

## Earlier findings

- Verification 1 cold-shell caching and update notification: fixed and still covered by first-visit offline and two-worker-version tests.
- Verification 1 zero amount: fixed; UI and import reject it.
- Verification 1 caching and response policies: fixed and confirmed live.
- Verification 2 rate limiting: fixed. On 2026-09-06, requests 1–30 returned 200 and request 31 returned 429 with `Retry-After: 4`; the next nine also returned 429.
- Verification 3 impossible date: fixed locally and live with reload/recovery tests.
- Verification 3 mobile targets: fixed and measured live.

## Remaining external dependency

The production checkout endpoint still returns HTTP 404 with `{"error":"enabled factory product","status":404}`. This repository already uses the required URL and preserves the $19 one-time paid deliverable. It cannot register or enable the product in the shared Sociobot billing catalog.

Exact public registration metadata is written to `/work/.evidence/billing-offer.json` for the separate billing-registration operator. No provider credential, direct provider integration, fake checkout, or mock entitlement was added. After registration, verify that checkout redirects to the hosted page and that a purchased license returns, verifies, and restores in a fresh browser. Until then, paid checkout remains a release blocker; the free five-invoice product is fully usable.

## Known product limits

- Data intentionally does not sync between devices. Users can export JSON before moving or clearing browser storage.
- The app intentionally does not send messages, automate collections, score clients, or provide legal advice.
- Safari and Firefox were not available in this worker. Chromium 1.58.2 covered desktop and mobile profiles.
- This is a static local-first PWA. Backend tenancy, server restart persistence, and product-owned health checks do not apply.
