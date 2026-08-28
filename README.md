# Gentle Chase

Gentle Chase is a private, offline-first follow-up planner for freelancers and family businesses with overdue invoices. It keeps the awkward part human: the app tells you what needs attention, drafts jurisdiction-neutral email or WhatsApp wording, and lets you copy it into your own messaging app. It never contacts or scores a client.

Live product: [relationship-safe-payment-followup.sociobot.in](https://relationship-safe-payment-followup.sociobot.in)

## What v1 does

- Tracks invoice amount, currency, due date, contact preference, cadence, and relationship notes.
- Produces editable email or WhatsApp drafts and records manually completed follow-ups.
- Advances each next-follow-up cue from the latest logged contact; invoices can be marked paid and reopened.
- Stores all client and invoice data in browser IndexedDB and works after an offline reload.
- Exports complete JSON backups or spreadsheet-friendly CSV, imports JSON with last-write-wins conflict handling, and supports deliberate deletion.
- Installs as a PWA. The free tier supports five active invoices; a $19 one-time Gentle Chase Plus license unlocks unlimited active invoices.

The product does not send messages, process payments, provide legal advice, issue legal notices, automate collection, or sync customer data.

## Develop and verify

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
npm test
npm run build
npm run test:e2e
```

The reproducible deployment command is `npm run build`. Its static output is `dist/`, with `dist/index.html` at the root. The Playwright suite pins version 1.58.2 and expects its Chromium browser to be installed.

`npm test` runs schedule, message, and import unit tests. `npm run test:e2e` builds and serves the production PWA, then tests desktop and 390px mobile flows, IndexedDB persistence, serious/critical axe findings, legal routes, the billing verification contract, and a browser-level offline reload.

## Billing configuration

The app uses only the Sociobot billing API. Localhost uses `https://pilot-api.sociobot.in`; the deployed Sociobot domain uses `https://api.sociobot.in`. Override this at build time when needed:

```sh
VITE_BILLING_API_BASE=https://pilot-api.sociobot.in npm run build
```

No numeric product ID or provider secret is stored here. The API path uses the public product slug, `relationship-safe-payment-followup`. Checkout and refunds are hosted by Sociobot/Dodo.

## Privacy and architecture

The app is Vite + TypeScript with no runtime framework, CDN, analytics, third-party script, or hosted font. IndexedDB contains invoice data; `localStorage` contains only license and cached verification state. The service worker caches static application files, not client records. See [/privacy](https://relationship-safe-payment-followup.sociobot.in/privacy) and [/terms](https://relationship-safe-payment-followup.sociobot.in/terms).

The design system and generated-asset provenance are in [.factory/design.md](.factory/design.md). Factory verification notes are in [.factory/handoff.md](.factory/handoff.md).

## License

MIT — see [LICENSE](LICENSE).
