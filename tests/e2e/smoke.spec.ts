import { expect, test } from '@playwright/test';
import { CAMPAIGN_ORDER } from '@hva/game-core';
import type { Page } from '@playwright/test';
import { play, ready, state } from './helpers';

const noErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
};

test('welcome -> briefing -> play world 1 to victory in exactly 8 actions', async ({ page, isMobile }) => {
  const errors = noErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('HUMANS');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByTestId('node-w01-first-steps').click();
  await expect(page.getByRole('dialog', { name: 'Challenge briefing' })).toBeVisible();
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  expect(await state(page)).toMatchObject({ phase: 'execute', run: { used: 0, budget: 12 } });

  await play(page, 'RRDDRRUU', !!isMobile);

  await expect(page.getByRole('dialog', { name: 'Result' })).toContainText('You made it out');
  expect(await state(page)).toMatchObject({ status: 'won', run: { used: 8 } });

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('dialog', { name: 'Result' })).toBeHidden();
  expect((await state(page)).run.used).toBe(0);
  expect(errors).toEqual([]);
});

test('world 2: scout (with a wrong experiment), start the run, then win it', async ({ page, isMobile }) => {
  const errors = noErrors(page);
  await page.goto('/?screen=arena&level=2&unlock=all');
  await expect(page.getByTestId('phase')).toHaveText('Scout');
  await page.getByRole('button', { name: 'Start scouting' }).click();

  // scout: test the teal decoy first (a mistake), then the orange switch
  await play(page, 'RRDD I U I', !!isMobile);
  let s = await state(page);
  expect(s).toMatchObject({ phase: 'explore', scout: { used: 7 }, run: { used: 0 } });
  expect(s.entities.find((e) => e.id === 'door-garden')?.state).toBe('open');

  if (isMobile) await play(page, 'C', true);
  else await page.getByTestId('start-run').click();
  await expect(page.getByTestId('phase')).toHaveText('Run');
  s = await state(page);
  expect(s).toMatchObject({ phase: 'execute', scout: { used: 7 }, run: { used: 0, budget: 12 }, player: { x: 1, y: 1 } });
  expect(s.entities.find((e) => e.id === 'door-garden')?.state).toBe('closed'); // world reset, knowledge kept

  await play(page, 'RRD I RRURR', !!isMobile);
  await expect(page.getByRole('dialog', { name: 'Result' })).toContainText('9');
  expect(await state(page)).toMatchObject({ status: 'won', run: { used: 9 }, scout: { used: 7 } });
  await expect(page.getByRole('button', { name: 'Next world' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('world 3: drag a block back off the plate (recoverable), then win', async ({ page, isMobile }) => {
  await page.goto('/?screen=arena&briefing=0&level=w03-locked-garden&unlock=all');
  await play(page, 'DRR', !!isMobile); // block onto the plate
  expect((await state(page)).entities.find((e) => e.id === 'plate-garden')?.state).toBe('pressed');
  await play(page, 'I', !!isMobile); // drag it back
  let s = await state(page);
  expect(s.entities.find((e) => e.id === 'plate-garden')?.state).toBe('idle');
  expect(s.entities.find((e) => e.id === 'block-purple')?.pos).toEqual({ x: 3, y: 2 });
  expect(s.scout.used).toBe(4);
  await play(page, 'X', !!isMobile); // free reset in scouting
  s = await state(page);
  expect(s.scout.used).toBe(4);
  expect(s.entities.find((e) => e.id === 'block-purple')?.pos).toEqual({ x: 2, y: 2 });
});

test('world 5: the world visibly changes, and only then can it be won', async ({ page, isMobile }) => {
  await page.goto('/?screen=arena&briefing=0&level=w05-garden-shifts&unlock=all');
  // phase-0 strategy in the scout: open the gate, toggle switch-two next to the far door: nothing happens
  await play(page, 'R I RRRRD I', !!isMobile);
  let s = await state(page);
  expect(s.entities.find((e) => e.id === 'door-far')?.state).toBe('closed');
  expect(s.epoch).toBe(0);
  await play(page, 'L', !!isMobile); // step on the rune at (5,2)
  s = await state(page);
  expect(s.epoch).toBe(1);
  expect(s.entities.find((e) => e.id === 'door-far')?.state).toBe('open'); // switch-two was already on
  await play(page, 'RURR', !!isMobile);
  s = await state(page);
  // standing on the exit while scouting does NOT start the run: the player commits explicitly
  expect(s).toMatchObject({ phase: 'explore', status: 'playing', player: { x: 8, y: 1 } });
  await expect(page.locator('.toast')).toContainText('found the exit');
  await play(page, 'C', !!isMobile);
  s = await state(page);
  expect(s).toMatchObject({ phase: 'execute', run: { used: 0 }, player: { x: 1, y: 1 } });
});

test('holding a key does not burn budget', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'keyboard only');
  await page.goto('/?screen=arena&briefing=0&unlock=all');
  await ready(page);
  for (let i = 0; i < 6; i++) await page.keyboard.down('ArrowRight');
  await page.keyboard.up('ArrowRight');
  expect((await state(page)).run.used).toBe(1);
});

test('layout has no horizontal scroll and the board is large enough on every world', async ({ page }) => {
  for (const level of CAMPAIGN_ORDER) {
    await page.goto(`/?screen=arena&briefing=0&level=${level}&unlock=all`);
    await expect(page.locator('canvas')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const box = await page.locator('canvas').boundingBox();
    expect(box && box.width > 200 && box.height > 150).toBe(true);
    await ready(page);
    const tile = await page.evaluate(() => {
      const h = (window as unknown as { __HVA__: { tileCenter(x: number, y: number): { x: number; y: number } | null } }).__HVA__;
      const a = h.tileCenter(0, 0)!;
      const b = h.tileCenter(1, 0)!;
      return b.x - a.x;
    });
    expect(tile, `${level}: tile size in CSS px`).toBeGreaterThanOrEqual(36); // phone-sized boards must stay tappable
  }
});

test('touch targets on the pad are at least 44x44 CSS px', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch only');
  await page.goto('/?screen=arena&briefing=0&level=2&unlock=all');
  for (const name of ['Move up', 'Move down', 'Move left', 'Move right', 'Interact: toggle a switch or drag a block', 'Reset the world', 'Start the run']) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.width, name).toBeGreaterThanOrEqual(44);
    expect(box!.height, name).toBeGreaterThanOrEqual(44);
  }
});
