import { describe, expect, it } from 'vitest';
import { LEVELS, create, observe, step } from '@hva/game-core';
import { describeBoard } from './describe';

describe('describeBoard', () => {
  it('describes where you are, the exit, floor, every entity and the budget', () => {
    const t = describeBoard(observe(create(LEVELS[1]!, 's'))).join(' ');
    expect(t).toContain('9 columns wide and 5 rows tall');
    expect(t).toContain('You are at column 2, row 2');
    expect(t).toContain('The exit is at column 8, row 2');
    expect(t).toContain('switch (orange) at column 3, row 3');
    expect(t).toContain('door (garden) at column 5, row 3');
    expect(t).toContain('You are scouting: 0 of 16');
  });

  it('updates with state: moves, switches, phase, world change', () => {
    const s = create(LEVELS[1]!, 's');
    step(s, { type: 'MOVE', direction: 'RIGHT' });
    step(s, { type: 'MOVE', direction: 'DOWN' });
    step(s, { type: 'INTERACT', targetId: 'switch-orange' });
    step(s, { type: 'COMMIT' });
    const t = describeBoard(observe(s)).join(' ');
    expect(t).toContain('You are in the run: 0 of 12');
    const scouting = create(LEVELS[1]!, 's');
    step(scouting, { type: 'MOVE', direction: 'RIGHT' });
    step(scouting, { type: 'MOVE', direction: 'DOWN' });
    step(scouting, { type: 'INTERACT', targetId: 'switch-orange' });
    expect(describeBoard(observe(scouting)).join(' ')).toContain('door (garden)');
    expect(describeBoard(observe(scouting)).join(' ')).toMatch(/door \(garden\) at column 5, row 3, .*open/);
  });

  it('never reveals hidden rules', () => {
    for (const l of LEVELS) {
      const t = describeBoard(observe(create(l, 's'))).join(' ').toLowerCase();
      for (const f of ['switchenabled', 'shift', 'optimal', 'jammed', 'decoy']) expect(t).not.toContain(f);
    }
  });
});
