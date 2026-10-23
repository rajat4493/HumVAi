import { KEY, cloneSim, createSim, replay, step, stateKey } from './sim';
import type { BeamMode, LevelDef, Sim } from './sim';

/**
 * An independent player: a best-first search over short bursts of input. It exists to answer "can this level be beaten?" with a
 * recorded winning input list that is then replayed from a clean start, rather than with the designer's belief that it can.
 * Used by tests and tools only; the game itself never imports it.
 */
const MACRO = 6;
const dirs = [0, KEY.L, KEY.R];
// jump patterns inside one macro: none, tap (2 ticks), hold (the whole macro), hold for half
const jumps: number[][] = [
  [0, 0, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0],
  [1, 1, 1, 1, 0, 0],
  [1, 1, 1, 1, 1, 1],
];
export const MACROS: number[][] = dirs.flatMap((d) => jumps.map((j) => j.map((on) => d | (on ? KEY.J : 0))));

interface Node {
  sim: Sim;
  g: number;
  f: number;
  parent: Node | null;
  macro: number;
}

function heuristic(s: Sim): number {
  const gx = s.level.goal === 'exit' ? s.parsed.exit?.x : (s.parsed.buttons.find((b) => b.kind === 'R')?.x ?? 0) + 0.5;
  if (gx === undefined) return 0;
  // Gravity puzzles can need a detour; the horizontal distance is a gentle guide, not a promise. Unfinished sub-goals (a star not yet
  // taken, a cracked wall not yet broken) count against a state so that waiting for the right moment is not punished by distance alone.
  const stars = s.starsTaken.filter((t) => !t).length;
  const walls = s.parsed.grid.reduce((n, row, ty) => n + row.filter((c, tx) => c === 'c' && !s.broken.includes(tx * 100 + ty)).length, 0);
  return (Math.abs(gx - s.p.x) / 6.4) * 60 + stars * 90 + (walls > 0 ? 160 : 0);
}

export interface SolveResult {
  solved: boolean;
  inputs: number[];
  nodes: number;
  ticks: number;
}

export function solve(level: LevelDef, mode: BeamMode = 'lead', opts: { maxNodes?: number; weight?: number; repeat?: number; from?: Sim; walkOnly?: boolean } = {}): SolveResult {
  const maxNodes = opts.maxNodes ?? 250_000;
  // `walkOnly` keeps just stand / left / right: enough for levels whose puzzle is timing, and far smaller to search.
  const macroIdx = (m: number): number => (opts.walkOnly ? [0, 4, 8][m]! : m);
  const macros = opts.walkOnly ? [0, 4, 8].map((i) => MACROS[i]!) : MACROS;
  const weight = opts.weight ?? 1.6;
  const start: Node = { sim: opts.from ? cloneSim(opts.from) : createSim(level, mode), g: 0, f: 0, parent: null, macro: -1 };
  const open: Node[] = [start];
  const seen = new Set<string>([stateKey(start.sim)]);
  let nodes = 0;
  const pop = (): Node => {
    // binary-heap-free selection is too slow; keep `open` as a min-heap on f
    const top = open[0]!;
    const last = open.pop()!;
    if (open.length > 0) {
      open[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < open.length && open[l]!.f < open[m]!.f) m = l;
        if (r < open.length && open[r]!.f < open[m]!.f) m = r;
        if (m === i) break;
        [open[i], open[m]] = [open[m]!, open[i]!];
        i = m;
      }
    }
    return top;
  };
  const push = (n: Node): void => {
    open.push(n);
    let i = open.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (open[p]!.f <= open[i]!.f) break;
      [open[p], open[i]] = [open[i]!, open[p]!];
      i = p;
    }
  };
  while (open.length > 0 && nodes < maxNodes) {
    const cur = pop();
    for (let m = 0; m < macros.length; m++) {
      const sim = cloneSim(cur.sim);
      sim.events = []; // the search does not need history; the final replay rebuilds it
      for (let rep = 0; rep < (opts.repeat ?? 1) && !sim.dead && !sim.won; rep++) {
        for (const input of macros[m]!) {
          step(sim, input);
          if (sim.dead || sim.won) break;
        }
      }
      nodes++;
      if (sim.dead) continue;
      const node: Node = { sim, g: cur.g + MACRO * (opts.repeat ?? 1), f: 0, parent: cur, macro: macroIdx(m) };
      if (sim.won) {
        const inputs = unwind(node, opts.repeat ?? 1);
        // Replay from scratch: the proof is the replay, not the search.
        const check = opts.from ? { won: true, tick: 0 } : replay(level, inputs, mode);
        if (check.won) return { solved: true, inputs: trimTail(inputs, level, mode), nodes, ticks: check.tick };
        continue;
      }
      const key = stateKey(sim);
      if (seen.has(key)) continue;
      seen.add(key);
      node.f = node.g + weight * heuristic(sim);
      push(node);
    }
  }
  return { solved: false, inputs: [], nodes, ticks: 0 };
}

function unwind(n: Node, repeat: number): number[] {
  const macros: number[] = [];
  for (let c: Node | null = n; c && c.macro >= 0; c = c.parent) macros.push(c.macro);
  macros.reverse();
  return macros.flatMap((m) => Array.from({ length: repeat }, () => MACROS[m]!).flat());
}

/** The winning tick is somewhere inside the last macro; drop inputs after it so the recording ends where the level does. */
function trimTail(inputs: number[], level: LevelDef, mode: BeamMode): number[] {
  const s = createSim(level, mode);
  const out: number[] = [];
  for (const i of inputs) {
    out.push(i);
    step(s, i);
    if (s.won) break;
  }
  return out;
}

/** A crude player for "does the surprise actually matter": does one fixed input pattern beat the level? */
export function fixedPlayer(level: LevelDef, pattern: (tick: number) => number, ticks = 900, mode: BeamMode = 'lead'): Sim {
  const s = createSim(level, mode);
  for (let t = 0; t < ticks && !s.won && !s.dead; t++) step(s, pattern(t));
  return s;
}
