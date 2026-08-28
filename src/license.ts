import type { LicenseState } from './types';

export const PRODUCT_SLUG = 'relationship-safe-payment-followup';
const BILLING_BASE = import.meta.env.VITE_BILLING_API_BASE
  ?? (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'https://pilot-api.sociobot.in'
    : 'https://api.sociobot.in');
export const BUY_URL = `${BILLING_BASE}/api/v1/products/${PRODUCT_SLUG}/checkout`;
const TOKEN_KEY = `sb_license:${PRODUCT_SLUG}`;
const VERDICT_KEY = `${TOKEN_KEY}:verdict`;
const ONE_DAY = 86_400_000;

interface Verdict {
  token: string;
  valid: boolean;
  checkedAt: number;
}

function cachedVerdict(token: string): Verdict | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(VERDICT_KEY) ?? 'null') as Verdict | null;
    return parsed?.token === token ? parsed : null;
  } catch {
    return null;
  }
}

export function captureLicenseFromUrl(): boolean {
  const url = new URL(location.href);
  const token = url.searchParams.get('license')?.trim();
  if (!token) return false;
  localStorage.setItem(TOKEN_KEY, token);
  url.searchParams.delete('license');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  return true;
}

export function saveLicense(token: string): void {
  localStorage.setItem(TOKEN_KEY, token.trim());
  localStorage.removeItem(VERDICT_KEY);
}

export function forgetLicense(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(VERDICT_KEY);
}

export function initialLicenseState(): LicenseState {
  const token = localStorage.getItem(TOKEN_KEY);
  const verdict = token ? cachedVerdict(token) : null;
  return {
    token,
    unlocked: Boolean(verdict?.valid),
    checking: Boolean(token && (!verdict || Date.now() - verdict.checkedAt > ONE_DAY)),
    notice: verdict && !verdict.valid ? 'This license is no longer active.' : '',
  };
}

export async function verifyLicense(force = false): Promise<LicenseState> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return { token: null, unlocked: false, checking: false, notice: '' };
  const cached = cachedVerdict(token);
  if (!force && cached && Date.now() - cached.checkedAt < ONE_DAY) {
    return { token, unlocked: cached.valid, checking: false, notice: cached.valid ? '' : 'This license is no longer active.' };
  }
  try {
    const response = await fetch(`${BILLING_BASE}/api/v1/products/${PRODUCT_SLUG}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error(`Verification returned ${response.status}`);
    const result = await response.json() as { valid: boolean };
    const verdict: Verdict = { token, valid: result.valid === true, checkedAt: Date.now() };
    localStorage.setItem(VERDICT_KEY, JSON.stringify(verdict));
    return {
      token,
      unlocked: verdict.valid,
      checking: false,
      notice: verdict.valid ? 'Gentle Chase Plus is unlocked on this device.' : 'This license is no longer active.',
    };
  } catch {
    return {
      token,
      unlocked: Boolean(cached?.valid),
      checking: false,
      notice: cached?.valid
        ? 'Offline — using the last verified license on this device.'
        : 'Could not verify this license. Check your connection and try again.',
    };
  }
}
