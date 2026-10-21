import type { ChallengeDefinition, Cond, EntityKind, Pos } from './types';

export interface ParsedWorld {
  width: number;
  height: number;
  walls: boolean[][];
  start: Pos;
  exit: Pos;
  /** Static entity placements keyed by id (blocks start here, others never move). */
  entities: { id: string; kind: EntityKind; pos: Pos }[];
}

const cache = new WeakMap<ChallengeDefinition, ParsedWorld>();

/** Parses and validates a challenge; throws on any structural problem. */
export function parseWorld(c: ChallengeDefinition): ParsedWorld {
  const hit = cache.get(c);
  if (hit) return hit;

  const height = c.map.length;
  const width = c.map[0]?.length ?? 0;
  if (height === 0 || width === 0) throw new Error(`${c.id}: empty map`);

  const walls: boolean[][] = [];
  const entities: ParsedWorld['entities'] = [];
  let start: Pos | undefined;
  let exit: Pos | undefined;
  const seenIds = new Set<string>();

  c.map.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${c.id}: row ${y} has length ${row.length}, expected ${width}`);
    walls.push([]);
    [...row].forEach((ch, x) => {
      const isWall = ch === '#';
      walls[y]?.push(isWall);
      if (ch === '#' || ch === '.') return;
      if (ch === '@') {
        if (start) throw new Error(`${c.id}: multiple starts`);
        start = { x, y };
      } else if (ch === 'E') {
        if (exit) throw new Error(`${c.id}: multiple exits`);
        exit = { x, y };
      } else {
        const entry = c.legend[ch];
        if (!entry) throw new Error(`${c.id}: map char '${ch}' at ${x},${y} missing from legend`);
        if (seenIds.has(entry.id)) throw new Error(`${c.id}: duplicate entity id ${entry.id}`);
        seenIds.add(entry.id);
        entities.push({ id: entry.id, kind: entry.kind, pos: { x, y } });
      }
    });
  });

  if (!start) throw new Error(`${c.id}: no start '@'`);
  if (!exit) throw new Error(`${c.id}: no exit 'E'`);

  const kindOf = new Map(entities.map((e) => [e.id, e.kind]));
  const checkCond = (cond: Cond): void => {
    switch (cond.op) {
      case 'on': {
        const k = kindOf.get(cond.id);
        if (k !== 'switch' && k !== 'plate') throw new Error(`${c.id}: condition references ${cond.id} which is not a switch/plate`);
        return;
      }
      case 'const':
        return;
      case 'not':
        return checkCond(cond.arg);
      case 'and':
      case 'or':
        return cond.args.forEach(checkCond);
    }
  };
  for (const e of entities.filter((x) => x.kind === 'door')) {
    const cond = c.rules.doors[e.id];
    if (!cond) throw new Error(`${c.id}: door ${e.id} has no rule`);
    checkCond(cond);
  }
  Object.values(c.rules.switchEnabled ?? {}).forEach(checkCond);
  for (const id of Object.keys(c.rules.switchEnabled ?? {})) {
    if (kindOf.get(id) !== 'switch') throw new Error(`${c.id}: switchEnabled references non-switch ${id}`);
  }
  for (const id of c.rules.switchInitiallyOn ?? []) {
    if (kindOf.get(id) !== 'switch') throw new Error(`${c.id}: switchInitiallyOn references non-switch ${id}`);
  }
  if (c.rules.shift) {
    if (kindOf.get(c.rules.shift.tripwire) !== 'tripwire') {
      throw new Error(`${c.id}: shift references non-tripwire ${c.rules.shift.tripwire}`);
    }
    for (const [id, cond] of Object.entries(c.rules.shift.doors)) {
      if (kindOf.get(id) !== 'door') throw new Error(`${c.id}: shift rewires non-door ${id}`);
      checkCond(cond);
    }
  }
  if (c.budget.execute < 1) throw new Error(`${c.id}: execute budget must be >= 1`);
  if (c.budget.explore < 0) throw new Error(`${c.id}: explore budget must be >= 0`);

  const parsed: ParsedWorld = { width, height, walls, start, exit, entities };
  cache.set(c, parsed);
  return parsed;
}
