import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GameAction, GameEvent } from '@hva/game-core';
import { captionFor, tickKind } from '../game/caption';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** Source-level guard for honesty rules H3/H4/H8: recorded AI attempts are never dressed up as live reasoning. */
describe('recorded-AI presentation never implies live reasoning (H3)', () => {
  const files = ['replay/ReplayPanel.tsx', 'screens/Reveal.tsx', 'components/Recorded.tsx', 'game/caption.ts', 'lib/share.ts', 'opponent/load.ts'];
  const banned: [string, RegExp][] = [
    ['thinking', /\bthinking\b/i],
    ['typing indicator', /\btyping\b/i],
    ['streaming', /\bstreaming\b/i],
    ['live (outside "not live")', /(?<!not )\blive\b/i],
    ['spinner', /spinner/i],
    ['typewriter', /typewriter/i],
  ];
  for (const f of files) {
    it(`${f} contains none of the banned wording`, () => {
      const text = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/aria-live/g, 'aria-polite-region').replace(/\blet live\b|\blive = |&& live\b|if \(live\b|live &&|\blive\)/g, '');
      for (const [name, re] of banned) expect(re.test(text), `${f}: ${name}`).toBe(false);
    });
  }

  it('the replay states plainly that it is recorded and not live, and labels self-reported notes (H4)', () => {
    const t = read('replay/ReplayPanel.tsx');
    expect(t).toContain('Recorded replay. This is not live.');
    expect(t).toContain('Self-reported note');
    expect(t).toContain('It may not reflect how it actually decided.');
    expect(t).toContain('STEP_MS = 450');
  });

  it('every AI-derived component is wrapped by RecordedSection or the RecordedBadge (H1/H2)', () => {
    const reveal = read('screens/Reveal.tsx');
    expect(reveal).toMatch(/<RecordedSection[\s\S]*?testId="ai-side"/);
    expect(reveal).toMatch(/<RecordedSection[\s\S]*?<Distribution/);
    const badge = read('components/Recorded.tsx');
    for (const needle of ['RECORDED', 'model.displayName', 'recordedDate', 'shownAttempt', 'attempts.length']) expect(badge).toContain(needle);
  });

  it('reference players are always labelled and the production loader only accepts real model recordings (H8)', () => {
    const load = read('opponent/load.ts');
    expect(load).toContain("opts.fixtures ? rec.kind !== 'reference' : rec.kind !== 'model'");
    expect(read('components/Recorded.tsx')).toContain('not an AI model');
  });
});

describe('captions are generated from engine events, in plain words', () => {
  const ev = (...e: GameEvent[]) => e;
  const mv = (d: 'UP' | 'RIGHT'): GameAction => ({ type: 'MOVE', direction: d });
  it('describes moves, bumps, pushes, switches, no-effect, commits and world changes', () => {
    expect(captionFor({ action: mv('RIGHT'), valid: true, events: ev({ type: 'MOVED', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }) })).toBe('Moved right.');
    expect(captionFor({ action: mv('UP'), valid: true, events: ev({ type: 'BLOCKED', at: { x: 0, y: 0 }, reason: 'wall' }) })).toBe('Tried to move up but was blocked.');
    expect(captionFor({ action: mv('RIGHT'), valid: true, events: ev({ type: 'PUSHED', id: 'b', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } }, { type: 'PLATE_PRESSED', id: 'p' }, { type: 'DOOR_OPENED', id: 'd' }) })).toBe('Moved right and pushed the block; a door opened; a plate was pressed.');
    expect(captionFor({ action: { type: 'INTERACT', targetId: 'switch-teal' }, valid: true, events: ev({ type: 'SWITCH_TOGGLED', id: 'switch-teal', on: true }) })).toBe('Switched the switch teal on.');
    expect(captionFor({ action: { type: 'INTERACT', targetId: 'switch-triangle' }, valid: true, events: ev({ type: 'NO_EFFECT', targetId: 'switch-triangle' }) })).toBe('Tried the switch triangle: nothing happened.');
    expect(captionFor({ action: { type: 'COMMIT' }, valid: true, events: ev({ type: 'COMMITTED', reason: 'player' }) })).toContain('the run begins');
    expect(captionFor({ action: mv('RIGHT'), valid: true, events: ev({ type: 'MOVED', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }, { type: 'EPOCH_CHANGED', epoch: 1 }) })).toContain('the world changed its rules');
    expect(captionFor({ action: mv('RIGHT'), valid: true, events: ev({ type: 'MOVED', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }, { type: 'WON' }) })).toContain('reached the exit');
  });

  it('is honest about unreadable and disallowed steps', () => {
    expect(captionFor({ action: null, valid: false, events: [] })).toContain('could not be read');
    expect(captionFor({ action: mv('UP'), valid: false, events: [] })).toContain('not allowed');
  });

  it('classifies timeline ticks', () => {
    expect(tickKind({ action: null, valid: false, events: [] })).toBe('rejected');
    expect(tickKind({ action: { type: 'COMMIT' }, valid: true, events: [] })).toBe('commit');
    expect(tickKind({ action: mv('UP'), valid: true, events: ev({ type: 'BLOCKED', at: { x: 0, y: 0 }, reason: 'wall' }) })).toBe('bump');
    expect(tickKind({ action: mv('RIGHT'), valid: true, events: ev({ type: 'EPOCH_CHANGED', epoch: 1 }) })).toBe('change');
  });
});
