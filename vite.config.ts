import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const STATIC_SHELL = [
  '/', '/index.html', '/offline.html', '/manifest.webmanifest', '/robots.txt',
  '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png',
  '/icons/icon-maskable-512.png', '/assets/hero-topography-768.webp',
  '/assets/hero-topography.webp', '/assets/hero-topography.jpg',
];

/**
 * Keeps the offline shell tied to the emitted Vite entrypoints.  The worker is
 * deliberately generated after Rollup has named the hashed JS and CSS files,
 * rather than asking a human to keep a second list in sync.
 */
function generatedServiceWorker(): Plugin {
  let outDir = '';

  return {
    name: 'gentle-chase-generated-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const [template, html] = await Promise.all([
        readFile(resolve(process.cwd(), 'sw.template.js'), 'utf8'),
        readFile(resolve(outDir, 'index.html'), 'utf8'),
      ]);
      const emittedEntrypoints = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)]
        .map((match) => match[1]);
      const shell = [...new Set([...STATIC_SHELL, ...emittedEntrypoints])];
      const versionInput = await Promise.all(shell
        .filter((path) => path !== '/')
        .map((path) => readFile(resolve(outDir, `.${path}`))));
      const version = createHash('sha256')
        .update(template)
        .update(JSON.stringify(shell))
        .update(Buffer.concat(versionInput))
        .digest('hex')
        .slice(0, 16);
      const worker = template
        .replaceAll('__VERSION__', version)
        .replace('__SHELL__', JSON.stringify(shell));

      await writeFile(resolve(outDir, 'sw.js'), worker);
    },
  };
}

export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
  plugins: [generatedServiceWorker()],
});
