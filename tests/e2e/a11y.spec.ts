import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { play, ready } from './helpers';

/** Automated WCAG 2.1 A/AA scan (axe-core). It catches roughly a third of issues; it does not replace manual and screen-reader testing. */
async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes[0]?.html.slice(0, 120)}`), label).toEqual([]);
}

const FIX = '&fixtures=1&unlock=all';

test('every screen has no serious or critical automated accessibility violations', async ({ page, isMobile }) => {
  await page.goto('/');
  await scan(page, 'title');
  await page.getByTestId('play').click();
  await scan(page, 'world map');
  await page.getByTestId('settings-button').click();
  await scan(page, 'settings');
  await page.getByTestId('settings-back').click();
  await page.getByTestId('hall-button').click();
  await scan(page, 'hall');

  await page.goto(`/?screen=arena&level=2${FIX}`);
  await scan(page, 'briefing dialog');
  await page.getByTestId('begin').click();
  await ready(page);
  await scan(page, 'arena (scout)');
  await page.getByTestId('hint-button').click();
  await scan(page, 'hint dialog');
  await page.getByRole('dialog', { name: 'Hints' }).getByRole('button', { name: 'Close' }).click();
  await page.getByTestId('menu-button').click();
  await scan(page, 'menu dialog');
  await page.getByTestId('describe-board').click();
  await scan(page, 'board description');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await page.goto(`/?screen=arena&level=1&briefing=0${FIX}`);
  await ready(page);
  await play(page, 'RRDDRRUU', !!isMobile);
  await expect(page.getByTestId('reveal')).toBeVisible();
  await page.waitForTimeout(1800);
  await scan(page, 'result reveal');
  await page.getByTestId('watch-ai').click();
  await page.waitForTimeout(900); // let the panel finish fading in: Firefox flagged a mid-animation contrast reading
  await scan(page, 'replay');
});

test('screen readers get a caption of every action and a full text description of the board', async ({ page, isMobile }) => {
  await page.goto(`/?screen=arena&level=2&briefing=0${FIX}`);
  await ready(page);
  await play(page, 'R', !!isMobile);
  await expect(page.getByTestId('announcer')).toHaveText(/Moved right\. 15 actions left in the scout\./);
  await play(page, 'U', !!isMobile);
  await expect(page.getByTestId('announcer')).toContainText('blocked');
  await page.getByTestId('menu-button').click();
  await page.getByTestId('describe-board').click();
  const text = await page.getByTestId('board-description').innerText();
  expect(text).toContain('You are at column 3, row 2');
  expect(text).toContain('switch (orange)');
  expect(text).toContain('door (garden)');
  expect(text).toContain('scouting');
});

test('a keyboard alone can play, scout, commit, open the menu and a dialog without a mouse', async ({ page }) => {
  await page.goto('/?screen=arena&level=2&briefing=0&unlock=all');
  await ready(page);
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowDown']) await page.keyboard.press(k);
  await page.keyboard.press('Space'); // interact with the orange switch
  await page.keyboard.press('c'); // commit
  await expect(page.getByTestId('phase')).toHaveText('Run');
  await page.getByTestId('menu-button').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
});

test('the scanner itself can fail: a page with an unnamed button and an image without alt is flagged', async ({ page }) => {
  await page.setContent('<!doctype html><html lang="en"><title>t</title><main><button></button><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></main></html>');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const ids = results.violations.map((v) => v.id);
  expect(ids).toEqual(expect.arrayContaining(['button-name', 'image-alt']));
});

test('the ending, the completed map and a late world have no serious or critical violations', async ({ page }) => {
  const ids = ['w01-first-steps', 'w02-orange-switch', 'w06-both-needed', 'w07-off-is-on', 'w03-locked-garden', 'w04-only-when', 'w11-corner-piece', 'w09-hold-the-line', 'w10-in-order', 'w08-heavy-load', 'w12-against-the-wall', 'w13-combination', 'w05-garden-shifts', 'w14-reversal', 'w15-swapped-wires', 'w16-the-simple-way', 'w17-spring-loaded', 'w18-two-springs', 'w19-two-of-three', 'w20-the-last-experiment'];
  const save = {
    v: 1,
    levels: Object.fromEntries(ids.map((id) => [id, { completed: true, attempts: 1, wins: 1, bestRun: 9, bestUnassistedRun: 9, bestActions: null, firstWonAt: '2026-01-01T00:00:00Z', usedHints: false }])),
    achievements: {},
    settings: { sound: false, music: false, volume: 0.7, motion: 'system' },
  };
  await page.addInitScript((s) => localStorage.setItem('hva.save.v1', JSON.stringify(s)), save);
  await page.goto('/?screen=map');
  await scan(page, 'completed map');
  await page.getByTestId('see-ending').click();
  await expect(page.getByTestId('finale-title')).toBeVisible();
  await scan(page, 'finale');
  await page.goto('/?screen=arena&level=w20-the-last-experiment&briefing=0');
  await ready(page);
  await scan(page, 'world 20');
});

test('Space still plays after a dialog closes and focus returns to its header button', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'keyboard only');
  await page.goto('/?screen=arena&level=w02-orange-switch&briefing=0&unlock=all');
  await ready(page);
  await page.getByTestId('hint-button').click();
  await page.getByRole('dialog', { name: 'Hints' }).getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('hint-button')).toBeFocused();
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowDown']) await page.keyboard.press(k);
  await page.keyboard.press('Space'); // interact with the switch below, not re-open the hints
  await expect(page.getByRole('dialog', { name: 'Hints' })).toHaveCount(0);
  const toggled = await page.evaluate(() => (window as unknown as { __HVA__: { getState(): { entities: { kind: string; state: string }[] } } }).__HVA__.getState().entities.some((e) => e.kind === 'switch' && e.state === 'on'));
  expect(toggled).toBe(true);
  // Enter on the focused header button still opens its dialog
  await page.getByTestId('hint-button').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Hints' })).toBeVisible();
});

test('Pattern Hunter (prototype) has no serious or critical violations in any of its states', async ({ page }) => {
  await page.goto('/#/pattern-hunter');
  await scan(page, 'pattern hunter: exploring');
  await page.getByTestId('ph-n-7').click();
  await page.getByTestId('ph-ready').click();
  await scan(page, 'pattern hunter: predicting');
  for (const n of [7, 20, 15, 38, 9, 27]) await page.getByTestId(`ph-say-${n}-yes`).click();
  await page.getByTestId('ph-submit').click();
  await page.waitForTimeout(500);
  await scan(page, 'pattern hunter: result');
  // it is operable from the keyboard
  await page.getByTestId('ph-again').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('ph-probes-left')).toContainText('6 tests left');
});
