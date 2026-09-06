# Write and track invoice follow-ups

Gentle Chase is for freelancers and family businesses with overdue invoices. It shows what needs attention and drafts neutral email or WhatsApp wording. You review, copy, and send each message yourself.

Live product: [relationship-safe-payment-followup.sociobot.in](https://relationship-safe-payment-followup.sociobot.in)

One-click sample: [relationship-safe-payment-followup.sociobot.in/demo](https://relationship-safe-payment-followup.sociobot.in/demo). Demo records use a separate IndexedDB database and never change real records.

## What v1 does

- Tracks invoice amount, currency, due date, contact preference, cadence, and relationship notes.
- Produces editable email or WhatsApp drafts and records manually completed follow-ups.
- Advances each next-follow-up cue from the latest logged contact; invoices can be marked paid and reopened.
- Stores all client and invoice data in browser IndexedDB and works after an offline reload.
- Exports complete JSON backups or spreadsheet-friendly CSV, imports JSON with last-write-wins conflict handling, and supports deliberate deletion.
- Installs as a PWA. The free tier supports five active invoices. A verified $19 one-time Gentle Chase Plus license removes that limit.

The product does not send messages, process payments, provide legal advice, issue legal notices, automate collection, or sync customer data.

## Develop and verify

Requires Node.js 20 or newer.

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

The reproducible deployment command is `npm run build`. Its static output is `dist/`, with `dist/index.html` at the root. The Playwright suite pins version 1.58.2 and expects its Chromium browser to be installed.

`npm test` runs schedule, message, date-validation, and deployment-policy tests. `npm run test:e2e` builds and serves the production PWA. It covers desktop and 390px mobile flows, damaged-data recovery, demo isolation, IndexedDB persistence, accessibility, legal routes, license restoration, and offline reloads.

Public claims and their individual browser commands are listed in [.factory/claims.json](.factory/claims.json). The demo setup and storage boundary are documented in [.factory/demo.md](.factory/demo.md).

## Billing configuration

The app uses only the Sociobot billing API. Localhost uses `https://pilot-api.sociobot.in`; the deployed Sociobot domain uses `https://api.sociobot.in`. Override this at build time when needed:

```sh
VITE_BILLING_API_BASE=https://pilot-api.sociobot.in npm run build
```

No numeric product ID or provider secret is stored here. The API path uses the public product slug, `relationship-safe-payment-followup`. Checkout and refunds are hosted by Sociobot/Dodo. Production checkout also requires the factory billing operator to enable the public offer.

## Privacy and architecture

The app is Vite + TypeScript with no runtime framework, CDN, analytics, third-party script, or hosted font. IndexedDB contains invoice data; `localStorage` contains only license and cached verification state. The service worker caches static application files, not client records. See [/privacy](https://relationship-safe-payment-followup.sociobot.in/privacy) and [/terms](https://relationship-safe-payment-followup.sociobot.in/terms).

The design system and generated-asset provenance are in [.factory/design.md](.factory/design.md). Factory verification notes are in [.factory/handoff.md](.factory/handoff.md).

## License

MIT — see [LICENSE](LICENSE).
