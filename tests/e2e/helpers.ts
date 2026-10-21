import type { Page } from '@playwright/test';

export interface Hva {
  getState(): {
    status: string;
    phase: 'explore' | 'execute';
    scout: { budget: number; used: number };
    run: { budget: number; used: number };
    player: { x: number; y: number };
    epoch: number;
    entities: { id: string; kind: string; state: string; pos: { x: number; y: number } }[];
  };
  log: unknown[];
}

export const ready = (page: Page) => page.waitForFunction(() => '__HVA__' in window);

export const state = (page: Page) => page.evaluate(() => (window as unknown as { __HVA__: Hva }).__HVA__.getState());

const KEY: Record<string, string> = { R: 'ArrowRight', L: 'ArrowLeft', U: 'ArrowUp', D: 'ArrowDown', I: 'Space', X: 'r', C: 'c' };
const BTN: Record<string, string> = {
  R: 'Move right',
  L: 'Move left',
  U: 'Move up',
  D: 'Move down',
  I: 'Interact: toggle a switch or drag a block',
  X: 'Reset the world',
  C: 'Start the run',
};

/** Plays a string like "RRD I RR" with the keyboard (desktop) or the on-screen pad (touch). Spaces are ignored. */
export async function play(page: Page, keys: string, touch: boolean, pauseMs = 0): Promise<void> {
  await ready(page);
  for (const k of keys.replace(/\s/g, '')) {
    if (touch) await page.getByRole('button', { name: BTN[k] as string, exact: true }).click();
    else await page.keyboard.press(KEY[k] as string);
    if (pauseMs) await page.waitForTimeout(pauseMs);
  }
}
