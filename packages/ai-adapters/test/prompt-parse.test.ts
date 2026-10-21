import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LEVELS, create, legalActions, observe, step } from '@hva/game-core';
import { SYSTEM_PROMPT, buildMessages, buildTurnMessage, parseReply } from '../src';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe('prompt', () => {
  it('system prompt is frozen: any edit changes this hash and must bump the prompt version', () => {
    expect(sha(SYSTEM_PROMPT)).toBe('e5d5c96926d29a12f10ca434e62dc0faa11915bcb271a6679398d68b4ac23461');
  });

  it('turn messages contain only public information, for every level at the start and after a move', () => {
    const forbidden = ['"rules"', 'switchEnabled', '"shift"', '"doors"', 'optimal', 'solver', 'dead state', 'epoch rule'];
    for (const l of LEVELS) {
      const s = create(l, 'p');
      const first = buildTurnMessage({ briefing: l.briefing, observation: observe(s), lastEvents: null, legalActions: legalActions(s), rejection: null });
      const r = step(s, { type: 'MOVE', direction: 'RIGHT' });
      const second = buildTurnMessage({ briefing: l.briefing, observation: r.state, lastEvents: r.events, legalActions: legalActions(s), rejection: null });
      for (const msg of [first, second, SYSTEM_PROMPT]) for (const f of forbidden) expect(msg.toLowerCase(), `${l.id}: ${f}`).not.toContain(f.toLowerCase());
      expect(first).toContain(l.briefing);
      expect(first).toContain('LEGAL ACTIONS');
    }
  });

  it('shows the same briefing text a human reads and the shared budgets', () => {
    const l = LEVELS[1]!;
    const msg = buildTurnMessage({ briefing: l.briefing, observation: observe(create(l, 'p')), lastEvents: null, legalActions: [], rejection: null });
    expect(msg).toContain('SCOUT: 0/16');
    expect(msg).toContain('Run budget when it starts: 12');
  });

  it('keeps full untruncated history in order', () => {
    const msgs = buildMessages([{ user: 'u1', assistant: 'a1' }, { user: 'u2', assistant: 'a2' }, { user: 'u3' }]);
    expect(msgs.map((m) => `${m.role}:${m.content}`)).toEqual(['user:u1', 'assistant:a1', 'user:u2', 'assistant:a2', 'user:u3']);
  });

  it('rejections are reported to the model without the correct answer', () => {
    const l = LEVELS[0]!;
    const msg = buildTurnMessage({ briefing: l.briefing, observation: observe(create(l, 'p')), lastEvents: null, legalActions: [], rejection: 'reply must be a single JSON object' });
    expect(msg).toContain('REJECTED: reply must be a single JSON object');
  });
});

describe('parseReply', () => {
  it('accepts every action form, with and without a note', () => {
    expect(parseReply('{"action":{"type":"MOVE","direction":"UP"}}')).toEqual({ ok: true, action: { type: 'MOVE', direction: 'UP' }, note: null });
    expect(parseReply('{"action":{"type":"INTERACT","targetId":"door-1"},"note":"toggle"}')).toEqual({ ok: true, action: { type: 'INTERACT', targetId: 'door-1' }, note: 'toggle' });
    expect(parseReply('{"action":{"type":"RESET"}}')).toMatchObject({ ok: true, action: { type: 'RESET' } });
    expect(parseReply('{"action":{"type":"COMMIT"}}')).toMatchObject({ ok: true, action: { type: 'COMMIT' } });
  });

  it('tolerates a code fence and whitespace only', () => {
    expect(parseReply('```json\n{"action":{"type":"RESET"}}\n```')).toMatchObject({ ok: true });
    expect(parseReply('  \n{"action":{"type":"RESET"}}  ')).toMatchObject({ ok: true });
  });

  it('rejects, never repairs, anything else', () => {
    const bad = [
      '', 'RIGHT', 'I will move right. {"action":{"type":"MOVE","direction":"RIGHT"}}', '{"action":{"type":"MOVE","direction":"right"}}',
      '{"action":{"type":"MOVE"}}', '{"action":{"type":"MOVE","direction":"UP","extra":1}}', '{"action":{"type":"INTERACT"}}',
      '{"action":{"type":"INTERACT","targetId":""}}', '{"action":{"type":"RESET","x":1}}', '{"action":{"type":"JUMP"}}', '{"move":"UP"}',
      '{"action":"UP"}', '{"action":{"type":"RESET"},"extra":1}', '{"action":{"type":"RESET"},"note":5}', '[{"action":{"type":"RESET"}}]', '{not json}',
    ];
    for (const b of bad) expect(parseReply(b), JSON.stringify(b)).toMatchObject({ ok: false });
  });

  it('truncates long notes to 200 characters', () => {
    const r = parseReply(JSON.stringify({ action: { type: 'RESET' }, note: 'x'.repeat(500) }));
    expect(r.ok && r.note?.length).toBe(200);
  });
});
