import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { play, ready } from './helpers';

interface AudioDebug {
  played: () => string[];
  state: () => string;
  unlocked: () => boolean;
}
const audio = (page: Page) =>
  page.evaluate(() => {
    const a = (window as unknown as { __HVA_AUDIO__: AudioDebug }).__HVA_AUDIO__;
    return { played: a.played(), state: a.state(), unlocked: a.unlocked() };
  });

test('audio stays silent until the first gesture, then plays the right cues for real actions', async ({ page, isMobile }) => {
  await page.goto('/?screen=arena&level=3&unlock=all&briefing=0');
  await ready(page);
  expect(await audio(page)).toMatchObject({ unlocked: false, played: [], state: 'none' });

  await play(page, 'D', !!isMobile); // first gesture: unlock, then the step is heard
  let a = await audio(page);
  expect(a.unlocked).toBe(true);
  expect(a.played).toEqual(['step']);
  expect(['running', 'suspended']).toContain(a.state);

  await play(page, 'RR', !!isMobile); // push the block onto the plate: push + plate + door
  a = await audio(page);
  expect(a.played).toContain('push');
  expect(a.played).toContain('plate_down');
  expect(a.played).toContain('door_open');
  await play(page, 'LLL', !!isMobile); // two steps back, then the wall
  expect((await audio(page)).played).toContain('bump');
});

test('sound off in settings means no effects are produced', async ({ page, isMobile }) => {
  await page.addInitScript(() => {
    localStorage.setItem('hva.save.v1', JSON.stringify({ v: 1, levels: {}, achievements: {}, settings: { sound: false, music: true, volume: 0.7, motion: 'system' } }));
  });
  await page.goto('/?screen=arena&level=1&briefing=0');
  await ready(page);
  await play(page, 'RRD', !!isMobile);
  const a = await audio(page);
  expect(a.unlocked).toBe(true);
  expect(a.played).toEqual([]);
});

test('toggling sound in Settings takes effect immediately', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('play').click();
  await page.getByTestId('settings-button').click();
  await page.getByTestId('sound-toggle').click(); // off
  const before = (await audio(page)).played.length; // earlier UI ticks were heard while sound was still on
  await page.getByTestId('settings-back').click();
  await page.getByTestId('node-w01-first-steps').click();
  await page.getByTestId('begin').click();
  await ready(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect((await audio(page)).played).toHaveLength(before);
});
