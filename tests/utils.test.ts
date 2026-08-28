import { describe, expect, it } from 'vitest';
import type { Invoice } from '../src/types';
import { daysBetween, draftFor, needsAttention, nextFollowUp, normalizeInvoice } from '../src/utils';

const invoice: Invoice = {
  id: 'invoice-1', clientName: 'Northwind Studio', contactName: 'Maya', invoiceNumber: 'NW-104',
  amount: 1250, currency: 'USD', dueDate: '2026-08-01', preference: 'email', email: 'maya@example.com',
  whatsapp: '', cadenceDays: 7, notes: '', status: 'open', history: [],
  createdAt: '2026-08-01T12:00:00.000Z', updatedAt: '2026-08-01T12:00:00.000Z',
};

describe('follow-up schedule', () => {
  it('uses the due date for a route with no history', () => {
    expect(nextFollowUp(invoice)).toBe('2026-08-01');
    expect(needsAttention(invoice, '2026-08-08')).toBe(true);
  });

  it('advances from the latest logged follow-up by the chosen cadence', () => {
    const withHistory: Invoice = {
      ...invoice,
      history: [{ id: 'follow-1', at: '2026-08-09T09:00:00.000Z', channel: 'email', message: 'Hello' }],
    };
    expect(nextFollowUp(withHistory)).toBe('2026-08-16');
    expect(needsAttention(withHistory, '2026-08-15')).toBe(false);
  });

  it('does not flag paid invoices', () => {
    expect(needsAttention({ ...invoice, status: 'paid' }, '2026-08-08')).toBe(false);
  });

  it('counts calendar days consistently', () => {
    expect(daysBetween('2026-08-01', '2026-08-28')).toBe(27);
  });
});

describe('message drafts and imports', () => {
  it('creates neutral copy without making threats or claiming to send', () => {
    const message = draftFor(invoice, 'email');
    expect(message).toContain('Hi Maya');
    expect(message).toContain('invoice NW-104');
    expect(message).toContain('could you let me know');
    expect(message.toLowerCase()).not.toContain('legal action');
  });

  it('rejects malformed import records and bounds cadence', () => {
    expect(normalizeInvoice({ clientName: 'Missing id' })).toBeNull();
    expect(normalizeInvoice({ ...invoice, cadenceDays: 999 })?.cadenceDays).toBe(60);
  });
});
