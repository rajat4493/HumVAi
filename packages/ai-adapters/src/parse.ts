import type { GameAction } from '@hva/game-core';

export type ParseResult = { ok: true; action: GameAction; note: string | null } | { ok: false; reason: string };

const DIRECTIONS = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
export const NOTE_MAX = 200;

/** Pulls the single JSON object out of a reply (tolerating a code fence or surrounding whitespace). */
function extractJson(raw: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const text = (fenced?.[1] ?? raw).trim();
  if (text.startsWith('{') && text.endsWith('}')) return text;
  return null;
}

/**
 * Strict validation of hva.reply.1. Anything else is a malformed reply (a rejected, free, counted action).
 * The parser never "repairs" a reply: it must already be correct.
 */
export function parseReply(raw: string): ParseResult {
  const json = extractJson(raw);
  if (json === null) return { ok: false, reason: 'reply must be a single JSON object' };
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'reply is not valid JSON' };
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return { ok: false, reason: 'reply must be a JSON object' };
  const { action, note, ...rest } = obj as Record<string, unknown>;
  if (Object.keys(rest).length > 0) return { ok: false, reason: `unexpected field "${Object.keys(rest)[0]}"` };
  if (typeof action !== 'object' || action === null || Array.isArray(action)) return { ok: false, reason: 'missing "action" object' };
  const a = action as Record<string, unknown>;
  const keys = Object.keys(a);
  let parsed: GameAction;
  switch (a.type) {
    case 'MOVE':
      if (keys.length !== 2 || typeof a.direction !== 'string' || !DIRECTIONS.includes(a.direction)) {
        return { ok: false, reason: 'MOVE needs direction UP, DOWN, LEFT or RIGHT' };
      }
      parsed = { type: 'MOVE', direction: a.direction as 'UP' };
      break;
    case 'INTERACT':
      if (keys.length !== 2 || typeof a.targetId !== 'string' || a.targetId.length === 0) return { ok: false, reason: 'INTERACT needs a targetId string' };
      parsed = { type: 'INTERACT', targetId: a.targetId };
      break;
    case 'RESET':
    case 'COMMIT':
      if (keys.length !== 1) return { ok: false, reason: `${a.type} takes no other fields` };
      parsed = { type: a.type };
      break;
    default:
      return { ok: false, reason: 'unknown action type' };
  }
  if (note !== undefined && typeof note !== 'string') return { ok: false, reason: '"note" must be a string' };
  const trimmed = typeof note === 'string' ? note.slice(0, NOTE_MAX) : null;
  return { ok: true, action: parsed, note: trimmed && trimmed.length > 0 ? trimmed : null };
}
