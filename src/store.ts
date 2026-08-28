import type { ExportBundle, Invoice } from './types';
import { normalizeInvoice } from './utils';

const DB_NAME = 'gentle-chase';
const STORE = 'invoices';
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open private storage.'));
    request.onblocked = () => reject(new Error('Storage upgrade is blocked by another Gentle Chase tab.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Storage request failed.'));
  });
}

export async function getInvoices(): Promise<Invoice[]> {
  const db = await openDatabase();
  try {
    const items = await requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
    return (items as unknown[]).map(normalizeInvoice).filter((item): item is Invoice => Boolean(item));
  } finally {
    db.close();
  }
}

export async function putInvoice(invoice: Invoice): Promise<void> {
  const db = await openDatabase();
  try {
    await requestResult(db.transaction(STORE, 'readwrite').objectStore(STORE).put(invoice));
  } finally {
    db.close();
  }
}

export async function deleteInvoice(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    await requestResult(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id));
  } finally {
    db.close();
  }
}

export async function clearInvoices(): Promise<void> {
  const db = await openDatabase();
  try {
    await requestResult(db.transaction(STORE, 'readwrite').objectStore(STORE).clear());
  } finally {
    db.close();
  }
}

export async function importBundle(input: unknown): Promise<{ imported: number; skipped: number }> {
  if (!input || typeof input !== 'object' || !Array.isArray((input as Partial<ExportBundle>).invoices)) {
    throw new Error('Choose a Gentle Chase JSON export with an invoices list.');
  }
  const incoming = (input as ExportBundle).invoices;
  const current = new Map((await getInvoices()).map((invoice) => [invoice.id, invoice]));
  let imported = 0;
  let skipped = 0;
  for (const raw of incoming) {
    const invoice = normalizeInvoice(raw);
    if (!invoice) { skipped += 1; continue; }
    const existing = current.get(invoice.id);
    if (!existing || invoice.updatedAt >= existing.updatedAt) {
      await putInvoice(invoice);
      imported += 1;
    } else {
      skipped += 1;
    }
  }
  return { imported, skipped };
}
