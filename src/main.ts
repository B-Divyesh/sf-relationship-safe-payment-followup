import './styles.css';
import type { ContactPreference, Invoice, LicenseState } from './types';
import { clearInvoices, deleteInvoice, getInvoices, importBundle, putInvoice } from './store';
import {
  BUY_URL, captureLicenseFromUrl, forgetLicense, initialLicenseState, saveLicense, verifyLicense,
} from './license';
import {
  daysBetween, draftFor, escapeHtml, formatDate, formatMoney, localDate, needsAttention, nextFollowUp,
} from './utils';

type Filter = 'open' | 'attention' | 'paid';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const app = document.querySelector<HTMLDivElement>('#app')!;
if (!app) throw new Error('App root is missing.');

let invoices: Invoice[] = [];
let selectedId = '';
let filter: Filter = 'open';
let storageError = '';
let liveMessage = '';
let license: LicenseState = initialLicenseState();
let undoSnapshot: Invoice | null = null;
let undoTimer = 0;
let installPrompt: InstallPromptEvent | null = null;

const today = () => localDate();
const selected = () => invoices.find((invoice) => invoice.id === selectedId);

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
      ${installPrompt ? '<button class="text-button" data-action="install">Install app</button>' : ''}
      <button class="icon-button" data-action="settings" aria-label="Data, license, and settings">${icon('settings')}</button>
    </nav>
  </header>`;
}

function statusBanner(): string {
  return `<div class="status-stack" aria-live="polite">
    <div class="offline-banner" data-offline ${navigator.onLine ? 'hidden' : ''}><span class="status-dot"></span> Offline — changes stay on this device.</div>
    ${license.notice ? `<div class="license-notice">${escapeHtml(license.notice)} ${!license.unlocked ? `<button class="inline-button" data-action="settings">View license</button>` : ''}</div>` : ''}
  </div>`;
}

function emptyView(): string {
  return `${header()}${statusBanner()}
  <main id="main">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow"><span>01</span> A private follow-up map</p>
        <h1>Keep the invoice moving.<br><em>Keep the relationship.</em></h1>
        <p class="hero-lede">Plan thoughtful reminders, shape the words yourself, and remember every follow-up. Gentle Chase never contacts a client for you.</p>
        <div class="hero-actions">
          <button class="primary-button" data-action="add">${icon('plus')} Add your first invoice</button>
          <span class="privacy-note">Stored only in this browser</span>
        </div>
        <dl class="promise-list">
          <div><dt>01</dt><dd>Add what’s overdue</dd></div>
          <div><dt>02</dt><dd>Review a gentle draft</dd></div>
          <div><dt>03</dt><dd>Copy, send yourself, then log it</dd></div>
        </dl>
      </div>
      <figure class="hero-art">
        <picture>
          <source media="(max-width: 760px)" srcset="/assets/hero-topography-768.webp" type="image/webp">
          <source srcset="/assets/hero-topography.webp" type="image/webp">
          <img src="/assets/hero-topography.jpg" width="1200" height="800" alt="Topographic paper map with three coral route pins and a dark green pencil" fetchpriority="high" decoding="async">
        </picture>
        <figcaption>Every reminder is a checkpoint, never an automatic send.</figcaption>
      </figure>
    </section>
    <section class="principle-strip" aria-label="Product principles">
      <p><strong>Local by design.</strong> Client names, amounts, notes, and drafts stay on your device.</p>
      <p><strong>You choose the moment.</strong> We cue and draft. You review and send.</p>
      <p><strong>Neutral language.</strong> No threats, scoring, or legal claims.</p>
    </section>
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
    <div class="sheet-topline"><span>ROUTE ${escapeHtml(invoice.invoiceNumber)}</span><span>${invoice.status === 'paid' ? 'CLOSED' : 'ACTIVE'}</span></div>
    <div class="detail-heading">
      <div><p class="eyebrow">Client checkpoint</p><h2 id="detail-title" tabindex="-1">${escapeHtml(invoice.clientName)}</h2></div>
      <button class="icon-button" data-action="edit" aria-label="Edit ${escapeHtml(invoice.clientName)} invoice">${icon('settings')}</button>
    </div>
    <dl class="invoice-facts">
      <div><dt>Balance</dt><dd>${escapeHtml(formatMoney(invoice.amount, invoice.currency))}</dd></div>
      <div><dt>Due</dt><dd>${formatDate(invoice.dueDate)}${overdue > 0 ? ` <small>${overdue} days ago</small>` : ''}</dd></div>
      <div><dt>Next cue</dt><dd>${invoice.status === 'paid' ? 'Route complete' : formatDate(next)}</dd></div>
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
  return `<section class="paid-panel"><span class="paid-marker">${icon('check')}</span><div><h3>Route complete</h3><p>${escapeHtml(invoice.clientName)} is marked paid. The history remains on this device for your records.</p></div></section>`;
}

function historyView(invoice: Invoice): string {
  if (!invoice.history.length) return `<section class="history"><h3>Trail notes</h3><p class="muted">No follow-ups logged yet.</p></section>`;
  return `<section class="history"><h3>Trail notes <span>${invoice.history.length}</span></h3><ol>${[...invoice.history].reverse().map((item) => `
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
    <main id="main" class="workspace">
      <section class="workspace-header">
        <div><p class="eyebrow"><span>FIELD SHEET</span> ${formatDate(today())}</p><h1>Your follow-up routes</h1><p>${dueCount ? `${dueCount} ${dueCount === 1 ? 'invoice needs' : 'invoices need'} a decision today.` : 'No follow-ups are due today.'} You stay in control of every message.</p></div>
        <button class="primary-button" data-action="add">${icon('plus')} Add invoice</button>
      </section>
      <div class="workspace-grid">
        <section class="queue" aria-labelledby="queue-title">
          <div class="queue-header"><div><p class="eyebrow">Route ledger</p><h2 id="queue-title">Invoice queue <span>${openCount}</span></h2></div>
            <button class="icon-button" data-action="export" aria-label="Export all data">${icon('download')}</button>
          </div>
          <div class="filter-tabs" role="group" aria-label="Filter invoices">
            <button data-action="filter" data-filter="open" aria-pressed="${filter === 'open'}">Open</button>
            <button data-action="filter" data-filter="attention" aria-pressed="${filter === 'attention'}">Needs attention <span>${dueCount}</span></button>
            <button data-action="filter" data-filter="paid" aria-pressed="${filter === 'paid'}">Paid</button>
          </div>
          ${visible.length ? `<ul class="invoice-list">${visible.map(invoiceRow).join('')}</ul>` : `<div class="filter-empty"><span class="mini-contour" aria-hidden="true">⌁</span><h3>No invoices on this route</h3><p>${filter === 'attention' ? 'You’re caught up. New cues will appear here when they are due.' : filter === 'paid' ? 'Invoices you mark paid will rest here.' : 'Add an invoice to begin a follow-up route.'}</p></div>`}
          ${!license.unlocked ? `<aside class="limit-note"><p><strong>${Math.min(openCount, 5)} of 5</strong> free active routes used.</p><button class="inline-button" data-action="settings">See one-time unlock</button></aside>` : ''}
        </section>
        <div class="detail-column">${chosen ? detailView(chosen) : '<div class="no-selection"><p>Select an invoice to review its route.</p></div>'}</div>
      </div>
    </main>${footer()}${dialogs()}`;
}

function invoiceDialog(): string {
  return `<dialog id="invoice-dialog" class="sheet-dialog" aria-labelledby="invoice-dialog-title">
    <form id="invoice-form">
      <input type="hidden" name="id">
      <div class="dialog-heading"><div><p class="eyebrow">Private route details</p><h2 id="invoice-dialog-title">Add an invoice</h2></div><button class="icon-button close-button" type="button" data-action="close-dialog" aria-label="Close">×</button></div>
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
    <section class="license-section"><p class="eyebrow">One-time purchase</p><h3>Gentle Chase Plus · $19</h3><p>Unlock unlimited active invoices and support ongoing offline updates. The free version keeps up to five active routes, full history, and all export and safety features.</p>
      ${license.unlocked ? `<div class="unlocked-badge">${icon('check')} Plus is active on this device</div><button class="text-button" data-action="forget-license">Remove license from this device</button>` : `<a class="primary-button" href="${BUY_URL}">Buy once — $19</a><form id="license-form"><label for="license-token">Have a license? Paste it here</label><div class="license-input"><input id="license-token" name="token" required autocomplete="off" spellcheck="false"><button class="secondary-button" type="submit">Verify license</button></div></form>`}
      <p class="fine-print">Checkout and refunds are handled by Sociobot/Dodo, the merchant of record. A refunded license is revoked automatically. <a href="/terms" data-route>Terms</a> · <a href="/privacy" data-route>Privacy</a></p>
    </section>
    ${invoices.length ? `<section class="danger-zone"><h3>Delete local data</h3><p>Remove every invoice, note, draft, and follow-up history item from this browser.</p><button class="danger-button" data-action="clear">Delete all local data</button></section>` : ''}
  </dialog>`;
}

function dialogs(): string { return invoiceDialog() + settingsDialog(); }

function footer(): string {
  return `<footer><div><span class="footer-mark">${icon('mark')}</span><p><strong>Gentle Chase</strong><br>Thoughtful follow-up, kept human.</p></div><nav aria-label="Legal"><a href="/privacy" data-route>Privacy</a><a href="/terms" data-route>Terms</a><a href="https://github.com/B-Divyesh/sf-relationship-safe-payment-followup" rel="noopener">Source</a></nav><p class="generation-note">Hero artwork generated for Gentle Chase with the factory image model.</p></footer>`;
}

function legalView(kind: 'privacy' | 'terms'): string {
  const privacy = `<p class="eyebrow">Plain-language policy · 28 August 2026</p><h1>Privacy, kept close.</h1><p class="legal-lede">Gentle Chase is designed so your client and invoice data stays in your browser.</p>
    <h2>What stays on your device</h2><p>Client names, contact details, amounts, due dates, notes, drafts, and follow-up history are stored in IndexedDB on this device. We do not receive, sync, analyse, or sell that information.</p>
    <h2>What may leave your device</h2><p>If you buy or restore Gentle Chase Plus, checkout is hosted by Sociobot/Dodo. The license token is sent to Sociobot solely to verify access. Invoice and client data is never included. This static app includes no analytics, ads, trackers, or third-party fonts.</p>
    <h2>Your controls</h2><p>Use Data & license to export JSON or CSV, import a backup, remove a license, or delete all local data. Uninstalling the app does not always clear browser storage; use the in-app delete action when you want a deliberate reset.</p>
    <h2>Offline cache</h2><p>The service worker stores the app shell and generated hero artwork so the workspace can open offline. It does not cache your invoice records; those remain in IndexedDB.</p>`;
  const terms = `<p class="eyebrow">Product terms · 28 August 2026</p><h1>Terms of use.</h1><p class="legal-lede">Gentle Chase helps you remember and draft invoice follow-ups. It does not send messages, collect debts, process invoices, or provide legal advice.</p>
    <h2>You remain the sender</h2><p>You are responsible for reviewing every draft, checking facts and tone, choosing whether and when to contact someone, and complying with your agreements and local law. Do not use the product to threaten, harass, or misrepresent consequences.</p>
    <h2>One-time license</h2><p>Gentle Chase Plus is a $19 one-time purchase for the features described at checkout. Sociobot/Dodo is the merchant of record and handles payment and refunds. A refund revokes the associated license. License availability requires occasional verification, with the last valid result usable offline.</p>
    <h2>No warranty</h2><p>The software is provided “as is,” without warranties. You should keep your own exports. We are not liable for missed reminders, lost browser storage, payment disputes, or decisions made from a draft.</p>
    <h2>Fair use</h2><p>You may use Gentle Chase for lawful business follow-up. You may not bypass license controls or use the product for automated contact, debtor scoring, harassment, or legal notices.</p>`;
  return `${header()}${statusBanner()}<main id="main" class="legal"><a href="/" class="back-link" data-route>← Back to workspace</a><article>${kind === 'privacy' ? privacy : terms}</article></main>${footer()}${settingsDialog()}`;
}

function render(): void {
  const path = location.pathname;
  if (path === '/privacy' || path === '/terms') {
    document.title = `${path === '/privacy' ? 'Privacy' : 'Terms'} — Gentle Chase`;
    app.innerHTML = legalView(path.slice(1) as 'privacy' | 'terms');
  } else if (storageError) {
    document.title = 'Storage unavailable — Gentle Chase';
    app.innerHTML = `${header()}<main id="main" class="error-state"><p class="eyebrow">Storage check</p><h1>Your private workspace could not open.</h1><p>${escapeHtml(storageError)}</p><p>Close other Gentle Chase tabs, allow site storage, then try again. No data was sent anywhere.</p><button class="primary-button" data-action="retry">Try again</button></main>${footer()}${settingsDialog()}`;
  } else {
    document.title = 'Gentle Chase — thoughtful invoice follow-up';
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
  (document.querySelector('#invoice-dialog-title') as HTMLElement).textContent = invoice ? 'Edit invoice route' : 'Add an invoice';
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
  if (!invoice.clientName || !invoice.invoiceNumber || !invoice.dueDate || !Number.isFinite(invoice.amount) || invoice.amount <= 0) {
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
    announce(existing ? 'Invoice route updated.' : `Invoice route added for ${invoice.clientName}.`);
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
    invoices = await getInvoices();
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
    void putInvoice(updated).then(() => announce('Draft saved on this device.'));
  }
});

app.addEventListener('click', (event) => {
  const route = (event.target as Element).closest<HTMLAnchorElement>('a[data-route]');
  if (route) {
    event.preventDefault();
    history.pushState({}, '', route.pathname);
    closeDialogs();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    void clearInvoices().then(() => { invoices = []; selectedId = ''; closeDialogs(); render(); announce('All local invoice data deleted.'); });
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

window.addEventListener('popstate', render);
window.addEventListener('online', () => { document.querySelector<HTMLElement>('[data-offline]')?.setAttribute('hidden', ''); announce('Back online.'); });
window.addEventListener('offline', () => { document.querySelector<HTMLElement>('[data-offline]')?.removeAttribute('hidden'); announce('You are offline. Changes will stay on this device.'); });
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event as InstallPromptEvent; render(); });

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    if (registration.waiting) showToast('A fresh map is ready.', 'Reload', 'reload');
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'UPDATE_AVAILABLE') showToast('Gentle Chase was updated for your next visit.', 'Reload', 'reload');
    });
  } catch {
    announce('Offline setup was unavailable. The workspace still works while connected.');
  }
}

async function boot(): Promise<void> {
  storageError = '';
  try {
    captureLicenseFromUrl();
    license = initialLicenseState();
    invoices = await getInvoices();
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
