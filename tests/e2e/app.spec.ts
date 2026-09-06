import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function waitForServiceWorkerControl(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

async function addInvoice(page: import('@playwright/test').Page, index = 1): Promise<void> {
  const add = page.getByRole('button', { name: index === 1 ? 'Add a real invoice' : 'Add invoice' });
  await add.click();
  await page.getByLabel('Client or business *').fill(`Client ${index}`);
  await page.getByLabel('Invoice number *').fill(`INV-${index}`);
  await page.getByLabel('Amount *').fill(String(100 + index));
  await page.getByLabel('Due date *').fill('2026-08-01');
  await page.getByLabel('Email address').fill(`client${index}@example.com`);
  await page.getByRole('button', { name: 'Save invoice' }).click();
  await expect(page.getByText(`Client ${index}`, { exact: true }).first()).toBeVisible();
}

test('creates, edits, logs, persists, and works offline', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Write and track invoice follow/ })).toBeVisible();
  await page.getByRole('button', { name: 'Add a real invoice' }).click();
  await page.getByLabel('Client or business *').fill('Northwind Studio');
  await page.getByLabel('Contact name').fill('Maya');
  await page.getByLabel('Invoice number *').fill('NW-104');
  await page.getByLabel('Amount *').fill('1250');
  await page.getByLabel('Due date *').fill('2026-08-01');
  await page.getByLabel('Email address').fill('maya@example.com');
  await page.getByRole('button', { name: 'Save invoice' }).click();

  await expect(page.getByRole('heading', { level: 1, name: /Review invoice follow/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Northwind Studio' })).toBeVisible();
  await expect(page.getByLabel('Editable email draft')).toContainText('Hi Maya');
  await page.getByRole('button', { name: 'Log follow-up' }).click();
  await expect(page.getByText('Email follow-up logged')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Northwind Studio', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Email follow-up logged')).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);

  await waitForServiceWorkerControl(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /Review invoice follow/ })).toBeVisible();
  await expect(page.getByText(/Offline — changes stay on this device/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('boots from the complete precached shell on a first cold offline reload @claim:offline-reload', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('/demo');
    await expect(page.getByText('Northwind Studio', { exact: true }).first()).toBeVisible();
    await waitForServiceWorkerControl(page);

    const precache = await page.evaluate(async () => {
      const cacheName = (await caches.keys()).find((key) => key.startsWith('gentle-chase-'));
      if (!cacheName) return [];
      return (await (await caches.open(cacheName)).keys()).map((request) => new URL(request.url).pathname);
    });
    expect(precache.some((path) => /^\/assets\/index-.*\.js$/.test(path))).toBe(true);
    expect(precache.some((path) => /^\/assets\/index-.*\.css$/.test(path))).toBe(true);

    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.clearBrowserCache');
    const offlineAssets: Array<{ path: string; status: number; fromServiceWorker: boolean }> = [];
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      if (/^\/assets\/index-.*\.(?:js|css)$/.test(path)) {
        offlineAssets.push({ path, status: response.status(), fromServiceWorker: response.fromServiceWorker() });
      }
    });
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: /Review invoice follow/ })).toBeVisible();
    await expect(page.getByText('Northwind Studio', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Offline — changes stay on this device/)).toBeVisible();
    expect(offlineAssets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: expect.stringMatching(/^\/assets\/index-.*\.js$/), status: 200, fromServiceWorker: true }),
      expect.objectContaining({ path: expect.stringMatching(/^\/assets\/index-.*\.css$/), status: 200, fromServiceWorker: true }),
    ]));
  } finally {
    await context.close();
  }
});

test('announces a newly installed service worker and uses its new cache version', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The worker file is changed only once for the desktop regression run.');
  await page.goto('/');
  await waitForServiceWorkerControl(page);

  const before = await page.evaluate(async () => (await caches.keys()).find((key) => key.startsWith('gentle-chase-')));
  expect(before).toBeTruthy();
  const workerPath = resolve(process.cwd(), 'dist/sw.js');
  const original = await readFile(workerPath, 'utf8');
  const replacement = `gentle-chase-regression-${Date.now()}`;
  const changed = original.replace(/const VERSION = 'gentle-chase-[^']+';/, `const VERSION = '${replacement}';`);
  expect(changed).not.toBe(original);

  try {
    await writeFile(workerPath, changed);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });
    await expect(page.getByText('Gentle Chase was updated for your next visit.')).toBeVisible();
    await expect.poll(() => page.evaluate(async (expected) => (await caches.keys()).includes(expected), replacement)).toBe(true);
  } finally {
    await writeFile(workerPath, original);
  }
});

test('rejects a zero-dollar invoice before it can become an active route', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add a real invoice' }).click();
  await page.getByLabel('Client or business *').fill('Northwind Studio');
  await page.getByLabel('Invoice number *').fill('NW-0');
  const amount = page.getByLabel('Amount *');
  await amount.fill('0');
  await page.getByRole('button', { name: 'Save invoice' }).click();

  await expect(page.locator('#invoice-dialog')).toHaveAttribute('open', '');
  expect(await amount.evaluate((input) => (input as HTMLInputElement).validity.rangeUnderflow)).toBe(true);
  await expect(page.getByRole('heading', { level: 1, name: /Review invoice follow/ })).toHaveCount(0);
});

test('keeps the skip link and invoice dialog keyboard-operable', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();

  await page.getByRole('button', { name: 'Add a real invoice' }).click();
  await expect(page.getByLabel('Client or business *')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#invoice-dialog')).not.toHaveAttribute('open', '');
  await expect(page.getByRole('button', { name: 'Add a real invoice' })).toBeFocused();
});

test('legal routes and empty state are accessible', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page).toHaveTitle('Privacy — Gentle Chase');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByRole('main')).toBeVisible();
  const privacyScan = await new AxeBuilder({ page }).analyze();
  expect(privacyScan.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  await page.getByRole('link', { name: 'Terms' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible();
});

test('a verified Plus license removes the five-invoice limit @claim:plus-limit', async ({ page }) => {
  await page.route('https://pilot-api.sociobot.in/api/v1/products/relationship-safe-payment-followup/verify?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true, reason: 'ok', expires_at: null }) });
  });
  await page.goto('/');
  const now = new Date().toISOString();
  await page.evaluate(async ({ timestamp }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('gentle-chase', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('invoices', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction('invoices', 'readwrite');
    for (let index = 1; index <= 5; index += 1) {
      transaction.objectStore('invoices').put({
        id: `seed-${index}`, clientName: `Seed client ${index}`, contactName: '', invoiceNumber: `SEED-${index}`,
        amount: index * 100, currency: 'USD', dueDate: '2026-08-01', preference: 'email', email: '', whatsapp: '',
        cadenceDays: 7, notes: '', status: 'open', history: [], createdAt: timestamp, updatedAt: timestamp,
      });
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, { timestamp: now });
  await page.goto('/?license=test-license-token');
  await expect(page).toHaveURL('/');
  await expect(page.getByText('Gentle Chase Plus is unlocked on this device.')).toBeVisible();
  await page.getByRole('button', { name: 'Data, license, and settings' }).click();
  await expect(page.getByText('Plus is active on this device')).toBeVisible();
  await expect(page.getByRole('link', { name: /Buy once/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close' }).click();
  await addInvoice(page, 6);
  await expect(page.locator('.invoice-list li')).toHaveCount(6);
});

test('invalid imports are skipped and a valid invoice still works after reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await addInvoice(page);
  await page.getByRole('button', { name: 'Data, license, and settings' }).click();
  const now = new Date().toISOString();
  const invalid = {
    product: 'Gentle Chase', version: 1, exportedAt: now,
    invoices: [{
      id: 'bad-date', clientName: 'Impossible Date', contactName: '', invoiceNumber: 'BAD-1', amount: 10,
      currency: 'USD', dueDate: '2026-99-99', preference: 'email', email: '', whatsapp: '', cadenceDays: 7,
      notes: '', status: 'open', history: [], createdAt: now, updatedAt: now,
    }],
  };
  await page.locator('#import-file').setInputFiles({
    name: 'invalid-date.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)),
  });
  await expect(page.getByText(/0 invoice records imported; 1 skipped/)).toBeAttached();
  await expect(page.getByText('Client 1', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Client 1', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Impossible Date')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a damaged stored record opens a usable recovery screen and can be removed', async ({ page }) => {
  await page.goto('/');
  const now = new Date().toISOString();
  await page.evaluate(async ({ timestamp }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('gentle-chase', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('invoices', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction('invoices', 'readwrite');
    transaction.objectStore('invoices').put({
      id: 'stored-bad-date', clientName: 'Stored Invalid', invoiceNumber: 'BAD-2', amount: 10,
      currency: 'USD', dueDate: '2026-99-99', preference: 'email', cadenceDays: 7, status: 'open',
      history: [], createdAt: timestamp, updatedAt: timestamp,
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, { timestamp: now });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /Write and track invoice follow/ })).toBeVisible();
  await expect(page.getByText(/1 damaged record was left out/)).toBeVisible();
  await page.getByRole('button', { name: 'Review data controls' }).click();
  await expect(page.getByRole('heading', { name: 'Damaged records' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove damaged record' }).click();
  await expect(page.getByText(/1 damaged record removed/)).toBeAttached();
  await page.reload();
  await expect(page.getByText(/damaged record was left out/)).toHaveCount(0);
});

test('the demo is one click and cannot change real invoices @claim:demo-sandbox', async ({ page }) => {
  await page.goto('/');
  await addInvoice(page);
  await page.getByRole('link', { name: 'Demo', exact: true }).click();
  await expect(page).toHaveURL('/demo');
  await expect(page).toHaveTitle('Demo — Gentle Chase');
  await expect(page.getByText('Demo — sample data, nothing is saved to your records')).toBeVisible();
  await expect(page.getByText('Northwind Studio', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Client 1', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.locator('.invoice-list li')).toHaveCount(2);
  await page.getByRole('button', { name: 'Start for real' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByText('Client 1', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Northwind Studio', { exact: true })).toHaveCount(0);
});

test('normal invoice use stays local and persists after reload @claim:local-data', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await addInvoice(page);
  await page.reload();
  await expect(page.getByText('Client 1', { exact: true }).first()).toBeVisible();
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every((url) => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
});

test('drafts are editable and logging never contacts a client @claim:manual-drafts', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') externalRequests.push(request.url());
  });
  await page.goto('/demo');
  const draft = page.getByLabel('Editable email draft');
  await expect(draft).toContainText('invoice NW-104');
  await draft.fill('Hi Maya, could you confirm when invoice NW-104 will be paid?');
  await page.getByRole('button', { name: 'Copy email draft' }).click();
  await expect(page.getByText('Copied — paste into your email. Nothing was sent.')).toBeAttached();
  await page.getByRole('button', { name: 'Log follow-up' }).click();
  await expect(page.getByText('Email follow-up logged')).toBeVisible();
  expect(externalRequests).toEqual([]);
});

test('exports all sample records as JSON and CSV @claim:data-export', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Data, license, and settings' }).click();
  const jsonDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const jsonDownload = await jsonDownloadPromise;
  const jsonPath = await jsonDownload.path();
  expect(jsonPath).toBeTruthy();
  const bundle = JSON.parse(await readFile(jsonPath!, 'utf8')) as { invoices: Array<{ clientName: string }> };
  expect(bundle.invoices).toHaveLength(3);
  expect(bundle.invoices.map((invoice) => invoice.clientName)).toContain('Harbor & Pine');

  const csvDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const csvDownload = await csvDownloadPromise;
  const csvPath = await csvDownload.path();
  expect(csvPath).toBeTruthy();
  const csv = await readFile(csvPath!, 'utf8');
  expect(csv.split('\n')).toHaveLength(4);
  expect(csv).toContain('"Client","Invoice","Amount"');
  expect(csv).toContain('"Little Fern Bakery"');
});

test('the free version stops a sixth active invoice @claim:free-limit', async ({ page }) => {
  await page.goto('/');
  for (let index = 1; index <= 5; index += 1) await addInvoice(page, index);
  await page.getByRole('button', { name: 'Add invoice' }).click();
  await expect(page.locator('#settings-dialog')).toHaveAttribute('open', '');
  await expect(page.getByText('The free version keeps up to five active invoices')).toBeVisible();
  await expect(page.locator('.invoice-list li')).toHaveCount(5);
});

test('the reported mobile purchase and legal targets are at least 44 pixels', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'This regression measures the 390px touch layout.');
  await page.goto('/demo');
  const purchase = page.getByRole('button', { name: 'See one-time purchase' });
  const purchaseBox = await purchase.boundingBox();
  expect(purchaseBox?.width).toBeGreaterThanOrEqual(44);
  expect(purchaseBox?.height).toBeGreaterThanOrEqual(44);
  await purchase.click();
  for (const name of ['Terms', 'Privacy']) {
    const box = await page.locator('.fine-print').getByRole('link', { name }).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test('unknown routes have a clear 404 page and a working return link', async ({ page }) => {
  await page.goto('/missing-page');
  await expect(page).toHaveTitle('Page not found — Gentle Chase');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Open the invoice follow-up app' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1, name: /Write and track invoice follow/ })).toBeVisible();
});
