/**
 * DON'T PRESS THAT: the rules of the world, with no browser, no clock and no randomness in them.
 *
 * One call to `step` is one 1/60 s tick. The same level and the same inputs always produce the same events, which is what lets the
 * tests replay a solution, lets a death be explained, and lets the host's predictions be checked afterwards instead of trusted.
 * Nothing here knows about the host, the screen or the player's settings: commentary and personality cannot change a collision.
 */

export const W = 20;
export const H = 11;
export const TICK = 1 / 60;

/** Half extents of the body used for walls and floors, and of the smaller body used for hazards (a little forgiving on purpose). */
export const HW = 0.35;
export const HH = 0.45;
const HURT_W = 0.28;
const HURT_H = 0.38;

// ---- movement feel. All distances are tiles, all times seconds. One place, so "the controls" are one thing. ----
export const RUN = 6.4;
export const GROUND_ACCEL = 90;
export const GROUND_DECEL = 110;
export const AIR_ACCEL = 60;
export const AIR_DECEL = 30;
export const GRAVITY = 48;
export const JUMP_V = 17.2; // peak height v^2 / 2g = 3.08 tiles
export const MAX_FALL = 24;
/** Gravity multiplier while rising with the jump button released: a short tap is a short hop. */
export const JUMP_CUT = 2.4;
export const COYOTE = 6;
export const BUFFER = 6;

/** Death to control, in ticks. The body breaks for a moment; any fresh key press skips the rest. */
export const RESPAWN_TICKS = 15;
export const RESPAWN_MIN = 6;

/**
 * The host's beam. It follows where it predicts you will be (`track`), freezes the guess (`lock`, the marker changes and stops: this is
 * your window to do something it did not expect), then fires for a moment (`active`). `lead` is how far ahead, in seconds, it aims
 * when it believes you will keep going; it equals the lock time, so a player who simply carries on is exactly where it fires.
 */
export const BEAM = { track: 36, lock: 24, active: 10, cooldown: 60, grace: 80, lead: 0.4, width: 1.0 } as const;

export const KEY = { L: 1, R: 2, J: 4, RESTART: 8 } as const;
export type Gs = 1 | -1;
export type BeamMode = 'lead' | 'camp';
export type DeathCause = 'spike' | 'drop' | 'zone' | 'beam' | 'pit';

// ---------------------------------------------------------------------------------------------------------------- level data
export interface DropDef {
  id: string;
  /** Left edge and width in tiles; the bar hangs from `y`. */
  x: number;
  w: number;
  y: number;
  len: number;
  /** Walking past this x arms it; or only the button does. */
  trigger: { x: number } | 'button';
  /** Ticks of shaking before it falls. */
  tell: number;
  /** Tiles per second. */
  speed: number;
}
export interface ZoneDef {
  id: string;
  /** Taking off from the ground with x in [from, to) springs the spikes. */
  from: number;
  to: number;
  spikeX: number;
  spikeW: number;
  y0: number;
  len: number;
  extend: number;
  hold: number;
}
export interface MarkDef {
  id: string;
  x: number;
}
export interface LevelDef {
  id: string;
  n: number;
  name: string;
  /** Bumped whenever geometry or timing changes, so stored results can be told apart. */
  version: number;
  rows: readonly string[];
  drops: readonly DropDef[];
  zones: readonly ZoneDef[];
  marks: readonly MarkDef[];
  /** 'off': no beams. 'lead': always aims ahead. 'adaptive': aims by what the player did last attempt. */
  beams: 'off' | 'lead' | 'adaptive';
  /** What the red button does: 'drops' springs every armed drop (a harmless lure); 'goal' ends the game. */
  button: 'none' | 'drops' | 'goal';
  goal: 'exit' | 'button';
}

export interface Parsed {
  grid: string[][];
  start: { x: number; y: number };
  exit: { x: number; y: number } | null;
  stars: { x: number; y: number }[];
  buttons: { x: number; y: number; kind: 'B' | 'R' }[];
  spikes: { x: number; y: number; down: boolean }[];
}

const parsedCache = new WeakMap<LevelDef, Parsed>();
export function parseLevel(level: LevelDef): Parsed {
  const hit = parsedCache.get(level);
  if (hit) return hit;
  if (level.rows.length !== H) throw new Error(`${level.id}: expected ${H} rows, got ${level.rows.length}`);
  const grid: string[][] = [];
  const out: Parsed = { grid, start: { x: 1.5, y: 8.5 }, exit: null, stars: [], buttons: [], spikes: [] };
  level.rows.forEach((row, ty) => {
    if (row.length !== W) throw new Error(`${level.id}: row ${ty} has ${row.length} columns, expected ${W}`);
    const r = row.split('');
    grid.push(r);
    r.forEach((c, tx) => {
      if (c === 'P') {
        out.start = { x: tx + 0.5, y: ty + 1 - HH };
        r[tx] = '.';
      } else if (c === 'E') {
        out.exit = { x: tx + 0.5, y: ty + 0.5 };
        r[tx] = '.';
      } else if (c === '*') {
        out.stars.push({ x: tx + 0.5, y: ty + 0.5 });
        r[tx] = '.';
      } else if (c === 'B' || c === 'R') {
        out.buttons.push({ x: tx, y: ty, kind: c });
        r[tx] = '.';
      } else if (c === '^' || c === 'v') {
        out.spikes.push({ x: tx, y: ty, down: c === 'v' });
        r[tx] = '.';
      }
    });
  });
  parsedCache.set(level, out);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------- state
export type SimEvent =
  | { t: number; type: 'takeoff'; x: number; y: number }
  | { t: number; type: 'land'; x: number }
  | { t: number; type: 'death'; cause: DeathCause; x: number; y: number }
  | { t: number; type: 'button'; id: 'B' | 'R' }
  | { t: number; type: 'star'; gs: Gs; x: number }
  | { t: number; type: 'drop_trigger'; id: string; by: 'walk' | 'button' }
  | { t: number; type: 'drop_land'; id: string }
  | { t: number; type: 'zone_trigger'; id: string; x: number }
  | { t: number; type: 'beam_track' }
  | { t: number; type: 'beam_lock'; aim: number; mode: BeamMode }
  | { t: number; type: 'beam_start'; aim: number; broke: number }
  | { t: number; type: 'beam_end'; aim: number; hit: boolean }
  | { t: number; type: 'mark'; id: string }
  | { t: number; type: 'win' };

interface DropState {
  phase: 'armed' | 'tell' | 'fall' | 'landed';
  y: number;
  ticks: number;
}
interface ZoneState {
  phase: 'idle' | 'out' | 'spent';
  ticks: number;
}
interface BeamState {
  phase: 'idle' | 'track' | 'lock' | 'active';
  cd: number;
  aim: number;
  left: number;
}

export interface Sim {
  level: LevelDef;
  parsed: Parsed;
  mode: BeamMode;
  tick: number;
  p: { x: number; y: number; vx: number; vy: number; gs: Gs; grounded: boolean; coyote: number; buffer: number; face: 1 | -1; jumpWas: boolean };
  dead: { cause: DeathCause; x: number; y: number; ticks: number } | null;
  won: boolean;
  drops: DropState[];
  zones: ZoneState[];
  beam: BeamState;
  starsTaken: boolean[];
  buttonsPressed: boolean[];
  marksSeen: boolean[];
  broken: number[]; // x*100+y of destroyed cracked tiles
  events: SimEvent[];
}

export function createSim(level: LevelDef, mode: BeamMode = 'lead'): Sim {
  const parsed = parseLevel(level);
  return {
    level,
    parsed,
    mode,
    tick: 0,
    p: { x: parsed.start.x, y: parsed.start.y, vx: 0, vy: 0, gs: 1, grounded: true, coyote: COYOTE, buffer: 0, face: 1, jumpWas: false },
    dead: null,
    won: false,
    drops: level.drops.map((d) => ({ phase: 'armed', y: d.y, ticks: 0 })),
    zones: level.zones.map(() => ({ phase: 'idle', ticks: 0 })),
    beam: { phase: 'idle', cd: BEAM.grace, aim: 0, left: 0 },
    starsTaken: parsed.stars.map(() => false),
    buttonsPressed: parsed.buttons.map(() => false),
    marksSeen: level.marks.map(() => false),
    broken: [],
    events: [],
  };
}

export function cloneSim(s: Sim): Sim {
  return {
    ...s,
    p: { ...s.p },
    dead: s.dead ? { ...s.dead } : null,
    drops: s.drops.map((d) => ({ ...d })),
    zones: s.zones.map((z) => ({ ...z })),
    beam: { ...s.beam },
    starsTaken: s.starsTaken.slice(),
    buttonsPressed: s.buttonsPressed.slice(),
    marksSeen: s.marksSeen.slice(),
    broken: s.broken.slice(),
    events: s.events.slice(),
  };
}

// ---------------------------------------------------------------------------------------------------------------- world queries
const isSolidChar = (c: string | undefined): boolean => c === '#' || c === 'c';

export function solidAt(s: Sim, tx: number, ty: number): boolean {
  if (tx < 0 || tx >= W || ty < 0) return true;
  if (ty >= H) return false;
  const c = s.parsed.grid[ty]![tx];
  if (c === 'c') return !s.broken.includes(tx * 100 + ty);
  return isSolidChar(c);
}

function overlapsSolid(s: Sim, x: number, y: number): boolean {
  const x0 = Math.floor(x - HW);
  const x1 = Math.floor(x + HW - 1e-6);
  const y0 = Math.floor(y - HH);
  const y1 = Math.floor(y + HH - 1e-6);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidAt(s, tx, ty)) return true;
  return false;
}

interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
const hit = (a: Rect, b: Rect): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
export const hurtBox = (s: Sim): Rect => ({ x0: s.p.x - HURT_W, x1: s.p.x + HURT_W, y0: s.p.y - HURT_H, y1: s.p.y + HURT_H });

/** Where a bar falling in columns [x, x+w) comes to rest: its bottom edge on the first solid tile below. */
function landingY(s: Sim, d: DropDef): number {
  for (let ty = Math.max(0, Math.floor(d.y + d.len)); ty < H; ty++) {
    for (let tx = Math.floor(d.x); tx < Math.ceil(d.x + d.w); tx++) if (solidAt(s, tx, ty)) return ty - d.len;
  }
  return H;
}

export const dropRect = (d: DropDef, st: DropState): Rect => ({
  x0: d.x + 0.1,
  x1: d.x + d.w - 0.1,
  y0: st.phase === 'landed' ? st.y + d.len - 0.55 : st.y + 0.2,
  y1: st.y + d.len,
});
export const zoneRect = (z: ZoneDef, st: ZoneState): Rect | null => {
  if (st.phase !== 'out') return null;
  const f = Math.min(1, st.ticks / z.extend);
  return { x0: z.spikeX + 0.1, x1: z.spikeX + z.spikeW - 0.1, y0: z.y0, y1: z.y0 + z.len * f };
};
export const beamColumn = (aim: number): { x0: number; x1: number } => ({ x0: aim - BEAM.width / 2, x1: aim + BEAM.width / 2 });

// ---------------------------------------------------------------------------------------------------------------- step
function die(s: Sim, cause: DeathCause): void {
  if (s.dead || s.won) return;
  s.dead = { cause, x: s.p.x, y: s.p.y, ticks: 0 };
  s.events.push({ t: s.tick, type: 'death', cause, x: s.p.x, y: s.p.y });
}

const approach = (v: number, target: number, d: number): number => (v < target ? Math.min(target, v + d) : Math.max(target, v - d));

export function step(s: Sim, input: number): void {
  s.tick++;
  if (s.won) return;
  if (s.dead) {
    s.dead.ticks++;
    return;
  }
  const p = s.p;
  const left = (input & KEY.L) !== 0;
  const right = (input & KEY.R) !== 0;
  const jumpHeld = (input & KEY.J) !== 0;
  const dir = (right ? 1 : 0) - (left ? 1 : 0);
  if (dir !== 0) p.face = dir as 1 | -1;

  // horizontal velocity
  const accel = (dir === 0 ? (p.grounded ? GROUND_DECEL : AIR_DECEL) : p.grounded ? GROUND_ACCEL : AIR_ACCEL) * TICK;
  p.vx = approach(p.vx, dir * RUN, accel);

  // jump: a press is remembered for BUFFER ticks, and leaving a ledge still allows a jump for COYOTE ticks
  const pressed = jumpHeld && !p.jumpWas;
  p.jumpWas = jumpHeld;
  if (pressed) p.buffer = BUFFER;
  else if (p.buffer > 0) p.buffer--;
  if (p.grounded) p.coyote = COYOTE;
  else if (p.coyote > 0) p.coyote--;
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -p.gs * JUMP_V;
    p.buffer = 0;
    p.coyote = 0;
    p.grounded = false;
    s.events.push({ t: s.tick, type: 'takeoff', x: p.x, y: p.y });
    for (let i = 0; i < s.zones.length; i++) {
      const z = s.level.zones[i]!;
      const zs = s.zones[i]!;
      if (zs.phase === 'idle' && p.x >= z.from && p.x < z.to) {
        zs.phase = 'out';
        zs.ticks = 0;
        s.events.push({ t: s.tick, type: 'zone_trigger', id: z.id, x: p.x });
      }
    }
  }

  // gravity
  const rising = p.vy * p.gs < 0;
  p.vy += p.gs * GRAVITY * (rising && !jumpHeld ? JUMP_CUT : 1) * TICK;
  if (p.vy * p.gs > MAX_FALL) p.vy = p.gs * MAX_FALL;

  // move, one axis at a time, snapping to tile edges so a fast body can never end up inside a wall
  let nx = p.x + p.vx * TICK;
  if (overlapsSolid(s, nx, p.y)) {
    nx = p.vx > 0 ? Math.floor(nx + HW) - HW - 1e-4 : Math.ceil(nx - HW) + HW + 1e-4;
    p.vx = 0;
  }
  p.x = nx;
  let ny = p.y + p.vy * TICK;
  if (overlapsSolid(s, p.x, ny)) {
    ny = p.vy > 0 ? Math.floor(ny + HH) - HH - 1e-4 : Math.ceil(ny - HH) + HH + 1e-4;
    p.vy = 0;
  }
  p.y = ny;
  const wasGrounded = p.grounded;
  p.grounded = p.vy * p.gs >= 0 && overlapsSolid(s, p.x, p.y + p.gs * 0.05);
  if (p.grounded && !wasGrounded) s.events.push({ t: s.tick, type: 'land', x: p.x });

  // marks
  s.level.marks.forEach((m, i) => {
    if (!s.marksSeen[i] && p.x >= m.x) {
      s.marksSeen[i] = true;
      s.events.push({ t: s.tick, type: 'mark', id: m.id });
    }
  });

  // pickups, buttons
  s.parsed.stars.forEach((st, i) => {
    if (!s.starsTaken[i] && Math.abs(p.x - st.x) < 0.6 && Math.abs(p.y - st.y) < 0.7) {
      s.starsTaken[i] = true;
      p.gs = (p.gs === 1 ? -1 : 1) as Gs;
      p.vy = 0;
      p.grounded = false;
      p.coyote = 0;
      s.events.push({ t: s.tick, type: 'star', gs: p.gs, x: st.x });
    }
  });
  const hb = hurtBox(s);
  s.parsed.buttons.forEach((b, i) => {
    if (s.buttonsPressed[i]) return;
    if (hit(hb, { x0: b.x + 0.1, x1: b.x + 0.9, y0: b.y + 0.55, y1: b.y + 1 })) {
      s.buttonsPressed[i] = true;
      s.events.push({ t: s.tick, type: 'button', id: b.kind });
      if (b.kind === 'B' && s.level.button === 'drops') {
        s.level.drops.forEach((d, k) => {
          const ds = s.drops[k]!;
          if (ds.phase === 'armed') {
            ds.phase = 'tell';
            ds.ticks = 0;
            s.events.push({ t: s.tick, type: 'drop_trigger', id: d.id, by: 'button' });
          }
        });
      }
      if (b.kind === 'R' && s.level.goal === 'button') {
        s.won = true;
        s.events.push({ t: s.tick, type: 'win' });
      }
    }
  });
  if (s.won) return;

  // falling bars
  s.level.drops.forEach((d, i) => {
    const ds = s.drops[i]!;
    if (ds.phase === 'armed' && d.trigger !== 'button' && p.x >= d.trigger.x) {
      ds.phase = 'tell';
      ds.ticks = 0;
      s.events.push({ t: s.tick, type: 'drop_trigger', id: d.id, by: 'walk' });
    } else if (ds.phase === 'tell') {
      if (++ds.ticks >= d.tell) ds.phase = 'fall';
    } else if (ds.phase === 'fall') {
      ds.y += d.speed * TICK;
      const rest = landingY(s, d);
      if (ds.y >= rest) {
        ds.y = rest;
        ds.phase = 'landed';
        s.events.push({ t: s.tick, type: 'drop_land', id: d.id });
      }
    }
  });
  // springing ceiling spikes
  s.zones.forEach((zs, i) => {
    if (zs.phase !== 'out') return;
    const z = s.level.zones[i]!;
    if (zs.ticks >= z.extend + z.hold) zs.phase = 'spent';
    else zs.ticks++;
  });

  // the beam director
  if (s.level.beams !== 'off') stepBeam(s);
  if (s.dead) return;

  // hazards
  const hb2 = hurtBox(s);
  for (const sp of s.parsed.spikes) {
    const r: Rect = sp.down ? { x0: sp.x + 0.18, x1: sp.x + 0.82, y0: sp.y, y1: sp.y + 0.55 } : { x0: sp.x + 0.18, x1: sp.x + 0.82, y0: sp.y + 0.45, y1: sp.y + 1 };
    if (hit(hb2, r)) return die(s, 'spike');
  }
  for (let i = 0; i < s.level.drops.length; i++) if (hit(hb2, dropRect(s.level.drops[i]!, s.drops[i]!))) return die(s, 'drop');
  for (let i = 0; i < s.level.zones.length; i++) {
    const r = zoneRect(s.level.zones[i]!, s.zones[i]!);
    if (r && hit(hb2, r)) return die(s, 'zone');
  }
  if (p.y > H + 1.2 || p.y < -1.2) return die(s, 'pit');

  // the exit
  const ex = s.parsed.exit;
  if (ex && s.level.goal === 'exit' && Math.abs(p.x - ex.x) < 0.5 && Math.abs(p.y - ex.y) < 0.7) {
    s.won = true;
    s.events.push({ t: s.tick, type: 'win' });
  }
}

const clampAim = (x: number): number => Math.min(W - 0.5, Math.max(0.5, Math.round(x * 100) / 100));

function stepBeam(s: Sim): void {
  const b = s.beam;
  const p = s.p;
  const mode: BeamMode = s.level.beams === 'lead' ? 'lead' : s.mode;
  const predict = (): number => clampAim(mode === 'camp' ? p.x : p.x + p.vx * BEAM.lead);
  if (b.phase === 'idle') {
    if (b.cd > 0) {
      b.cd--;
      return;
    }
    b.phase = 'track';
    b.left = BEAM.track;
    b.aim = predict();
    s.events.push({ t: s.tick, type: 'beam_track' });
    return;
  }
  if (b.phase === 'track') {
    b.aim = predict();
    if (--b.left > 0) return;
    b.phase = 'lock';
    b.left = BEAM.lock;
    s.events.push({ t: s.tick, type: 'beam_lock', aim: b.aim, mode });
    return;
  }
  if (b.phase === 'lock') {
    if (--b.left > 0) return;
    b.phase = 'active';
    b.left = BEAM.active;
    const col = beamColumn(b.aim);
    let broke = 0;
    for (let ty = 0; ty < H; ty++) {
      for (let tx = Math.floor(col.x0); tx <= Math.floor(col.x1 - 1e-6); tx++) {
        if (s.parsed.grid[ty]![tx] === 'c' && !s.broken.includes(tx * 100 + ty)) {
          s.broken.push(tx * 100 + ty);
          broke++;
        }
      }
    }
    s.events.push({ t: s.tick, type: 'beam_start', aim: b.aim, broke });
  }
  // active (also checked on the tick it starts)
  const col = beamColumn(b.aim);
  const hb = hurtBox(s);
  if (hb.x0 < col.x1 && hb.x1 > col.x0) {
    s.events.push({ t: s.tick, type: 'beam_end', aim: b.aim, hit: true });
    b.phase = 'idle';
    b.cd = BEAM.cooldown;
    die(s, 'beam');
    return;
  }
  if (--b.left <= 0) {
    s.events.push({ t: s.tick, type: 'beam_end', aim: b.aim, hit: false });
    b.phase = 'idle';
    b.cd = BEAM.cooldown;
  }
}

/** A compact string for "have we been in this situation before", used by the solver and by determinism tests. */
export function stateKey(s: Sim, coarse = true): string {
  const q = coarse ? [8, 8, 2, 1] : [1000, 1000, 1000, 1000];
  const p = s.p;
  const parts: (string | number)[] = [
    Math.round(p.x * q[0]!),
    Math.round(p.y * q[1]!),
    Math.round(p.vx * q[2]!),
    Math.round(p.vy * q[3]!),
    p.grounded ? 1 : 0,
    p.gs,
    s.dead ? 'd' : s.won ? 'w' : 'a',
    s.starsTaken.map((x) => (x ? 1 : 0)).join(''),
    s.buttonsPressed.map((x) => (x ? 1 : 0)).join(''),
    s.drops.map((d) => `${d.phase[0]}${Math.round(d.y)}${d.ticks}`).join(','),
    s.zones.map((z) => `${z.phase[0]}${z.ticks}`).join(','),
    s.broken.length,
  ];
  if (s.level.beams !== 'off') parts.push(s.beam.phase[0]!, s.beam.cd, s.beam.left, Math.round(s.beam.aim * 4));
  if (!coarse) parts.push(s.tick, p.coyote, p.buffer);
  return parts.join('|');
}

/** Run a list of per-tick inputs from a fresh start. Pure; used by tests and by the solver's final check. */
export function replay(level: LevelDef, inputs: readonly number[], mode: BeamMode = 'lead'): Sim {
  const s = createSim(level, mode);
  for (const i of inputs) {
    step(s, i);
    if (s.won || s.dead) break;
  }
  return s;
}
