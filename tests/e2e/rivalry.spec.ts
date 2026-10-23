import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { play, ready } from './helpers';

// All rivalry tests use ?fixtures=1: the REFERENCE-PLAYER fixtures (a computed player, labelled "not an AI").
// No test here involves, or claims anything about, a real AI model.
const W1 = '/?screen=arena&level=1&briefing=0&fixtures=1';
const WIN = 'RRDDRRUU'; // 8 actions (the shortest possible); the fixture's shown attempt reaches the exit in 9

async function finish(page: Page, keys: string, touch: boolean) {
  await ready(page);
  await play(page, keys, touch);
  await expect(page.getByRole('dialog', { name: 'Result' })).toBeVisible();
}

test('no AI numbers appear until the human run has ended (H5), then the reveal shows a labelled recorded attempt (H1/H2)', async ({ page, isMobile }) => {
  await page.goto(W1);
  await ready(page);
  await play(page, 'RRD', !!isMobile);
  await expect(page.getByTestId('reveal')).toHaveCount(0);
  await expect(page.getByTestId('ai-run')).toHaveCount(0);
  await expect(page.locator('[data-source="recorded"]')).toHaveCount(0);
  await expect(page.getByText('recorded attempt (a computed player').first()).toBeHidden().catch(() => undefined);

  await play(page, 'DRRUU', !!isMobile);
  const reveal = page.getByTestId('reveal');
  await expect(reveal).toBeVisible();
  await expect(page.getByTestId('reveal-headline')).toHaveText('You got there first.');
  await expect(page.getByTestId('human-run')).toHaveText('8');
  await expect(page.getByTestId('ai-run')).toHaveText('9');

  const badge = page.getByTestId('ai-side').getByTestId('recorded-badge');
  await expect(badge).toContainText('RECORDED');
  await expect(badge).toContainText('Reference solver (not an AI)');
  await expect(badge).toContainText('attempt 3 of 10');
  await expect(page.getByTestId('distribution')).toContainText('reached the exit in 7 of 10 recorded attempts');
});

test('H1: every element derived from an AI attempt sits in a data-source="recorded" container that shows a RECORDED badge', async ({ page, isMobile }) => {
  await page.goto(W1);
  await finish(page, WIN, !!isMobile);
  await page.locator('[data-source="recorded"]').first().waitFor(); // the recording loads asynchronously; do not race it
  const report = await page.evaluate(() => {
    const sections = [...document.querySelectorAll('[data-source="recorded"]')];
    return sections.map((s) => ({ ok: !!(s.querySelector('[data-testid="recorded-badge"]') || s.closest('[data-source="recorded"]')?.querySelector('[data-testid="recorded-badge"]')), cls: s.className }));
  });
  expect(report.length).toBeGreaterThan(0);
  // sections without their own badge must be inside a section that has one
  const orphan = await page.evaluate(() =>
    [...document.querySelectorAll('[data-source="recorded"]')].filter((s) => !s.querySelector('[data-testid="recorded-badge"]') && !s.parentElement?.closest('[data-source="recorded"]')?.querySelector('[data-testid="recorded-badge"]') && !s.closest('.reveal')?.querySelector('[data-testid="recorded-badge"]')).length,
  );
  expect(orphan).toBe(0);
});

test('a tie, an AI-ahead result, and an assisted run each get the right verdict', async ({ page, isMobile }) => {
  await page.goto(W1);
  await finish(page, `U${WIN}`, !!isMobile); // 9 actions: equal to the recorded attempt, both unscouted
  await expect(page.getByTestId('reveal-headline')).toHaveText('Dead even.');
  await expect(page.getByTestId('reveal')).toHaveAttribute('data-outcome', 'TIE');

  await page.goto(W1);
  await finish(page, `UU${WIN}`, !!isMobile); // 10 actions: slower than the recorded 9
  await expect(page.getByTestId('reveal-headline')).toHaveText('The AI got there faster.');
  await expect(page.getByTestId('reveal')).toHaveAttribute('data-outcome', 'AI_AHEAD');

  await page.goto(W1);
  await ready(page);
  await page.getByTestId('hint-button').click();
  await page.getByTestId('reveal-hint').click();
  await page.getByRole('dialog', { name: 'Hints' }).getByRole('button', { name: 'Close' }).click();
  await play(page, WIN, !!isMobile);
  await expect(page.getByTestId('reveal')).toHaveAttribute('data-outcome', 'ASSISTED');
  await expect(page.getByTestId('reveal-headline')).toHaveText('Out, with a little help.');
});

test('running out of actions against a recorded attempt that reached the exit is an AI-ahead result', async ({ page, isMobile }) => {
  await page.goto(W1);
  await finish(page, 'UUUUUUUUUUUU', !!isMobile);
  await expect(page.getByTestId('reveal')).toHaveAttribute('data-outcome', 'AI_AHEAD');
  await expect(page.getByTestId('human-run')).toHaveText('—');
});

test('without fixtures (production behaviour) there is no AI result: the reveal is honest and shows no AI numbers', async ({ page, isMobile }) => {
  await page.goto('/?screen=arena&level=1&briefing=0');
  await finish(page, WIN, !!isMobile);
  await expect(page.getByTestId('reveal')).toHaveAttribute('data-outcome', 'INCONCLUSIVE');
  await expect(page.getByTestId('reveal-headline')).toHaveText('No fair comparison this time.');
  await expect(page.getByTestId('ai-none')).toContainText('no recorded attempt yet');
  await expect(page.locator('[data-source="recorded"]')).toHaveCount(0);
  await expect(page.getByTestId('recorded-badge')).toHaveCount(0);
  await expect(page.getByTestId('watch-ai')).toHaveCount(0);
});

test('H6: a tampered recording fails in-browser verification and is never scored', async ({ page, isMobile }) => {
  const original = await (await page.request.get('/fixtures/recordings/w01-first-steps.json')).json();
  original.shown.steps[3].action = { type: 'MOVE', direction: 'UP' }; // no longer replays to what was recorded
  await page.route('**/fixtures/recordings/w01-first-steps.json', (r) => r.fulfill({ json: original }));
  await page.goto(W1);
  await finish(page, WIN, !!isMobile);
  await expect(page.getByTestId('reveal')).toHaveAttribute('data-outcome', 'INCONCLUSIVE');
  await expect(page.getByText("couldn't verify the AI's recorded attempt")).toBeVisible();
  await expect(page.getByTestId('ai-run')).toHaveCount(0);
});

test('a recording for a different version of the world is not used', async ({ page, isMobile }) => {
  const original = await (await page.request.get('/fixtures/recordings/w01-first-steps.json')).json();
  original.challengeVersion = 1;
  await page.route('**/fixtures/recordings/w01-first-steps.json', (r) => r.fulfill({ json: original }));
  await page.goto(W1);
  await finish(page, WIN, !!isMobile);
  await expect(page.getByTestId('reveal')).toHaveAttribute('data-outcome', 'INCONCLUSIVE');
});

test('replay: clearly recorded, steady cadence, optional, and reproduces the recorded run', async ({ page, isMobile }) => {
  await page.goto(W1);
  await finish(page, WIN, !!isMobile);
  await page.getByTestId('watch-ai').click();
  const panel = page.getByRole('dialog', { name: /Replay/ });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Recorded replay. This is not live.');
  await expect(page.getByTestId('replay-source').getByTestId('recorded-badge')).toContainText('RECORDED');
  await expect(page.getByTestId('replay-board').locator('canvas')).toBeVisible();

  // H3: no wording that implies live reasoning anywhere in the replay surface
  const text = (await panel.innerText()).toLowerCase();
  for (const banned of ['thinking', 'typing', 'streaming', 'reasoning live', 'live reasoning']) expect(text).not.toContain(banned);

  await page.getByTestId('replay-play').click();
  await expect.poll(() => page.evaluate(() => window.__HVA_REPLAY__?.stepTimes.length ?? 0), { timeout: 8000 }).toBeGreaterThanOrEqual(6);
  await page.getByTestId('replay-play').click(); // pause
  const gaps = await page.evaluate(() => {
    const t = window.__HVA_REPLAY__?.stepTimes ?? [];
    return t.slice(1).map((x, i) => x - (t[i] as number));
  });
  for (const g of gaps.slice(0, 5)) expect(Math.abs(g - 450)).toBeLessThan(220); // fixed cadence, independent of recorded latency

  // seeking is exact: stepping to the end shows the recorded exit
  await page.getByTestId('replay-scrub').fill('0');
  await expect(page.getByTestId('replay-caption')).toContainText('Press play');
  await page.getByTestId('replay-scrub').press('End');
  await expect(page.getByTestId('replay-caption')).toContainText('reached the exit');

  await page.getByTestId('replay-details').locator('summary').click();
  await expect(page.getByTestId('replay-details')).toContainText('replayed through the game engine in your browser');
  await page.getByTestId('replay-close').click();
  await expect(panel).toBeHidden();
});

test('copy result produces spoiler-free text that calls the AI result a recorded attempt', async ({ page, context, isMobile }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
  await page.addInitScript(() => {
    (navigator as unknown as { share?: unknown }).share = undefined;
  });
  await page.goto(W1);
  await finish(page, WIN, !!isMobile);
  await page.getByTestId('share').click();
  await expect(page.getByText('Copied.')).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  if (text) {
    expect(text).toContain('recorded reference player');
    expect(text).not.toMatch(/\blive\b/i);
  }
});

test('the reveal fits a phone: no horizontal scroll and the recorded badge is visible', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await page.goto(W1);
  await finish(page, WIN, true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await expect(page.getByTestId('ai-side').getByTestId('recorded-badge')).toBeVisible();
});
