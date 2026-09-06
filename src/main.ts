import './styles.css';
import type { ContactPreference, Invoice, LicenseState } from './types';
import { clearInvoices, deleteInvoice, importBundle, loadInvoices, putInvoice, removeInvalidInvoices, setDemoStorage } from './store';
import {
  BUY_URL, captureLicenseFromUrl, forgetLicense, initialLicenseState, saveLicense, verifyLicense,
} from './license';
import {
  daysBetween, draftFor, escapeHtml, formatDate, formatMoney, isCalendarDate, localDate, needsAttention, nextFollowUp,
} from './utils';

type Filter = 'open' | 'attention' | 'paid';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const app = document.querySelector<HTMLDivElement>('#app')!;
if (!app) throw new Error('App root is missing.');

const demoMode = location.pathname === '/demo';
setDemoStorage(demoMode);

let invoices: Invoice[] = [];
let selectedId = '';
let filter: Filter = 'open';
let storageError = '';
let skippedStoredRecords = 0;
let liveMessage = '';
let license: LicenseState = initialLicenseState();
let undoSnapshot: Invoice | null = null;
let undoTimer = 0;
let installPrompt: InstallPromptEvent | null = null;

const today = () => localDate();
const selected = () => invoices.find((invoice) => invoice.id === selectedId);

function relativeDate(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function sampleInvoices(): Invoice[] {
  const now = new Date().toISOString();
  const previousFollowUp = new Date(Date.now() - 4 * 86_400_000).toISOString();
  return [
    {
      id: 'demo-northwind', clientName: 'Northwind Studio', contactName: 'Maya', invoiceNumber: 'NW-104',
      amount: 1250, currency: 'USD', dueDate: relativeDate(-12), preference: 'email', email: 'maya@example.com',
      whatsapp: '', cadenceDays: 7, notes: 'Maya usually confirms payments after the Friday accounts run.', status: 'open',
      history: [], createdAt: now, updatedAt: now,
    },
    {
      id: 'demo-harbor', clientName: 'Harbor & Pine', contactName: 'Ravi', invoiceNumber: 'HP-228',
      amount: 680, currency: 'USD', dueDate: relativeDate(-9), preference: 'whatsapp', email: '', whatsapp: '+1 415 555 0138',
      cadenceDays: 7, notes: 'Keep the message brief. Ravi asked for WhatsApp follow-ups.', status: 'open',
      history: [{ id: 'demo-follow-up', at: previousFollowUp, channel: 'whatsapp', message: 'Hi Ravi, a quick note about invoice HP-228.' }],
      createdAt: now, updatedAt: previousFollowUp,
    },
    {
      id: 'demo-little-fern', clientName: 'Little Fern Bakery', contactName: 'Elena', invoiceNumber: 'LFB-77',
      amount: 340, currency: 'USD', dueDate: relativeDate(-18), preference: 'email', email: 'elena@example.com',
      whatsapp: '', cadenceDays: 5, notes: 'Paid after one reminder.', status: 'paid',
      history: [{ id: 'demo-paid-follow-up', at: new Date(Date.now() - 11 * 86_400_000).toISOString(), channel: 'email', message: 'Hi Elena, a quick note about invoice LFB-77.' }],
      createdAt: now, updatedAt: now,
    },
  ];
}

async function resetDemoData(): Promise<void> {
  await clearInvoices();
  await Promise.all(sampleInvoices().map((invoice) => putInvoice(invoice)));
  const loaded = await loadInvoices();
  invoices = loaded.invoices;
  skippedStoredRecords = loaded.skipped;
  selectedId = invoices.find((invoice) => needsAttention(invoice))?.id ?? invoices[0]?.id ?? '';
}

function icon(name: 'mark' | 'plus' | 'settings' | 'download' | 'copy' | 'check' | 'trash'): string {
  const paths = {
    mark: '<path d="M12 21s6-6.2 6-12a6 6 0 1 0-12 0c0 5.8 6 12 6 12Z"/><circle cx="12" cy="9" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    download: '<path d="M12 3v12m0 0 5-5m-5 5-5-5M4 20h16"/>',
    copy: '<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/>',
  };
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}

function announce(message: string): void {
  liveMessage = message;
  const region = document.querySelector<HTMLElement>('#live-region');
  if (region) region.textContent = message;
}

function header(): string {
  return `<header class="site-header">
    <a class="brand" href="/" data-route><span class="brand-mark">${icon('mark')}</span><span>Gentle Chase</span></a>
    <nav aria-label="Utility navigation">
      <a href="/demo" data-route>Demo</a>
      <a href="/privacy" data-route>Privacy</a>
      ${installPrompt ? '<button class="text-button" data-action="install">Install app</button>' : ''}
      <button class="icon-button" data-action="settings" aria-label="Data, license, and settings">${icon('settings')}</button>
    </nav>
  </header>`;
}

function statusBanner(): string {
  return `<div class="status-stack" aria-live="polite">
    ${demoMode ? '<div class="demo-banner"><strong>Demo — sample data, nothing is saved to your records</strong><span><button data-action="reset-demo">Reset demo</button><button data-action="start-real">Start for real</button></span></div>' : ''}
    <div class="offline-banner" data-offline ${navigator.onLine ? 'hidden' : ''}><span class="status-dot"></span> Offline — changes stay on this device.</div>
    ${skippedStoredRecords ? `<div class="storage-warning">${skippedStoredRecords} damaged ${skippedStoredRecords === 1 ? 'record was' : 'records were'} left out so the app could open. <button class="inline-button" data-action="settings">Review data controls</button></div>` : ''}
    ${license.notice ? `<div class="license-notice">${escapeHtml(license.notice)} ${!license.unlocked ? `<button class="inline-button" data-action="settings">View license</button>` : ''}</div>` : ''}
  </div>`;
}

function emptyView(): string {
  return `${header()}${statusBanner()}
  <main id="main" tabindex="-1">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Private invoice follow-up</p>
        <h1>Write and track invoice follow&#8209;ups</h1>
        <p class="hero-lede">For freelancers and family businesses who want consistent reminders without automatic debt collection.</p>
        <div class="hero-actions">
          <a class="primary-button" href="/demo" data-route>Try it with sample data</a>
          <button class="secondary-button" data-action="add">${icon('plus')} Add a real invoice</button>
        </div>
        <p class="action-note">The demo loads three sample invoices. Your real records stay separate.</p>
        <dl class="promise-list">
          <div><dt>Private</dt><dd>Invoice data stays in this browser.</dd></div>
          <div><dt>Offline</dt><dd>Works offline after the first visit.</dd></div>
          <div><dt>Price</dt><dd>Free for five active invoices. Plus costs $19 once.</dd></div>
        </dl>
      </div>
      <figure class="hero-art">
        <picture>
          <source media="(max-width: 760px)" srcset="/assets/hero-topography-768.webp" type="image/webp">
          <source srcset="/assets/hero-topography.webp" type="image/webp">
          <img src="/assets/hero-topography.jpg" width="1200" height="800" alt="Topographic paper map with three coral route pins and a dark green pencil" fetchpriority="high" decoding="async">
        </picture>
        <figcaption>A paper invoice plan with three marked follow-up dates.</figcaption>
      </figure>
    </section>
    <section class="principle-strip" aria-label="Product principles">
      <p><strong>Data stays on this device.</strong> Client names, amounts, notes, and drafts remain local.</p>
      <p><strong>You send each message.</strong> The app drafts and records. It never contacts a client.</p>
      <p><strong>Drafts avoid legal threats.</strong> You check every fact and choose the final wording.</p>
    </section>
    <section class="info-section" aria-labelledby="how-title"><h2 id="how-title">How it works</h2><ol><li><strong>Add an overdue invoice.</strong><span>Enter the amount, due date, contact choice, and useful notes.</span></li><li><strong>Review the draft.</strong><span>Edit the email or WhatsApp wording before you copy it.</span></li><li><strong>Record the follow-up.</strong><span>Log what you sent so the next date is clear.</span></li></ol></section>
    <section class="info-section limits-section" aria-labelledby="limits-title"><h2 id="limits-title">What it does not do</h2><p>Gentle Chase does not send messages, score clients, process payments, or give legal advice.</p></section>
    <section class="info-section price-section" aria-labelledby="price-title"><div><h2 id="price-title">Price</h2><p>The free version supports five active invoices. Gentle Chase Plus supports unlimited active invoices for a $19 one-time purchase.</p></div><button class="secondary-button" data-action="settings">See the one-time purchase</button></section>
  </main>${footer()}${dialogs()}`;
}

function routeLabel(invoice: Invoice): { text: string; className: string } {
  if (invoice.status === 'paid') return { text: 'Paid', className: 'paid' };
  const overdue = daysBetween(invoice.dueDate);
  if (needsAttention(invoice)) return { text: overdue > 0 ? `${overdue}d overdue` : 'Due today', className: 'due' };
  return { text: `Next ${formatDate(nextFollowUp(invoice))}`, className: 'planned' };
}

function invoiceRow(invoice: Invoice): string {
  const status = routeLabel(invoice);
  return `<li>
    <button class="invoice-row ${invoice.id === selectedId ? 'is-selected' : ''}" data-action="select" data-id="${escapeHtml(invoice.id)}" aria-pressed="${invoice.id === selectedId}">
      <span class="route-pin" aria-hidden="true"></span>
      <span class="invoice-main"><strong>${escapeHtml(invoice.clientName)}</strong><small>${escapeHtml(invoice.invoiceNumber)} · ${formatDate(invoice.dueDate)}</small></span>
      <span class="invoice-amount">${escapeHtml(formatMoney(invoice.amount, invoice.currency))}</span>
      <span class="route-status ${status.className}">${escapeHtml(status.text)}</span>
    </button>
  </li>`;
}

function detailView(invoice: Invoice): string {
  const channel = invoice.preference;
  const draft = draftFor(invoice, channel);
  const overdue = daysBetween(invoice.dueDate);
  const next = nextFollowUp(invoice);
  return `<article class="detail-sheet" aria-labelledby="detail-title">
    <div class="sheet-topline"><span>INVOICE ${escapeHtml(invoice.invoiceNumber)}</span><span>${invoice.status === 'paid' ? 'PAID' : 'OPEN'}</span></div>
    <div class="detail-heading">
      <div><p class="eyebrow">Invoice details</p><h2 id="detail-title" tabindex="-1">${escapeHtml(invoice.clientName)}</h2></div>
      <button class="icon-button" data-action="edit" aria-label="Edit ${escapeHtml(invoice.clientName)} invoice">${icon('settings')}</button>
    </div>
    <dl class="invoice-facts">
      <div><dt>Balance</dt><dd>${escapeHtml(formatMoney(invoice.amount, invoice.currency))}</dd></div>
      <div><dt>Due</dt><dd>${formatDate(invoice.dueDate)}${overdue > 0 ? ` <small>${overdue} days ago</small>` : ''}</dd></div>
      <div><dt>Next follow-up</dt><dd>${invoice.status === 'paid' ? 'No follow-up needed' : formatDate(next)}</dd></div>
      <div><dt>Cadence</dt><dd>Every ${invoice.cadenceDays} days</dd></div>
    </dl>
    ${invoice.notes ? `<div class="client-note"><span>Context note</span><p>${escapeHtml(invoice.notes)}</p></div>` : ''}
    ${invoice.status === 'paid' ? paidPanel(invoice) : draftPanel(invoice, channel, draft)}
    ${historyView(invoice)}
    <div class="sheet-footer-actions">
      <button class="text-button" data-action="toggle-paid">${invoice.status === 'paid' ? 'Reopen invoice' : `${icon('check')} Mark paid`}</button>
      <button class="danger-button" data-action="delete">${icon('trash')} Delete</button>
    </div>
  </article>`;
}

function draftPanel(invoice: Invoice, channel: ContactPreference, draft: string): string {
  const destination = channel === 'email' ? invoice.email : invoice.whatsapp;
  return `<section class="draft-panel" aria-labelledby="draft-title">
    <div class="draft-heading"><div><p class="eyebrow">Suggested wording · ${channel === 'email' ? 'Email' : 'WhatsApp'}</p><h3 id="draft-title">Review before you copy</h3></div><span class="human-badge">Manual send only</span></div>
    ${destination ? `<p class="destination">For ${escapeHtml(destination)}</p>` : `<p class="field-warning">No ${channel === 'email' ? 'email address' : 'WhatsApp number'} saved. Add one in invoice settings.</p>`}
    <label class="sr-only" for="message-draft">Editable ${channel} draft</label>
    <textarea id="message-draft" data-action="draft" data-channel="${channel}" rows="9">${escapeHtml(draft)}</textarea>
    <p class="draft-help">Jurisdiction-neutral starting point. Check the amount, tone, and your agreement before using it.</p>
    <div class="draft-actions">
      <button class="primary-button" data-action="copy">${icon('copy')} Copy ${channel === 'email' ? 'email' : 'WhatsApp'} draft</button>
      <button class="secondary-button" data-action="log">${icon('check')} Log follow-up</button>
    </div>
    <p class="manual-note">Nothing is sent from Gentle Chase. Paste this into your own ${channel === 'email' ? 'mail app' : 'WhatsApp conversation'}.</p>
  </section>`;
}

function paidPanel(invoice: Invoice): string {
  return `<section class="paid-panel"><span class="paid-marker">${icon('check')}</span><div><h3>Invoice paid</h3><p>${escapeHtml(invoice.clientName)} is marked paid. The follow-up history remains on this device.</p></div></section>`;
}

function historyView(invoice: Invoice): string {
  if (!invoice.history.length) return `<section class="history"><h3>Follow-up history</h3><p class="muted">No follow-ups logged yet.</p></section>`;
  return `<section class="history"><h3>Follow-up history <span>${invoice.history.length}</span></h3><ol>${[...invoice.history].reverse().map((item) => `
    <li><span class="history-dot"></span><div><strong>${formatDate(item.at.slice(0, 10))}</strong><p>${item.channel === 'email' ? 'Email' : 'WhatsApp'} follow-up logged</p></div></li>`).join('')}</ol></section>`;
}

function workspace(): string {
  const visible = invoices
    .filter((invoice) => filter === 'attention' ? needsAttention(invoice) : invoice.status === filter)
    .sort((a, b) => nextFollowUp(a).localeCompare(nextFollowUp(b)));
  const dueCount = invoices.filter((invoice) => needsAttention(invoice)).length;
  const openCount = invoices.filter((invoice) => invoice.status === 'open').length;
  const chosen = selected() ?? visible[0];
  if (chosen && chosen.id !== selectedId) selectedId = chosen.id;

  return `${header()}${statusBanner()}
    <main id="main" class="workspace" tabindex="-1">
      <section class="workspace-header">
        <div><p class="eyebrow">Today · ${formatDate(today())}</p><h1>Review invoice follow&#8209;ups</h1><p>${dueCount ? `${dueCount} ${dueCount === 1 ? 'invoice needs' : 'invoices need'} a decision today.` : 'No follow-ups are due today.'} You choose every message.</p></div>
        <button class="primary-button" data-action="add">${icon('plus')} Add invoice</button>
      </section>
      <div class="workspace-grid">
        <section class="queue" aria-labelledby="queue-title">
          <div class="queue-header"><div><p class="eyebrow">Saved on this device</p><h2 id="queue-title">Invoices <span>${openCount}</span></h2></div>
            <button class="icon-button" data-action="export" aria-label="Export all data">${icon('download')}</button>
          </div>
          <div class="filter-tabs" role="group" aria-label="Filter invoices">
            <button data-action="filter" data-filter="open" aria-pressed="${filter === 'open'}">Open</button>
            <button data-action="filter" data-filter="attention" aria-pressed="${filter === 'attention'}">Needs attention <span>${dueCount}</span></button>
            <button data-action="filter" data-filter="paid" aria-pressed="${filter === 'paid'}">Paid</button>
          </div>
          ${visible.length ? `<ul class="invoice-list">${visible.map(invoiceRow).join('')}</ul>` : `<div class="filter-empty"><span class="mini-contour" aria-hidden="true">⌁</span><h3>No invoices in this view</h3><p>${filter === 'attention' ? 'No follow-ups need attention today.' : filter === 'paid' ? 'Invoices you mark paid will appear here.' : 'Add an overdue invoice to start.'}</p></div>`}
          ${!license.unlocked ? `<aside class="limit-note"><p><strong>${Math.min(openCount, 5)} of 5</strong> free active invoices used.</p><button class="inline-button" data-action="settings">See one-time purchase</button></aside>` : ''}
        </section>
        <div class="detail-column">${chosen ? detailView(chosen) : '<div class="no-selection"><p>Select an invoice to review its follow-up.</p></div>'}</div>
      </div>
    </main>${footer()}${dialogs()}`;
}

function invoiceDialog(): string {
  return `<dialog id="invoice-dialog" class="sheet-dialog" aria-labelledby="invoice-dialog-title">
    <form id="invoice-form">
      <input type="hidden" name="id">
      <div class="dialog-heading"><div><p class="eyebrow">Private invoice details</p><h2 id="invoice-dialog-title">Add an invoice</h2></div><button class="icon-button close-button" type="button" data-action="close-dialog" aria-label="Close">×</button></div>
      <p class="form-intro">Required fields are marked <span aria-hidden="true">*</span><span class="sr-only">with an asterisk</span>. Nothing here leaves your browser.</p>
      <div class="form-grid">
        <label>Client or business <span aria-hidden="true">*</span><input name="clientName" required maxlength="120" autocomplete="organization"></label>
        <label>Contact name <input name="contactName" maxlength="120" autocomplete="name"></label>
        <label>Invoice number <span aria-hidden="true">*</span><input name="invoiceNumber" required maxlength="80"></label>
        <div class="amount-fields"><label>Amount <span aria-hidden="true">*</span><input name="amount" required type="number" inputmode="decimal" min="0.01" step="0.01"></label><label>Currency <span aria-hidden="true">*</span><select name="currency"><option>USD</option><option>GBP</option><option>EUR</option><option>INR</option><option>AUD</option><option>CAD</option><option>NZD</option><option>SGD</option></select></label></div>
        <label>Due date <span aria-hidden="true">*</span><input name="dueDate" required type="date"></label>
        <label>Follow up every <span aria-hidden="true">*</span><span class="input-suffix"><input name="cadenceDays" required type="number" inputmode="numeric" min="1" max="60" value="7"><span>days</span></span></label>
      </div>
      <fieldset><legend>Preferred contact</legend><div class="choice-row"><label><input type="radio" name="preference" value="email" checked> Email</label><label><input type="radio" name="preference" value="whatsapp"> WhatsApp</label></div></fieldset>
      <div class="form-grid"><label>Email address <input name="email" type="email" maxlength="254" autocomplete="email"></label><label>WhatsApp number <input name="whatsapp" type="tel" maxlength="40" autocomplete="tel"></label></div>
      <label>Relationship notes <textarea name="notes" rows="3" maxlength="3000" placeholder="For example: usually pays after their Friday accounts run"></textarea><small>Keep only what helps you write a considerate follow-up.</small></label>
      <div class="form-error" id="invoice-error" role="alert"></div>
      <div class="dialog-actions"><button class="text-button" type="button" data-action="close-dialog">Cancel</button><button class="primary-button" type="submit">Save invoice</button></div>
    </form>
  </dialog>`;
}

function settingsDialog(): string {
  return `<dialog id="settings-dialog" class="sheet-dialog settings-dialog" aria-labelledby="settings-title">
    <div class="dialog-heading"><div><p class="eyebrow">Control panel</p><h2 id="settings-title">Your data & license</h2></div><button class="icon-button close-button" type="button" data-action="close-dialog" aria-label="Close">×</button></div>
    <section><h3>Your data stays yours</h3><p>Invoice details are stored in this browser’s IndexedDB. Export a backup before clearing browser data or moving devices.</p><div class="button-row"><button class="secondary-button" data-action="export">${icon('download')} Export JSON</button><button class="secondary-button" data-action="export-csv">Export CSV</button><label class="file-button">Import JSON<input id="import-file" type="file" accept="application/json,.json"></label></div><p class="import-status" id="import-status" role="status"></p></section>
    ${skippedStoredRecords ? `<section class="damaged-data"><h3>Damaged records</h3><p>${skippedStoredRecords} ${skippedStoredRecords === 1 ? 'record has' : 'records have'} an invalid date or required field. The app left ${skippedStoredRecords === 1 ? 'it' : 'them'} out.</p><button class="danger-button" data-action="remove-invalid">Remove damaged ${skippedStoredRecords === 1 ? 'record' : 'records'}</button></section>` : ''}
    <section class="license-section"><p class="eyebrow">One-time purchase</p><h3>Gentle Chase Plus · $19</h3><p>Use unlimited active invoices and support ongoing offline updates. The free version keeps up to five active invoices, full history, and all export and safety features.</p>
      ${license.unlocked ? `<div class="unlocked-badge">${icon('check')} Plus is active on this device</div><button class="text-button" data-action="forget-license">Remove license from this device</button>` : `<a class="primary-button" href="${BUY_URL}">Buy once — $19</a><form id="license-form"><label for="license-token">Have a license? Paste it here</label><div class="license-input"><input id="license-token" name="token" required autocomplete="off" spellcheck="false"><button class="secondary-button" type="submit">Verify license</button></div></form>`}
      <p class="fine-print">Checkout and refunds are handled by Sociobot/Dodo, the merchant of record. A refunded license is revoked automatically. <a href="/terms" data-route>Terms</a> · <a href="/privacy" data-route>Privacy</a></p>
    </section>
    ${invoices.length ? `<section class="danger-zone"><h3>Delete local data</h3><p>Remove every invoice, note, draft, and follow-up history item from this browser.</p><button class="danger-button" data-action="clear">Delete all local data</button></section>` : ''}
  </dialog>`;
}

function dialogs(): string { return invoiceDialog() + settingsDialog(); }

function footer(): string {
  return `<footer><div><span class="footer-mark">${icon('mark')}</span><p><strong>Gentle Chase</strong><br>Write and track manual invoice follow-ups.</p></div><nav aria-label="Legal"><a href="/privacy" data-route>Privacy</a><a href="/terms" data-route>Terms</a><a href="https://github.com/B-Divyesh/sf-relationship-safe-payment-followup" rel="noopener" aria-label="Source code on GitHub, external site">Source code ↗</a></nav><p class="generation-note">Built by Param Factory · Version 1.1.0 · Original hero artwork generated with the factory image model.</p></footer>`;
}

function legalView(kind: 'privacy' | 'terms'): string {
  const privacy = `<p class="eyebrow">Plain-language policy · 6 September 2026</p><h1>Privacy policy</h1><p class="legal-lede">Gentle Chase keeps your client and invoice data in your browser.</p>
    <h2>What stays on your device</h2><p>Client names, contact details, amounts, due dates, notes, drafts, and follow-up history are stored in IndexedDB on this device. We do not receive, sync, analyse, or sell that information.</p>
    <h2>What may leave your device</h2><p>If you buy or restore Gentle Chase Plus, checkout is hosted by Sociobot/Dodo. The license token is sent to Sociobot solely to verify access. Invoice and client data is never included. This static app includes no analytics, ads, trackers, or third-party fonts.</p>
    <h2>Your controls</h2><p>Use Data & license to export JSON or CSV, import a backup, remove a license, or delete all local data. Uninstalling the app does not always clear browser storage; use the in-app delete action when you want a deliberate reset.</p>
    <h2>Offline cache</h2><p>The service worker stores the app shell and generated hero artwork so the app can open offline. It does not cache your invoice records; those remain in IndexedDB.</p>`;
  const terms = `<p class="eyebrow">Product terms · 6 September 2026</p><h1>Terms of use</h1><p class="legal-lede">Gentle Chase helps you remember and draft invoice follow-ups. It does not send messages, collect debts, process invoices, or provide legal advice.</p>
    <h2>You remain the sender</h2><p>You review every draft, check its facts and tone, and choose when to contact someone. You must follow your agreements and local law. Do not use the product to threaten, harass, or misrepresent consequences.</p>
    <h2>One-time license</h2><p>Gentle Chase Plus is a $19 one-time purchase for the features described at checkout. Sociobot/Dodo is the merchant of record and handles payment and refunds. A refund revokes the associated license. License availability requires occasional verification, with the last valid result usable offline.</p>
    <h2>No warranty</h2><p>The software is provided “as is,” without warranties. You should keep your own exports. We are not liable for missed reminders, lost browser storage, payment disputes, or decisions made from a draft.</p>
    <h2>Fair use</h2><p>You may use Gentle Chase for lawful business follow-up. You may not bypass license controls or use the product for automated contact, debtor scoring, harassment, or legal notices.</p>`;
  return `${header()}${statusBanner()}<main id="main" class="legal" tabindex="-1"><a href="/" class="back-link" data-route>← Back to invoice list</a><article>${kind === 'privacy' ? privacy : terms}</article></main>${footer()}${settingsDialog()}`;
}

function notFoundView(): string {
  return `${header()}<main id="main" class="error-state" tabindex="-1"><p class="eyebrow">404 error</p><h1>Page not found</h1><p>This address does not match a Gentle Chase page.</p><a class="primary-button" href="/" data-route>Open the invoice follow-up app</a></main>${footer()}`;
}

function setCanonical(path: string): void {
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', `https://relationship-safe-payment-followup.sociobot.in${path}`);
}

function render(): void {
  const path = location.pathname;
  setCanonical(path);
  if (path === '/privacy' || path === '/terms') {
    document.title = `${path === '/privacy' ? 'Privacy' : 'Terms'} — Gentle Chase`;
    app.innerHTML = legalView(path.slice(1) as 'privacy' | 'terms');
  } else if (!['/', '/demo'].includes(path)) {
    document.title = 'Page not found — Gentle Chase';
    app.innerHTML = notFoundView();
  } else if (storageError) {
    document.title = 'Storage unavailable — Gentle Chase';
    app.innerHTML = `${header()}<main id="main" class="error-state" tabindex="-1"><p class="eyebrow">Storage check</p><h1>Your private invoice list could not open</h1><p>${escapeHtml(storageError)}</p><p>Close other Gentle Chase tabs, allow site storage, then try again. No data was sent anywhere.</p><button class="primary-button" data-action="retry">Try again</button></main>${footer()}${settingsDialog()}`;
  } else {
    document.title = demoMode ? 'Demo — Gentle Chase' : 'Gentle Chase — Track invoice follow-ups';
    app.innerHTML = invoices.length ? workspace() : emptyView();
  }
  app.insertAdjacentHTML('beforeend', `<div id="live-region" class="sr-only" aria-live="polite" aria-atomic="true">${escapeHtml(liveMessage)}</div><div id="toast-region" class="toast-region" aria-live="polite"></div>`);
}

function openInvoiceDialog(invoice?: Invoice): void {
  const activeCount = invoices.filter((item) => item.status === 'open').length;
  if (!invoice && activeCount >= 5 && !license.unlocked) {
    openDialog('settings-dialog');
    announce('The free version supports five active invoices. Gentle Chase Plus removes the limit.');
    return;
  }
  const dialog = document.querySelector<HTMLDialogElement>('#invoice-dialog');
  const form = document.querySelector<HTMLFormElement>('#invoice-form');
  if (!dialog || !form) return;
  (document.querySelector('#invoice-dialog-title') as HTMLElement).textContent = invoice ? 'Edit invoice' : 'Add an invoice';
  const fields = form.elements as typeof form.elements & Record<string, HTMLInputElement | HTMLTextAreaElement | RadioNodeList>;
  (fields.namedItem('id') as HTMLInputElement).value = invoice?.id ?? '';
  for (const name of ['clientName', 'contactName', 'invoiceNumber', 'amount', 'currency', 'dueDate', 'cadenceDays', 'email', 'whatsapp', 'notes']) {
    const field = fields.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
    const fallback = name === 'currency' ? 'USD' : name === 'cadenceDays' ? '7' : name === 'dueDate' ? today() : '';
    field.value = invoice ? String(invoice[name as keyof Invoice] ?? '') : fallback;
  }
  (fields.namedItem('preference') as RadioNodeList).value = invoice?.preference ?? 'email';
  dialog.showModal();
  (fields.namedItem('clientName') as HTMLInputElement).focus();
}

function openDialog(id: string): void {
  document.querySelector<HTMLDialogElement>(`#${id}`)?.showModal();
}

function closeDialogs(): void {
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((dialog) => dialog.close());
}

async function saveInvoiceForm(form: HTMLFormElement): Promise<void> {
  const data = new FormData(form);
  const id = String(data.get('id') || crypto.randomUUID());
  const existing = invoices.find((invoice) => invoice.id === id);
  const now = new Date().toISOString();
  const invoice: Invoice = {
    id,
    clientName: String(data.get('clientName') ?? '').trim(),
    contactName: String(data.get('contactName') ?? '').trim(),
    invoiceNumber: String(data.get('invoiceNumber') ?? '').trim(),
    amount: Number(data.get('amount')),
    currency: String(data.get('currency') ?? 'USD'),
    dueDate: String(data.get('dueDate') ?? today()),
    preference: data.get('preference') === 'whatsapp' ? 'whatsapp' : 'email',
    email: String(data.get('email') ?? '').trim(),
    whatsapp: String(data.get('whatsapp') ?? '').trim(),
    cadenceDays: Number(data.get('cadenceDays')),
    notes: String(data.get('notes') ?? '').trim(),
    status: existing?.status ?? 'open',
    draftEmail: existing?.draftEmail,
    draftWhatsApp: existing?.draftWhatsApp,
    history: existing?.history ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (!invoice.clientName || !invoice.invoiceNumber || !isCalendarDate(invoice.dueDate) || !Number.isFinite(invoice.amount) || invoice.amount <= 0) {
    const error = document.querySelector('#invoice-error');
    if (error) error.textContent = 'Add the client, invoice number, an amount greater than zero, and due date.';
    return;
  }
  try {
    await putInvoice(invoice);
    invoices = existing ? invoices.map((item) => item.id === id ? invoice : item) : [...invoices, invoice];
    selectedId = id;
    closeDialogs();
    render();
    announce(existing ? 'Invoice updated.' : `Invoice added for ${invoice.clientName}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save this invoice.';
    const region = document.querySelector('#invoice-error');
    if (region) region.textContent = `${message} Check browser storage and try again.`;
  }
}

function download(name: string, contents: string, type: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([contents], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportJson(): void {
  download(`gentle-chase-${today()}.json`, JSON.stringify({ product: 'Gentle Chase', version: 1, exportedAt: new Date().toISOString(), invoices }, null, 2), 'application/json');
  announce('JSON backup exported.');
}

function exportCsv(): void {
  const quote = (value: unknown) => {
    const raw = String(value ?? '');
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const rows = [['Client', 'Invoice', 'Amount', 'Currency', 'Due date', 'Status', 'Preference', 'Email', 'WhatsApp', 'Cadence days', 'Follow-ups', 'Notes'], ...invoices.map((invoice) => [invoice.clientName, invoice.invoiceNumber, invoice.amount, invoice.currency, invoice.dueDate, invoice.status, invoice.preference, invoice.email, invoice.whatsapp, invoice.cadenceDays, invoice.history.length, invoice.notes])];
  download(`gentle-chase-${today()}.csv`, rows.map((row) => row.map(quote).join(',')).join('\n'), 'text/csv;charset=utf-8');
  announce('CSV export downloaded.');
}

async function copyDraft(): Promise<void> {
  const field = document.querySelector<HTMLTextAreaElement>('#message-draft');
  if (!field) return;
  try {
    await navigator.clipboard.writeText(field.value);
  } catch {
    field.select();
    document.execCommand('copy');
  }
  const channel = field.dataset.channel === 'whatsapp' ? 'WhatsApp' : 'email';
  announce(`Copied — paste into your ${channel}. Nothing was sent.`);
}

async function logFollowUp(): Promise<void> {
  const invoice = selected();
  const field = document.querySelector<HTMLTextAreaElement>('#message-draft');
  if (!invoice || !field) return;
  undoSnapshot = structuredClone(invoice);
  const updated: Invoice = {
    ...invoice,
    history: [...invoice.history, { id: crypto.randomUUID(), at: new Date().toISOString(), channel: invoice.preference, message: field.value }],
    updatedAt: new Date().toISOString(),
  };
  await putInvoice(updated);
  invoices = invoices.map((item) => item.id === updated.id ? updated : item);
  render();
  showToast(`Follow-up logged. Next cue: ${formatDate(nextFollowUp(updated))}.`, 'Undo', 'undo');
  window.clearTimeout(undoTimer);
  undoTimer = window.setTimeout(() => { undoSnapshot = null; }, 8000);
}

function showToast(message: string, label?: string, action?: string): void {
  const region = document.querySelector('#toast-region');
  if (!region) return;
  region.innerHTML = `<div class="toast"><span>${escapeHtml(message)}</span>${label && action ? `<button data-action="${action}">${escapeHtml(label)}</button>` : ''}</div>`;
}

async function importFile(file: File): Promise<void> {
  const status = document.querySelector<HTMLElement>('#import-status');
  try {
    const result = await importBundle(JSON.parse(await file.text()));
    const loaded = await loadInvoices();
    invoices = loaded.invoices;
    skippedStoredRecords = loaded.skipped;
    selectedId = invoices.find((invoice) => invoice.status === 'open')?.id ?? invoices[0]?.id ?? '';
    closeDialogs();
    render();
    announce(`Import complete. ${result.imported} invoice records imported; ${result.skipped} skipped. Newer records were kept.`);
  } catch (error) {
    if (status) status.textContent = error instanceof Error ? error.message : 'That file could not be imported.';
  }
}

app.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const formId = form.getAttribute('id');
  if (formId === 'invoice-form') void saveInvoiceForm(form).catch((error: unknown) => {
    const region = document.querySelector('#invoice-error');
    if (region) region.textContent = error instanceof Error ? error.message : 'Could not save this invoice.';
  });
  if (formId === 'license-form') {
    const token = new FormData(form).get('token');
    if (token) {
      saveLicense(String(token));
      license = { token: String(token), unlocked: false, checking: true, notice: 'Checking this license…' };
      render();
      void verifyLicense(true).then((state) => { license = state; render(); openDialog('settings-dialog'); announce(state.notice); });
    }
  }
});

app.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement;
  if (target.id === 'import-file' && target instanceof HTMLInputElement && target.files?.[0]) void importFile(target.files[0]);
  if (target.dataset.action === 'draft') {
    const invoice = selected();
    if (!invoice) return;
    const channel = target.dataset.channel;
    const updated = { ...invoice, [channel === 'email' ? 'draftEmail' : 'draftWhatsApp']: target.value, updatedAt: new Date().toISOString() };
    invoices = invoices.map((item) => item.id === invoice.id ? updated : item);
    void putInvoice(updated).catch(() => showToast('The draft could not be saved. Check browser storage and try again.'));
  }
});

app.addEventListener('click', (event) => {
  const route = (event.target as Element).closest<HTMLAnchorElement>('a[data-route]');
  if (route) {
    event.preventDefault();
    const enteringDemo = route.pathname === '/demo';
    if (enteringDemo !== demoMode) {
      if (demoMode) {
        void clearInvoices().finally(() => location.assign(route.pathname));
      } else {
        location.assign(route.pathname);
      }
      return;
    }
    history.pushState({}, '', route.pathname);
    closeDialogs();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const heading = document.querySelector<HTMLElement>('h1');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus();
    announce(`${heading?.textContent ?? 'Page'} opened.`);
    return;
  }
  const button = (event.target as Element).closest<HTMLElement>('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'add') openInvoiceDialog();
  if (action === 'edit') { const invoice = selected(); if (invoice) openInvoiceDialog(invoice); }
  if (action === 'settings') openDialog('settings-dialog');
  if (action === 'close-dialog') closeDialogs();
  if (action === 'select') { selectedId = button.dataset.id ?? ''; render(); document.querySelector<HTMLElement>('#detail-title')?.focus(); }
  if (action === 'filter') { filter = button.dataset.filter as Filter; selectedId = ''; render(); }
  if (action === 'copy') void copyDraft();
  if (action === 'log') void logFollowUp();
  if (action === 'export') exportJson();
  if (action === 'export-csv') exportCsv();
  if (action === 'retry') void boot();
  if (action === 'reset-demo') {
    void resetDemoData().then(() => { render(); announce('Demo reset to the original three sample invoices.'); });
  }
  if (action === 'start-real') {
    void clearInvoices().finally(() => location.assign('/'));
  }
  if (action === 'remove-invalid' && confirm(`Remove ${skippedStoredRecords} damaged ${skippedStoredRecords === 1 ? 'record' : 'records'} from this browser? Valid invoices will remain.`)) {
    void removeInvalidInvoices().then((removed) => {
      skippedStoredRecords = Math.max(0, skippedStoredRecords - removed);
      closeDialogs();
      render();
      announce(`${removed} damaged ${removed === 1 ? 'record' : 'records'} removed. Valid invoices were kept.`);
    });
  }
  if (action === 'toggle-paid') {
    const invoice = selected();
    if (invoice) {
      const updated: Invoice = { ...invoice, status: invoice.status === 'paid' ? 'open' : 'paid', updatedAt: new Date().toISOString() };
      invoices = invoices.map((item) => item.id === updated.id ? updated : item);
      void putInvoice(updated); render(); announce(updated.status === 'paid' ? 'Invoice marked paid.' : 'Invoice reopened.');
    }
  }
  if (action === 'delete') {
    const invoice = selected();
    if (invoice && confirm(`Delete ${invoice.clientName} invoice ${invoice.invoiceNumber} and its follow-up history? This cannot be undone.`)) {
      void deleteInvoice(invoice.id).then(() => { invoices = invoices.filter((item) => item.id !== invoice.id); selectedId = ''; render(); announce('Invoice and its local history deleted.'); });
    }
  }
  if (action === 'clear' && confirm(`Delete all ${invoices.length} invoice records and their local history from this browser? This cannot be undone.`)) {
    void clearInvoices().then(() => { invoices = []; skippedStoredRecords = 0; selectedId = ''; closeDialogs(); render(); announce('All local invoice data deleted.'); });
  }
  if (action === 'undo' && undoSnapshot) {
    const restored = undoSnapshot; undoSnapshot = null; window.clearTimeout(undoTimer);
    invoices = invoices.map((item) => item.id === restored.id ? restored : item);
    void putInvoice(restored); render(); announce('Follow-up log undone.');
  }
  if (action === 'forget-license') { forgetLicense(); license = initialLicenseState(); render(); openDialog('settings-dialog'); }
  if (action === 'install' && installPrompt) { void installPrompt.prompt().then(() => { installPrompt = null; render(); }); }
  if (action === 'reload') location.reload();
});

window.addEventListener('popstate', () => {
  render();
  const heading = document.querySelector<HTMLElement>('h1');
  heading?.setAttribute('tabindex', '-1');
  heading?.focus();
  announce(`${heading?.textContent ?? 'Page'} opened.`);
});
window.addEventListener('online', () => { document.querySelector<HTMLElement>('[data-offline]')?.setAttribute('hidden', ''); announce('Back online.'); });
window.addEventListener('offline', () => { document.querySelector<HTMLElement>('[data-offline]')?.removeAttribute('hidden'); announce('You are offline. Changes will stay on this device.'); });
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event as InstallPromptEvent; render(); });

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    if (registration.waiting) showToast('An app update is ready.', 'Reload', 'reload');
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'UPDATE_AVAILABLE') showToast('Gentle Chase was updated for your next visit.', 'Reload', 'reload');
    });
  } catch {
    announce('Offline setup was unavailable. The app still works while connected.');
  }
}

async function boot(): Promise<void> {
  storageError = '';
  try {
    captureLicenseFromUrl();
    license = initialLicenseState();
    const loaded = await loadInvoices();
    invoices = loaded.invoices;
    skippedStoredRecords = loaded.skipped;
    if (demoMode && !invoices.length) await resetDemoData();
    selectedId = invoices.find((invoice) => needsAttention(invoice))?.id ?? invoices.find((invoice) => invoice.status === 'open')?.id ?? invoices[0]?.id ?? '';
  } catch (error) {
    storageError = error instanceof Error ? error.message : 'Browser storage is unavailable.';
  }
  render();
  if (license.token && license.checking) {
    license = await verifyLicense();
    render();
  }
  void registerServiceWorker();
}

void boot();
