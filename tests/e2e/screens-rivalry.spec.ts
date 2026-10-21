import { test } from '@playwright/test';
import { play, ready } from './helpers';

// Rivalry screen captures with REFERENCE-PLAYER fixtures (labelled "not an AI"). Run with `npm run screenshots`.
const out = 'docs/design/screenshots';
const W1 = '/?screen=arena&level=1&briefing=0&fixtures=1';

test('rivalry screens', async ({ page }, info) => {
  const tag = info.project.name;
  const touch = tag === 'mobile';
  const shot = async (name: string, wait = 1800) => {
    await page.waitForTimeout(wait); // let the staged reveal animation finish
    await page.screenshot({ path: `${out}/${tag}-s1-${name}.png` });
  };
  await page.goto(W1);
  await ready(page);
  await play(page, 'RRD', touch);
  await shot('10-ai-card-waiting', 300);
  await play(page, 'DRRUU', touch);
  await shot('11-reveal-human-ahead');
  await page.getByTestId('watch-ai').click();
  await page.waitForTimeout(600);
  await page.getByTestId('replay-play').click();
  await shot('12-replay-mid', 2100);
  await page.getByTestId('replay-play').click();
  await page.getByTestId('replay-close').click();

  await page.goto(W1);
  await ready(page);
  await play(page, 'U' + 'RRDDRRUU', touch);
  await shot('13-reveal-tie');

  await page.goto(W1);
  await ready(page);
  await play(page, 'UU' + 'RRDDRRUU', touch);
  await shot('14-reveal-ai-ahead');

  await page.goto('/?screen=arena&level=1&briefing=0');
  await ready(page);
  await play(page, 'RRDDRRUU', touch);
  await shot('15-reveal-no-ai-yet');
});
