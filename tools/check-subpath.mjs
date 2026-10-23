// Proves the production build works when served under a sub-path, as GitHub Pages does (https://<owner>.github.io/HumVAi/).
// Serves a copy of apps/web/dist at /HumVAi/, opens it in Chromium, plays World 1 to a win and fails on any console
// error, page error or failed request. Needs a build (npm run build) and Chromium.
/* global window */
import { cpSync, mkdtempSync, rmSync, mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { chromium } from '@playwright/test';

const dist = new URL('../apps/web/dist/', import.meta.url).pathname;
if (!existsSync(join(dist, 'index.html'))) throw new Error('run `npm run build` first');
const root = mkdtempSync(join(tmpdir(), 'hva-subpath-'));
mkdirSync(join(root, 'HumVAi'));
cpSync(dist, join(root, 'HumVAi'), { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  let path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (path.endsWith('/')) path += 'index.html';
  const file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/HumVAi/`;

const problems = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('recordings/index.json') && problems.push(`console: ${m.text()}`));
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`));
  page.on('response', (r) => r.status() >= 400 && !r.url().endsWith('recordings/index.json') && problems.push(`HTTP ${r.status()}: ${r.url()}`));

  await page.goto(base);
  await page.getByTestId('game-pattern-hunter').waitFor();
  await page.getByTestId('play').click();
  await page.getByTestId('node-w01-first-steps').click();
  await page.getByTestId('begin').click();
  await page.waitForFunction(() => '__HVA__' in window);
  for (const k of 'RRDDRRUU') await page.keyboard.press({ R: 'ArrowRight', D: 'ArrowDown', U: 'ArrowUp' }[k]);
  await page.getByTestId('reveal').waitFor({ timeout: 5000 });
  const text = await page.getByTestId('reveal').innerText();
  if (/live|thinking/i.test(text)) problems.push(`reveal text claims live play: ${text}`);
  const providerCalls = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /anthropic|openai/i.test(n)));
  if (providerCalls.length) problems.push(`browser contacted an AI provider: ${providerCalls.join(', ')}`);
  // direct links under the sub-path: a game page and an unknown address
  await page.goto(`${base}#/pattern-hunter`);
  await page.getByTestId('ph-experimental').waitFor();
  await page.goto(`${base}#/nowhere`);
  await page.reload();
  await page.getByTestId('play').waitFor();
} finally {
  await browser.close();
  server.close();
  rmSync(root, { recursive: true, force: true });
}
if (problems.length) {
  console.error(`sub-path check FAILED:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`sub-path check passed: ${base} loaded, World 1 won, no errors, no provider requests`);
