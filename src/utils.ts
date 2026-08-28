import type { ContactPreference, Invoice } from './types';

export const DAY = 86_400_000;

export function localDate(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function dateAtNoon(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function daysBetween(from: string, to = localDate()): number {
  return Math.floor((dateAtNoon(to).getTime() - dateAtNoon(from).getTime()) / DAY);
}

export function nextFollowUp(invoice: Invoice): string {
  if (!invoice.history.length) return invoice.dueDate;
  const last = invoice.history[invoice.history.length - 1];
  const date = new Date(last.at);
  date.setDate(date.getDate() + invoice.cadenceDays);
  return localDate(date);
}

export function needsAttention(invoice: Invoice, today = localDate()): boolean {
  return invoice.status === 'open' && nextFollowUp(invoice) <= today;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(dateAtNoon(value));
}

export function draftFor(invoice: Invoice, channel: ContactPreference): string {
  const stored = channel === 'email' ? invoice.draftEmail : invoice.draftWhatsApp;
  if (stored) return stored;
  const hello = invoice.contactName ? `Hi ${invoice.contactName}` : `Hi ${invoice.clientName} team`;
  const amount = formatMoney(invoice.amount, invoice.currency);
  const previous = invoice.history.length
    ? `I’m following up again on invoice ${invoice.invoiceNumber} for ${amount}, due ${formatDate(invoice.dueDate)}.`
    : `A quick note about invoice ${invoice.invoiceNumber} for ${amount}, which was due ${formatDate(invoice.dueDate)}.`;
  const body = `${hello},\n\nI hope you’re well. ${previous} When you have a moment, could you let me know when I can expect payment? If it’s already arranged, please disregard this note.\n\nThank you.`;
  return channel === 'whatsapp' ? body.replace(/\n\n/g, '\n') : body;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

export function normalizeInvoice(input: unknown): Invoice | null {
  if (!input || typeof input !== 'object') return null;
  const item = input as Partial<Invoice>;
  if (!item.id || !item.clientName || !item.invoiceNumber || !item.dueDate) return null;
  const now = new Date().toISOString();
  return {
    id: String(item.id),
    clientName: String(item.clientName).slice(0, 120),
    contactName: String(item.contactName ?? '').slice(0, 120),
    invoiceNumber: String(item.invoiceNumber).slice(0, 80),
    amount: Number.isFinite(Number(item.amount)) ? Math.max(0, Number(item.amount)) : 0,
    currency: /^[A-Z]{3}$/.test(String(item.currency)) ? String(item.currency) : 'USD',
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item.dueDate)) ? String(item.dueDate) : localDate(),
    preference: item.preference === 'whatsapp' ? 'whatsapp' : 'email',
    email: String(item.email ?? '').slice(0, 254),
    whatsapp: String(item.whatsapp ?? '').slice(0, 40),
    cadenceDays: Math.min(60, Math.max(1, Number(item.cadenceDays) || 7)),
    notes: String(item.notes ?? '').slice(0, 3000),
    status: item.status === 'paid' ? 'paid' : 'open',
    draftEmail: item.draftEmail ? String(item.draftEmail).slice(0, 5000) : undefined,
    draftWhatsApp: item.draftWhatsApp ? String(item.draftWhatsApp).slice(0, 5000) : undefined,
    history: Array.isArray(item.history) ? item.history.filter(Boolean).slice(-100).map((entry) => ({
      id: String(entry.id ?? crypto.randomUUID()),
      at: String(entry.at ?? now),
      channel: entry.channel === 'whatsapp' ? 'whatsapp' : 'email',
      message: String(entry.message ?? '').slice(0, 5000),
    })) : [],
    createdAt: String(item.createdAt ?? now),
    updatedAt: String(item.updatedAt ?? now),
  };
}
