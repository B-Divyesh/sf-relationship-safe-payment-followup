import type { ContactPreference, Invoice } from './types';

export const DAY = 86_400_000;

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!parts || !isCalendarDate(parts[1])) return false;
  const [, , hours, minutes, seconds, , zone, offsetHours = '0', offsetMinutes = '0'] = parts;
  if (Number(hours) > 23 || Number(minutes) > 59 || Number(seconds) > 59) return false;
  if (zone !== 'Z' && (Number(offsetHours) > 14 || Number(offsetMinutes) > 59)) return false;
  return Number.isFinite(Date.parse(value));
}

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
  const dateValue = value.includes('T') ? value.slice(0, 10) : value;
  if (!isCalendarDate(dateValue)) return 'Invalid date';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(dateAtNoon(dateValue));
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
  if (!String(item.id ?? '').trim() || !String(item.clientName ?? '').trim() || !String(item.invoiceNumber ?? '').trim()
    || !isCalendarDate(item.dueDate) || !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0) return null;
  const now = new Date().toISOString();
  const createdAt = item.createdAt === undefined ? now : isTimestamp(item.createdAt) ? item.createdAt : null;
  const updatedAt = item.updatedAt === undefined ? now : isTimestamp(item.updatedAt) ? item.updatedAt : null;
  if (!createdAt || !updatedAt) return null;
  const historyInput = item.history ?? [];
  if (!Array.isArray(historyInput)) return null;
  const history = historyInput.slice(-100).map((entry) => {
    if (!entry || typeof entry !== 'object' || !isTimestamp(entry.at)) return null;
    return {
      id: String(entry.id ?? crypto.randomUUID()),
      at: entry.at,
      channel: entry.channel === 'whatsapp' ? 'whatsapp' as const : 'email' as const,
      message: String(entry.message ?? '').slice(0, 5000),
    };
  });
  if (history.some((entry) => entry === null)) return null;
  return {
    id: String(item.id),
    clientName: String(item.clientName).slice(0, 120),
    contactName: String(item.contactName ?? '').slice(0, 120),
    invoiceNumber: String(item.invoiceNumber).slice(0, 80),
    amount: Number(item.amount),
    currency: /^[A-Z]{3}$/.test(String(item.currency)) ? String(item.currency) : 'USD',
    dueDate: item.dueDate,
    preference: item.preference === 'whatsapp' ? 'whatsapp' : 'email',
    email: String(item.email ?? '').slice(0, 254),
    whatsapp: String(item.whatsapp ?? '').slice(0, 40),
    cadenceDays: Math.min(60, Math.max(1, Number(item.cadenceDays) || 7)),
    notes: String(item.notes ?? '').slice(0, 3000),
    status: item.status === 'paid' ? 'paid' : 'open',
    draftEmail: item.draftEmail ? String(item.draftEmail).slice(0, 5000) : undefined,
    draftWhatsApp: item.draftWhatsApp ? String(item.draftWhatsApp).slice(0, 5000) : undefined,
    history: history as Invoice['history'],
    createdAt,
    updatedAt,
  };
}
