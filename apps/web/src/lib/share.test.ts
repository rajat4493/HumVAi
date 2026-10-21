import { describe, expect, it } from 'vitest';
import { shareText } from './share';

const base = { worldName: 'The Orange Switch', human: { won: true, runActions: 9, optimal: 9, assisted: false } };

describe('shareText', () => {
  it('describes any AI result as a recorded attempt, never live, and names the model', () => {
    const t = shareText({ ...base, ai: { label: 'claude-sonnet-5-5', kind: 'model', won: true, runActions: 11, attemptsWon: 8, attemptsTotal: 10 }, outcome: 'HUMAN_AHEAD' });
    expect(t).toContain("The AI's recorded attempt (claude-sonnet-5-5)");
    expect(t).toContain('I got there first.');
    expect(t.toLowerCase()).not.toMatch(/\blive\b|thinking|right now/);
  });

  it('labels a reference player as such', () => {
    const t = shareText({ ...base, ai: { label: 'Reference solver (not an AI)', kind: 'reference', won: true, runActions: 9, attemptsWon: 7, attemptsTotal: 10 }, outcome: 'TIE' });
    expect(t).toContain('recorded reference player');
    expect(t).toContain('Dead even.');
  });

  it('is honest when the AI failed, when there is no AI data, and when hints were used', () => {
    expect(shareText({ ...base, ai: { label: 'm', kind: 'model', won: false, runActions: 12, attemptsWon: 3, attemptsTotal: 10 }, outcome: 'HUMAN_AHEAD' })).toContain('did not reach the exit');
    const none = shareText({ ...base, ai: null, outcome: 'INCONCLUSIVE' });
    expect(none).not.toMatch(/AI's|recorded/);
    expect(none).toContain('No AI comparison this time.');
    expect(shareText({ ...base, human: { ...base.human, assisted: true }, ai: null, outcome: 'ASSISTED' })).toContain('with hints');
  });

  it('never leaks a solution (no action lists)', () => {
    expect(shareText({ ...base, ai: null, outcome: 'INCONCLUSIVE' })).not.toMatch(/UP|DOWN|LEFT|RIGHT|switch-/);
  });
});
