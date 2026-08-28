import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('creates, edits, logs, persists, and works offline', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Keep the invoice moving/ })).toBeVisible();
  await page.getByRole('button', { name: 'Add your first invoice' }).click();
  await page.getByLabel('Client or business *').fill('Northwind Studio');
  await page.getByLabel('Contact name').fill('Maya');
  await page.getByLabel('Invoice number *').fill('NW-104');
  await page.getByLabel('Amount *').fill('1250');
  await page.getByLabel('Due date *').fill('2026-08-01');
  await page.getByLabel('Email address').fill('maya@example.com');
  await page.getByRole('button', { name: 'Save invoice' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Your follow-up routes' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Northwind Studio' })).toBeVisible();
  await expect(page.getByLabel('Editable email draft')).toContainText('Hi Maya');
  await page.getByRole('button', { name: 'Log follow-up' }).click();
  await expect(page.getByText('Email follow-up logged')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Northwind Studio', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Email follow-up logged')).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);

  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Your follow-up routes' })).toBeVisible();
  await expect(page.getByText(/Offline — changes stay on this device/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('legal routes and empty state are accessible', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page).toHaveTitle('Privacy — Gentle Chase');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByRole('main')).toBeVisible();
  const privacyScan = await new AxeBuilder({ page }).analyze();
  expect(privacyScan.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  await page.getByRole('link', { name: 'Terms' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of use.' })).toBeVisible();
});

test('restores a one-time license through the Sociobot contract', async ({ page }) => {
  await page.route('https://pilot-api.sociobot.in/api/v1/products/relationship-safe-payment-followup/verify?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true, reason: 'ok', expires_at: null }) });
  });
  await page.goto('/?license=test-license-token');
  await expect(page).toHaveURL('/');
  await page.getByRole('button', { name: 'Data, license, and settings' }).click();
  await expect(page.getByText('Plus is active on this device')).toBeVisible();
  await expect(page.getByRole('link', { name: /Buy once/ })).toHaveCount(0);
});
