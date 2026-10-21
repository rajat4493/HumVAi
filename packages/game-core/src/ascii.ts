import type { PublicGameState } from './types';

/**
 * Text rendering of an observation: the format an AI participant receives.
 * Symbols: # wall, . floor, @ you, E exit, B block, D/d door closed/open,
 * s/S switch off/on, P/p plate idle/pressed, W/w tripwire armed/spent.
 */
export function renderAscii(o: PublicGameState): string {
  const grid = o.tiles.map((row) => [...row]);
  const put = (x: number, y: number, ch: string) => {
    const r = grid[y];
    if (r) r[x] = ch;
  };
  put(o.exit.x, o.exit.y, 'E');
  for (const e of o.entities) {
    const sym: Record<string, [string, string]> = {
      door: ['D', 'd'],
      switch: ['s', 'S'],
      plate: ['P', 'p'],
      tripwire: ['W', 'w'],
    };
    if (e.kind === 'block') put(e.pos.x, e.pos.y, 'B');
    else {
      const pair = sym[e.kind] as [string, string];
      const active = e.state === 'open' || e.state === 'on' || e.state === 'pressed' || e.state === 'spent';
      put(e.pos.x, e.pos.y, active ? pair[1] : pair[0]);
    }
  }
  put(o.player.x, o.player.y, '@');
  const legend = o.entities.map((e) => `${e.id}=${e.kind}(${e.state})@${e.pos.x},${e.pos.y}`).join('\n');
  return [
    grid.map((r) => r.join('')).join('\n'),
    legend,
    `actions: ${o.actionsUsed}/${o.budget}  epoch: ${o.epoch}  status: ${o.status}`,
  ]
    .filter(Boolean)
    .join('\n');
}
