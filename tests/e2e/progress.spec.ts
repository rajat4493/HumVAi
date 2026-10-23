import { expect, test } from '@playwright/test';
import { CAMPAIGN_ORDER } from '@hva/game-core';
import { play, ready, state } from './helpers';

const WIN1 = 'RRDDRRUU';

test('fresh start: only world 1 is open; winning it unlocks world 2, saves, and earns achievements that survive a reload', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('progress-summary')).toHaveText(`0 of ${CAMPAIGN_ORDER.length} worlds finished`);
  await expect(page.getByTestId('node-w01-first-steps')).toBeEnabled();
  await expect(page.getByTestId('node-w02-orange-switch')).toBeDisabled();

  await page.getByTestId('node-w01-first-steps').click();
  await page.getByTestId('begin').click();
  await play(page, WIN1, !!isMobile);
  const result = page.getByRole('dialog', { name: 'Result' });
  await expect(result).toContainText('New personal best');
  await expect(result).toContainText('Shortest possible run');
  await expect(result).toContainText('Achievement: Out of the Garden');
  await result.getByRole('button', { name: 'Map' }).click();

  await expect(page.getByTestId('progress-summary')).toHaveText(`1 of ${CAMPAIGN_ORDER.length} worlds finished`);
  await expect(page.getByTestId('node-w02-orange-switch')).toBeEnabled();
  await expect(page.getByTestId('node-w01-first-steps')).toContainText('Shortest possible');

  await page.reload(); // the URL is the screen now: a refresh stays on the map
  await expect(page.getByTestId('progress-summary')).toHaveText(`1 of ${CAMPAIGN_ORDER.length} worlds finished`);
  await page.getByTestId('hall-button').click();
  await expect(page.getByTestId('hall-count')).toHaveText('2 of 10 earned');
  await expect(page.getByTestId('ach-first-exit')).toContainText('Out of the Garden');
  await expect(page.getByTestId('ach-tide-turner')).toContainText('Not yet earned');
});

test('a run in progress survives a refresh and can be continued or abandoned', async ({ page, isMobile }) => {
  await page.goto('/?screen=arena&level=2&unlock=all');
  await page.getByTestId('begin').click();
  await play(page, 'RRD', !!isMobile);
  expect(await state(page)).toMatchObject({ scout: { used: 3 }, player: { x: 3, y: 2 } });

  await page.goto('/?screen=map&unlock=all');
  await expect(page.getByTestId('continue')).toHaveText('Continue your run');
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('begin')).toHaveText('Continue');
  await page.getByTestId('begin').click();
  await ready(page);
  expect(await state(page)).toMatchObject({ phase: 'explore', scout: { used: 3 }, player: { x: 3, y: 2 } });

  await page.reload(); // a refresh stays in the world; the saved run is still offered
  await page.getByRole('button', { name: 'Start over' }).click();
  await ready(page);
  expect(await state(page)).toMatchObject({ scout: { used: 0 }, player: { x: 1, y: 1 } });
});

test('hints mark the run assisted: the world is completed but no personal best or achievements are awarded', async ({ page, isMobile }) => {
  await page.goto('/?screen=arena&level=1');
  await page.getByTestId('begin').click();
  await page.getByTestId('hint-button').click();
  await page.getByTestId('reveal-hint').click();
  await expect(page.getByRole('dialog', { name: 'Hints' })).toContainText('Walls block you');
  await page.getByRole('dialog', { name: 'Hints' }).getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('Assisted', { exact: true }).first()).toBeVisible();

  await play(page, WIN1, !!isMobile);
  const result = page.getByRole('dialog', { name: 'Result' });
  await expect(result).toContainText('Assisted');
  await expect(result).not.toContainText('New personal best');
  await expect(result).not.toContainText('Achievement:');
  await result.getByRole('button', { name: 'Map' }).click();
  await expect(page.getByTestId('node-w01-first-steps')).toContainText('assisted');
  await expect(page.getByTestId('progress-summary')).toHaveText(`1 of ${CAMPAIGN_ORDER.length} worlds finished`);
  await page.getByTestId('hall-button').click();
  await expect(page.getByTestId('hall-count')).toHaveText('0 of 10 earned');
});

test('settings persist, motion override applies, and reset erases progress after confirmation', async ({ page, isMobile }) => {
  await page.goto('/?screen=arena&level=1');
  await page.getByTestId('begin').click();
  await play(page, WIN1, !!isMobile);
  await page.getByRole('dialog', { name: 'Result' }).getByRole('button', { name: 'Map' }).click();
  await page.getByTestId('settings-button').click();

  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('sound-toggle').click();
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('motion-reduced').click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');

  await page.goto('/'); // a fresh load: settings must come back from storage
  await page.getByTestId('welcome-settings').click();
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('motion-reduced')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');

  await page.getByTestId('reset-progress').click();
  await page.getByRole('button', { name: 'Keep my progress' }).click();
  await page.getByTestId('settings-back').click();
  await page.getByTestId('play').click();
  await expect(page.getByTestId('progress-summary')).toHaveText(`1 of ${CAMPAIGN_ORDER.length} worlds finished`);

  await page.getByTestId('settings-button').click();
  await page.getByTestId('reset-progress').click();
  await page.getByTestId('confirm-reset').click();
  await page.getByTestId('settings-back').click();
  await expect(page.getByTestId('progress-summary')).toHaveText(`0 of ${CAMPAIGN_ORDER.length} worlds finished`);
  await page.getByTestId('settings-button').click();
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-checked', 'false'); // settings are kept on reset
});

test('dialogs trap focus, close on Escape, and return focus to the button that opened them', async ({ page }) => {
  await page.goto('/?screen=arena&level=1&briefing=0');
  await ready(page);
  const menu = page.getByTestId('menu-button');
  await menu.click();
  const dialog = page.getByRole('dialog', { name: 'Menu' });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  // the page behind the dialog is inert and game keys do nothing
  expect(await page.evaluate(() => document.getElementById('root')?.hasAttribute('inert'))).toBe(true);
  await page.keyboard.press('ArrowRight');
  expect((await state(page)).run.used).toBe(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(menu).toBeFocused();
});

test('the game still works when browser storage is blocked (plays from memory, no crash)', async ({ page, isMobile }) => {
  await page.addInitScript(() => {
    const boom = () => {
      throw new Error('blocked');
    };
    Object.defineProperty(window, 'localStorage', { get: boom });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByText('cannot save progress')).toBeVisible();
  await page.getByTestId('play').click();
  await page.getByTestId('node-w01-first-steps').click();
  await page.getByTestId('begin').click();
  await play(page, WIN1, !!isMobile);
  await expect(page.getByRole('dialog', { name: 'Result' })).toContainText('You made it out');
  await page.getByRole('dialog', { name: 'Result' }).getByRole('button', { name: 'Map' }).click();
  await expect(page.getByTestId('progress-summary')).toHaveText(`1 of ${CAMPAIGN_ORDER.length} worlds finished`);
  expect(errors).toEqual([]);
});
