import { describe, expect, it } from 'vitest';
import { isPlayable } from './contract';
import { GAMES, gameById } from './registry';
import { hashFor, parseHash } from './router';

describe('the catalogue', () => {
  it('lists The Experiment, Pattern Hunter and The Detective, in that order, with the right status', () => {
    expect(GAMES.map((g) => [g.id, g.status])).toEqual([
      ['experiment', 'available'],
      ['pattern-hunter', 'experimental'],
      ['detective', 'coming-soon'],
    ]);
  });
  it('ids are unique and safe to use as URL segments', () => {
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(GAMES.length);
    for (const g of GAMES) expect(g.id).toMatch(/^[a-z][a-z0-9-]*$/);
  });
  it('a game is playable exactly when it can be loaded; coming-soon games can never be played', () => {
    for (const g of GAMES) {
      expect(isPlayable(g)).toBe(g.load !== undefined);
      if (g.status === 'coming-soon') expect(g.load).toBeUndefined();
    }
  });
  it('no game claims verified AI recordings unless it proves it elsewhere (none do yet)', () => {
    for (const g of GAMES) expect(g.capabilities?.verifiedAiRecordings ?? false).toBe(false);
  });
  it('gameById finds games and returns nothing for unknown or empty ids', () => {
    expect(gameById('experiment')?.name).toBe('The Experiment');
    expect(gameById('nope')).toBeUndefined();
    expect(gameById(null)).toBeUndefined();
  });
});

describe('routes', () => {
  it('parse and format round-trip, including a query', () => {
    expect(parseHash('')).toMatchObject({ game: null, rest: [] });
    expect(parseHash('#/')).toMatchObject({ game: null, rest: [] });
    const r = parseHash('#/experiment/play/w05-garden-shifts?from=home');
    expect(r).toMatchObject({ game: 'experiment', rest: ['play', 'w05-garden-shifts'] });
    expect(r.query.get('from')).toBe('home');
    expect(hashFor('experiment', ['play', 'w05-garden-shifts'], { from: 'home' })).toBe('#/experiment/play/w05-garden-shifts?from=home');
    expect(hashFor(null)).toBe('#/');
  });
  it('odd input never throws', () => {
    for (const h of ['#//', '#/%E0%A4%A', '#/a//b/', '#?x=1', 'garbage']) expect(() => parseHash(h)).not.toThrow();
  });
});
