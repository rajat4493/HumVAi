import { test } from '@playwright/test';

// Generates review screenshots into docs/design/screenshots. Run with `npm run screenshots`.
const out = 'docs/design/screenshots';

test('capture level 1', async ({ page }, info) => {
  const tag = info.project.name;
  await page.goto('/');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${tag}-01-welcome.png` });
  await page.goto('/?screen=arena');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${tag}-02-briefing.png` });
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${tag}-03-arena.png` });
});

test('capture all five levels (dev switch)', async ({ page }, info) => {
  if (info.project.name !== 'desktop') test.skip();
  for (let n = 1; n <= 5; n++) {
    await page.goto(`/?screen=arena&briefing=0&level=${n}`);
    await page.waitForSelector('canvas');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/levels-0${n}.png` });
  }
});
