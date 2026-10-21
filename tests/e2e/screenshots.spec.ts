import { test } from '@playwright/test';
import { play, ready } from './helpers';

// Review screenshots into docs/design/screenshots. Run with `npm run screenshots`.
const out = 'docs/design/screenshots';

test('experience walkthrough', async ({ page }, info) => {
  const tag = info.project.name;
  const touch = tag === 'mobile';
  const shot = async (name: string, wait = 450) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${out}/${tag}-${name}.png` });
  };

  await page.goto('/');
  await shot('01-welcome', 300);

  // World 1: run only
  await page.goto('/?screen=arena&level=1&unlock=all');
  await ready(page);
  await shot('02-w1-briefing');
  await page.getByRole('button', { name: 'Begin' }).click();
  await play(page, 'RRD', touch);
  await shot('03-w1-midway');

  // World 2: scouting with the decoy, door open, then the run
  await page.goto('/?screen=arena&level=2&unlock=all');
  await ready(page);
  await shot('04-w2-briefing-scout');
  await page.getByRole('button', { name: 'Start scouting' }).click();
  await play(page, 'RRDD I U I', touch);
  await shot('05-w2-scouting-door-open');
  if (touch) await play(page, 'C', true);
  else await page.getByTestId('start-run').click();
  await shot('06-w2-run-begins-world-reset', 700);

  // World 3: block on the plate, door open
  await page.goto('/?screen=arena&briefing=0&level=3&unlock=all');
  await ready(page);
  await play(page, 'DRR', touch);
  await shot('07-w3-block-on-plate');
  await play(page, 'RUR', touch);
  await shot('08-w3-walking-through-open-door');

  // World 4: the jammed switch
  await page.goto('/?screen=arena&briefing=0&level=4&unlock=all');
  await ready(page);
  await play(page, 'RRRRR I', touch);
  await shot('09-w4-jammed-switch', 250);

  // World 5: the world changes
  await page.goto('/?screen=arena&briefing=0&level=5&unlock=all');
  await ready(page);
  await play(page, 'R I RRRDR', touch, 30);
  await shot('10-w5-world-changed', 350);

  // Result
  await page.goto('/?screen=arena&briefing=0&level=1&unlock=all');
  await ready(page);
  await page.getByRole('button', { name: /^Begin$/ }).click({ timeout: 500 }).catch(() => undefined);
  await play(page, 'RRDDRRUU', touch);
  await shot('11-w1-result', 700);
});
