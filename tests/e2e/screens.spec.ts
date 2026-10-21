import { test } from '@playwright/test';
import { ready } from './helpers';

// Stage 1 screen captures into docs/design/screenshots (run with `npm run screenshots`).
const out = 'docs/design/screenshots';

const progress = {
  v: 1,
  levels: {
    'w01-first-steps': { completed: true, attempts: 2, wins: 2, bestRun: 8, bestUnassistedRun: 8, bestActions: null, firstWonAt: '2026-01-01T00:00:00Z', usedHints: false },
    'w02-orange-switch': { completed: true, attempts: 3, wins: 1, bestRun: 11, bestUnassistedRun: null, bestActions: null, firstWonAt: '2026-01-02T00:00:00Z', usedHints: true },
  },
  achievements: { 'first-exit': { at: '2026-01-01T00:00:00Z', levelId: 'w01-first-steps' }, 'shortest-path': { at: '2026-01-01T00:00:00Z', levelId: 'w01-first-steps' } },
  settings: { sound: true, music: true, volume: 0.7, motion: 'system' },
};

test('stage 1 screens', async ({ page }, info) => {
  const tag = info.project.name;
  const shot = async (name: string, wait = 350) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${out}/${tag}-s1-${name}.png` });
  };
  await page.goto('/');
  await shot('01-title');
  await page.getByTestId('play').click();
  await shot('02-map-fresh');

  await page.addInitScript((p) => localStorage.setItem('hva.save.v1', JSON.stringify(p)), progress);
  await page.goto('/?screen=map');
  await shot('03-map-progress');
  await page.getByTestId('settings-button').click();
  await shot('04-settings');
  await page.getByTestId('settings-back').click();
  await page.getByTestId('hall-button').click();
  await shot('05-hall');

  await page.goto('/?screen=arena&level=2&briefing=0');
  await ready(page);
  await page.getByTestId('hint-button').click();
  await page.getByTestId('reveal-hint').click();
  await shot('06-hint-dialog');
  await page.getByRole('dialog', { name: 'Hints' }).getByRole('button', { name: 'Close' }).click();
  await page.getByTestId('menu-button').click();
  await shot('07-menu');
});
