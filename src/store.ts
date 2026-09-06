import type { ExportBundle, Invoice } from './types';
import { normalizeInvoice } from './utils';

const REAL_DB_NAME = 'gentle-chase';
const DEMO_DB_NAME = 'gentle-chase-demo';
const STORE = 'invoices';
const DB_VERSION = 1;
let databaseName = REAL_DB_NAME;

export function setDemoStorage(enabled: boolean): void {
  databaseName = enabled ? DEMO_DB_NAME : REAL_DB_NAME;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, DB_VERSION);
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

export async function loadInvoices(): Promise<{ invoices: Invoice[]; skipped: number }> {
  const db = await openDatabase();
  try {
    const items = await requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
    const normalized = (items as unknown[]).map(normalizeInvoice);
    return {
      invoices: normalized.filter((item): item is Invoice => Boolean(item)),
      skipped: normalized.filter((item) => !item).length,
    };
  } finally {
    db.close();
  }
}

export async function getInvoices(): Promise<Invoice[]> {
  return (await loadInvoices()).invoices;
}

export async function removeInvalidInvoices(): Promise<number> {
  const db = await openDatabase();
  try {
    const items = await requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
    const invalidKeys = (items as Array<Record<string, unknown>>)
      .filter((item) => !normalizeInvoice(item))
      .map((item) => item.id as IDBValidKey)
      .filter((key) => key !== undefined);
    if (!invalidKeys.length) return 0;
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    await Promise.all(invalidKeys.map((key) => requestResult(store.delete(key))));
    return invalidKeys.length;
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
