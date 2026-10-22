import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { levelById } from '@hva/game-core';
import { verifyAttempt } from '../../apps/web/src/telemetry/verify';
import type { TelemetryFile } from '../../apps/web/src/telemetry/types';
import { play, ready } from './helpers';

const keys = (page: Page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('hva.telemetry')));

test('off by default: playing records nothing and sends nothing', async ({ page, isMobile }) => {
  const hosts = new Set<string>();
  page.on('request', (r) => hosts.add(new URL(r.url()).origin));
  await page.goto('/?screen=arena&level=w01-first-steps&briefing=0');
  await ready(page);
  await play(page, 'RRDDRRUU', !!isMobile);
  await expect(page.getByTestId('reveal')).toBeVisible();
  expect(await keys(page)).toEqual([]);
  expect(hosts.size).toBe(1); // only the game's own origin
});

test('opt in, play with a hint, download, verify by replay, then delete', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'the download flow is the same on a phone; desktop covers it');
  await page.goto('/?screen=map');
  await page.getByTestId('settings-button').click();
  await expect(page.getByTestId('research-count')).toContainText('Off. Nothing is being recorded.');
  await expect(page.getByTestId('research-download')).toBeDisabled();
  await page.getByTestId('research-toggle').click();
  await expect(page.getByTestId('research-toggle')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('settings-back').click();
  await page.getByTestId('node-w01-first-steps').click();
  await page.getByTestId('begin').click();
  await ready(page);
  await page.getByTestId('hint-button').click();
  await page.getByTestId('reveal-hint').click();
  await page.getByRole('dialog', { name: 'Hints' }).getByRole('button', { name: 'Close' }).click();
  await play(page, 'RRDDRRUU', false);
  await expect(page.getByTestId('reveal')).toBeVisible();
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByTestId('settings-button').click();
  await expect(page.getByTestId('research-count')).toContainText('1 attempt saved');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('research-download').click()]);
  const file = JSON.parse(await (await import('node:fs/promises')).readFile((await download.path()) as string, 'utf8')) as TelemetryFile;
  expect(file.schema).toBe('hva.telemetry.1');
  expect(file.attempts).toHaveLength(1);
  const a = file.attempts[0]!;
  expect(a).toMatchObject({ levelId: 'w01-first-steps', outcome: { status: 'won', runActions: 8, assisted: true } });
  expect(a.hints).toHaveLength(1);
  expect(verifyAttempt(a, levelById('w01-first-steps')!)).toEqual({ ok: true, errors: [] });

  await page.getByTestId('research-delete').click();
  await expect(page.getByTestId('research-count')).toContainText('0 attempts saved');
  expect(await keys(page)).not.toContain('hva.telemetry.v1');

  // turning it off erases and stops recording
  await page.getByTestId('research-toggle').click();
  await page.getByTestId('settings-back').click();
  await page.getByTestId('node-w01-first-steps').click();
  await page.getByTestId('begin').click();
  await ready(page);
  await play(page, 'RR', false);
  expect(await keys(page)).not.toContain('hva.telemetry.v1');
});
