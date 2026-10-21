import { test } from '@playwright/test';
import { play, ready } from './helpers';

// Gameplay recordings (webm) into docs/design/recordings. Run with `npm run recordings`.
test('recorded playthrough', async ({ page }, info) => {
  const touch = info.project.name === 'rec-mobile';
  const pace = 260;
  const wait = (ms: number) => page.waitForTimeout(ms);

  await page.goto('/');
  await wait(900);
  await page.getByRole('button', { name: 'Play' }).click();
  await wait(900);
  await page.getByRole('button', { name: 'Begin' }).click();
  await ready(page);
  await play(page, 'RRDDRRUU', touch, pace); // world 1: win
  await wait(1500);
  await page.getByRole('button', { name: 'Next world' }).click();
  await wait(800);
  await page.getByRole('button', { name: 'Start scouting' }).click();
  await wait(700);
  await play(page, 'RRDD I', touch, pace); // world 2: scout, poke the decoy
  await wait(700);
  await play(page, 'U I', touch, pace); // the real switch: door opens
  await wait(900);
  if (touch) await play(page, 'C', true);
  else await page.getByTestId('start-run').click(); // the world resets
  await wait(1600);
  await play(page, 'RRD I RRURR', touch, pace); // the run
  await wait(1600);
  await page.getByRole('button', { name: 'Next world' }).click();
  await wait(800);
  await page.getByRole('button', { name: 'Start scouting' }).click();
  await wait(600);
  await play(page, 'DRR', touch, pace); // world 3: push block onto plate
  await wait(700);
  await play(page, 'I', touch, pace); // drag it back off
  await wait(700);
  await play(page, 'RDD', touch, pace); // bonk into the wall
  await wait(900);
  await play(page, 'X', touch, pace); // free reset
  await wait(1200);
});
