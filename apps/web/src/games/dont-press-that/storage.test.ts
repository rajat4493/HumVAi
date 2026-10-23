import { describe, expect, it } from 'vitest';
import { emptyDpt, parseDpt, resultsText, unlockedUpTo } from './storage';

const ids = ['a', 'b', 'c', 'd', 'e'];
const names = ['One', 'Two', 'Three', 'Four', 'Five'];

describe('the game\'s own save', () => {
  it('starts empty on anything it does not understand, and never throws', () => {
    for (const raw of [null, '', 'not json', '{"v":2}', '{"v":1}', '[]', '{"v":1,"levels":null}']) expect(parseDpt(raw)).toEqual(emptyDpt());
  });

  it('keeps valid numbers and settings, and drops junk', () => {
    const s = parseDpt(
      JSON.stringify({
        v: 1,
        settings: { tone: 'chaos', muted: true, shake: false },
        levels: { a: { attempts: 5, deaths: 3, cleared: true, bestTicks: 200, fewestDeaths: 2, hintsUsed: 1 }, b: { attempts: -4, deaths: 'x', cleared: 'yes' } },
        predictions: { correct: 4, wrong: 9 },
        finished: true,
        feedback: [{ level: 1, fair: 'fair', fun: 'fun' }, { level: 2, fair: 'perfect', fun: 'fun' }, 'text'],
      }),
    );
    expect(s.settings).toEqual({ tone: 'chaos', muted: true, shake: false });
    expect(s.levels.a).toMatchObject({ attempts: 5, deaths: 3, cleared: true, bestTicks: 200, fewestDeaths: 2, hintsUsed: 1 });
    expect(s.levels.b).toMatchObject({ attempts: 0, deaths: 0, cleared: false });
    expect(s.predictions).toEqual({ correct: 4, wrong: 9 });
    expect(s.finished).toBe(true);
    expect(s.feedback).toEqual([{ level: 1, fair: 'fair', fun: 'fun' }]);
  });

  it('unknown personalities fall back to Playful', () => {
    expect(parseDpt(JSON.stringify({ v: 1, settings: { tone: 'savage' }, levels: {} })).settings.tone).toBe('playful');
  });

  it('opens levels in order: the next one after the last cleared or skipped', () => {
    const s = emptyDpt();
    expect(unlockedUpTo(s, ids)).toBe(1);
    s.levels.a = { attempts: 1, deaths: 0, cleared: true, skipped: false, bestTicks: 1, fewestDeaths: 0, hintsUsed: 0 };
    expect(unlockedUpTo(s, ids)).toBe(2);
    s.levels.b = { attempts: 9, deaths: 9, cleared: false, skipped: true, bestTicks: null, fewestDeaths: null, hintsUsed: 2 };
    expect(unlockedUpTo(s, ids)).toBe(3);
    s.levels.d = { attempts: 1, deaths: 0, cleared: true, skipped: false, bestTicks: 1, fewestDeaths: 0, hintsUsed: 0 };
    expect(unlockedUpTo(s, ids)).toBe(3); // c is not done, so d does not open e
  });
});

describe('the summary a tester can paste', () => {
  it('has numbers and settings only, and says what the host was set to', () => {
    const s = emptyDpt();
    s.settings.muted = true;
    s.levels.a = { attempts: 8, deaths: 7, cleared: true, skipped: false, bestTicks: 100, fewestDeaths: 7, hintsUsed: 1 };
    s.feedback = [{ level: 1, fair: 'unfair', fun: 'fun' }];
    s.predictions = { correct: 3, wrong: 5 };
    const t = resultsText(s, ids, names);
    expect(t).toContain('host: muted');
    expect(t).toContain('L1 One: cleared, 8 attempts, 7 deaths, 1 hints');
    expect(t).toContain('L2 Two: not played');
    expect(t).toContain('unfair 1');
    expect(t).toContain('host predictions: 3 came true, 5 did not');
    expect(t).toContain('finished: no');
    expect(t).not.toMatch(/@|http/); // no addresses, no links
  });
});
