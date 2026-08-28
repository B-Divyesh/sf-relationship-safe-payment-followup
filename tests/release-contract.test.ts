import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface StaticWebAppConfig {
  globalHeaders: Record<string, string>;
  routes: Array<{ route: string; headers: Record<string, string> }>;
}

describe('static deployment response policy', () => {
  it('keeps immutable hashed assets and the browser hardening policy in the deploy config', async () => {
    const source = await readFile(resolve(process.cwd(), 'public/staticwebapp.config.json'), 'utf8');
    const config = JSON.parse(source) as StaticWebAppConfig;
    const headers = config.globalHeaders;
    const assetRoute = config.routes.find((route) => route.route === '/assets/*');

    expect(assetRoute?.headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(headers['Permissions-Policy']).toContain('camera=()');
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });
});
