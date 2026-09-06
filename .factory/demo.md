# Gentle Chase demo

Open `http://127.0.0.1:5173/demo` in development or `https://relationship-safe-payment-followup.sociobot.in/demo` in production.

The page seeds three sample invoices:

- Northwind Studio has an overdue email follow-up ready to review.
- Harbor & Pine has a logged WhatsApp follow-up and a future follow-up date.
- Little Fern Bakery is paid and keeps its earlier follow-up history.

Demo data uses the separate IndexedDB database `gentle-chase-demo`. Real records use `gentle-chase`. The persistent demo banner identifies the sample and provides **Reset demo** and **Start for real**. Reset restores the three original samples. Leaving through **Start for real** clears demo records and opens the real database. The demo never reads or writes `gentle-chase`.
