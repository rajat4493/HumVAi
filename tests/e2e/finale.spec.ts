import { expect, test } from '@playwright/test';
import { CAMPAIGN_ORDER, create, levelById, observe, solve, step } from '@hva/game-core';
import type { GameAction } from '@hva/game-core';
import { ready } from './helpers';

const PROGRESS = (ids: string[]) =>
  JSON.stringify({
    v: 1,
    levels: Object.fromEntries(ids.map((id) => [id, { completed: true, attempts: 2, wins: 1, bestRun: 12, bestUnassistedRun: 12, bestActions: null, firstWonAt: '2026-01-01T00:00:00Z', usedHints: false }])),
    achievements: {},
    settings: { sound: true, music: false, volume: 0.7, motion: 'reduced' },
  });

test('finishing the last world opens the ending, which reports only what exists', async ({ page, isMobile }) => {
  const last = CAMPAIGN_ORDER[CAMPAIGN_ORDER.length - 1] as string;
  const before = CAMPAIGN_ORDER.slice(0, -1);
  await page.addInitScript(([key, value]) => localStorage.setItem(key as string, value as string), ['hva.save.v1', PROGRESS(before)]);
  await page.goto(`/?screen=arena&level=${last}&briefing=0`);
  await ready(page);

  const level = levelById(last)!;
  const solution = solve(level).optimalSolution as GameAction[];
  const sim = create(level, 'e2e');
  if (isMobile) await page.getByRole('button', { name: 'Start the run', exact: true }).click();
  else await page.keyboard.press('c');
  for (const a of solution) {
    const o = observe(sim);
    if (a.type === 'MOVE') {
      if (isMobile) await page.getByRole('button', { name: { UP: 'Move up', DOWN: 'Move down', LEFT: 'Move left', RIGHT: 'Move right' }[a.direction], exact: true }).click();
      else await page.keyboard.press({ UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight' }[a.direction]);
    } else if (a.type === 'INTERACT') {
      const t = o.entities.find((e) => e.id === a.targetId)!;
      const side = t.pos.x > o.player.x ? 'ArrowRight' : t.pos.x < o.player.x ? 'ArrowLeft' : t.pos.y > o.player.y ? 'ArrowDown' : 'ArrowUp';
      await page.keyboard.press(`Shift+${side}`);
    }
    step(sim, a);
  }
  await page.getByTestId('finish-experiment').click();
  await expect(page.getByTestId('finale-title')).toBeVisible();
  await expect(page.getByTestId('finale-stats')).toContainText(`${CAMPAIGN_ORDER.length} / ${CAMPAIGN_ORDER.length}`);
  // no recordings are published, so the ending must not claim any AI result
  await expect(page.getByTestId('finale-ai')).toContainText('No recorded AI attempts');
  await page.getByTestId('finale-map').click();
  await expect(page.getByTestId('progress-summary')).toHaveText(`${CAMPAIGN_ORDER.length} of ${CAMPAIGN_ORDER.length} worlds finished`);
  await expect(page.getByTestId('see-ending')).toBeVisible();
});

test('the ending is not offered until every world is finished', async ({ page }) => {
  await page.addInitScript(([key, value]) => localStorage.setItem(key as string, value as string), ['hva.save.v1', PROGRESS(CAMPAIGN_ORDER.slice(0, 5))]);
  await page.goto('/?screen=map');
  await expect(page.getByTestId('see-ending')).toHaveCount(0);
});
