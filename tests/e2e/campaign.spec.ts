import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CAMPAIGN_ORDER, create, levelById, observe, solve, step } from '@hva/game-core';
import type { GameAction } from '@hva/game-core';
import { ready, state } from './helpers';

const ARROW = { UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight' } as const;
const PAD = { UP: 'Move up', DOWN: 'Move down', LEFT: 'Move left', RIGHT: 'Move right' } as const;

/** Plays one engine action the way a person would: arrows, Shift+arrow / a tap for a specific interact target. */
async function perform(page: Page, a: GameAction, touch: boolean, side: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | null, tile: { x: number; y: number } | null) {
  if (a.type === 'MOVE') {
    if (touch) await page.getByRole('button', { name: PAD[a.direction], exact: true }).click();
    else await page.keyboard.press(ARROW[a.direction]);
  } else if (a.type === 'INTERACT') {
    if (touch) {
      const c = await page.evaluate(([x, y]) => (window as unknown as { __HVA__: { tileCenter(x: number, y: number): { x: number; y: number } | null } }).__HVA__.tileCenter(x!, y!), [tile!.x, tile!.y]);
      await page.waitForTimeout(150); // people do not tap the pad and the board in the same millisecond
      await page.mouse.click(c!.x, c!.y, { delay: 80 });
    } else await page.keyboard.press(`Shift+${ARROW[side!]}`);
  } else if (a.type === 'COMMIT') {
    await page.keyboard.press('c');
  }
}

// Every shipped world is won in the real browser, through the real controls, along a solver-optimal route.
for (const id of CAMPAIGN_ORDER) {
  test(`world ${id} can be won from the keyboard and by touch, in exactly its optimal number of run actions`, async ({ page, isMobile }) => {
    const level = levelById(id)!;
    const solution = solve(level).optimalSolution as GameAction[];
    const plan: GameAction[] = [...(level.budget.explore > 0 ? [{ type: 'COMMIT' } as GameAction] : []), ...solution];
    await page.goto(`/?screen=arena&level=${id}&briefing=0&unlock=all`);
    await ready(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const sim = create(level, 'e2e');
    for (const a of plan) {
      const before = observe(sim);
      let side: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | null = null;
      let tile: { x: number; y: number } | null = null;
      if (a.type === 'INTERACT') {
        const t = before.entities.find((e) => e.id === a.targetId)!;
        tile = t.pos;
        side = t.pos.x > before.player.x ? 'RIGHT' : t.pos.x < before.player.x ? 'LEFT' : t.pos.y > before.player.y ? 'DOWN' : 'UP';
      }
      if (a.type === 'COMMIT' && isMobile) await page.getByRole('button', { name: 'Start the run', exact: true }).click();
      else await perform(page, a, !!isMobile, side, tile);
      step(sim, a);
    }
    const s = await state(page);
    expect(s.status).toBe('won');
    expect(s.run.used).toBe(solution.length);
    expect(errors).toEqual([]);
  });
}
