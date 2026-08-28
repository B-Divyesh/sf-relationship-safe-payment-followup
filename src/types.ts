export type ContactPreference = 'email' | 'whatsapp';
export type InvoiceStatus = 'open' | 'paid';

export interface FollowUp {
  id: string;
  at: string;
  channel: ContactPreference;
  message: string;
}

export interface Invoice {
  id: string;
  clientName: string;
  contactName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: string;
  preference: ContactPreference;
  email: string;
  whatsapp: string;
  cadenceDays: number;
  notes: string;
  status: InvoiceStatus;
  draftEmail?: string;
  draftWhatsApp?: string;
  history: FollowUp[];
  createdAt: string;
  updatedAt: string;
}

export interface ExportBundle {
  product: 'Gentle Chase';
  version: 1;
  exportedAt: string;
  invoices: Invoice[];
}

export interface LicenseState {
  token: string | null;
  unlocked: boolean;
  checking: boolean;
  notice: string;
}
