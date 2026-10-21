import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface Hva {
  getState(): { status: string; actionsUsed: number; player: { x: number; y: number }; budget: number };
  log: unknown[];
}
const state = (page: Page) =>
  page.evaluate(() => (window as unknown as { __HVA__: Hva }).__HVA__.getState());

test('welcome -> briefing -> play level 1 to victory', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('HUMANS');
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('dialog', { name: 'Challenge briefing' })).toBeVisible();
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.locator('canvas')).toBeVisible();

  expect((await state(page)).actionsUsed).toBe(0);

  // optimal solution for level 1: R R D D R R U U
  const moves = ['RIGHT', 'RIGHT', 'DOWN', 'DOWN', 'RIGHT', 'RIGHT', 'UP', 'UP'] as const;
  const label = { RIGHT: 'Move right', DOWN: 'Move down', UP: 'Move up', LEFT: 'Move left' };
  for (const m of moves) {
    if (isMobile) await page.getByRole('button', { name: label[m] }).click();
    else await page.keyboard.press(`Arrow${m[0]}${m.slice(1).toLowerCase()}`);
  }

  await expect(page.getByRole('dialog', { name: 'Result' })).toContainText('Humanity scores');
  const s = await state(page);
  expect(s.status).toBe('won');
  expect(s.actionsUsed).toBe(8);

  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('dialog', { name: 'Result' })).toBeHidden();
  expect((await state(page)).actionsUsed).toBe(0);
  expect(errors).toEqual([]);
});

test('holding a key does not burn budget', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard only');
  await page.goto('/?screen=arena&briefing=0');
  await expect(page.locator('canvas')).toBeVisible();
  // Playwright marks repeated downs without an up as auto-repeat (event.repeat === true).
  for (let i = 0; i < 6; i++) await page.keyboard.down('ArrowRight');
  await page.keyboard.up('ArrowRight');
  expect((await state(page)).actionsUsed).toBe(1);
});

test('layout has no horizontal scroll and board fills its area', async ({ page }) => {
  await page.goto('/?screen=arena&briefing=0');
  await expect(page.locator('canvas')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const box = await page.locator('canvas').boundingBox();
  expect(box && box.width > 200 && box.height > 150).toBe(true);
});
