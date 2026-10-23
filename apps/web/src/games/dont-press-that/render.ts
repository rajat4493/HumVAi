import type { Mood } from './lines';
import { BEAM, H, HH, HW, W, beamColumn, dropRect, zoneRect } from './sim';
import type { Sim } from './sim';

/**
 * Drawing only: reads a Sim and paints it. No rules live here, so nothing on screen can disagree with what the simulation decided.
 * Colours come from the suite's Playful Futurism tokens. Danger is always a shape (a spike, a column) as well as a colour.
 */
export const BAND = 1.25; // the host's strip above the level, in tiles
export const LOGICAL_ASPECT = W / (H + BAND);

const C = {
  night: '#0b1026',
  night2: '#121a3d',
  tile: '#1f2c63',
  tileEdge: '#4a5cc2',
  tileShade: '#17214d',
  ink: '#f4f1ff',
  dim: '#a9b0d6',
  human: '#ffb347',
  humanDeep: '#e07b1a',
  ai: '#6f8cff',
  violet: '#b78cff',
  exit: '#5be38a',
  warn: '#ff6b6b',
  warnDeep: '#c93c52',
  metal: '#8a93c8',
};

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface RenderView {
  sim: Sim;
  time: number;
  mood: Mood;
  composure: number;
  /** Where the host hovers, in tiles. */
  hostX: number;
  correct: number;
  wrong: number;
  reduced: boolean;
  shakePx: number;
  particles: readonly Particle[];
  ventsLearned: boolean;
  /** Milliseconds since the final button was pressed; null before. */
  finaleMs: number | null;
  /** Visual squash on landing, 0..1. */
  squash: number;
}

// ---------------------------------------------------------------------------------------------------------------- the host
interface Face {
  eye: number; // how open, 0..1
  browL: number;
  browR: number;
  mouth: number; // -1 frown .. 1 smile
  open: number; // mouth open 0..1
  look: [number, number];
}
const FACES: Record<Mood, Face> = {
  smug: { eye: 0.55, browL: 0.15, browR: -0.1, mouth: 0.7, open: 0, look: [0.1, 0] },
  smirk: { eye: 0.7, browL: 0.35, browR: -0.2, mouth: 0.4, open: 0, look: [0.3, 0] },
  thinking: { eye: 0.8, browL: 0.1, browR: 0.2, mouth: 0, open: 0, look: [-0.4, -0.5] },
  delighted: { eye: 0.2, browL: -0.2, browR: -0.2, mouth: 1, open: 0.5, look: [0, 0] },
  shocked: { eye: 1, browL: -0.6, browR: -0.6, mouth: 0, open: 0.6, look: [0, 0] },
  glitch: { eye: 0.9, browL: -0.4, browR: 0.5, mouth: -0.3, open: 0.3, look: [0.2, 0.2] },
  sulk: { eye: 0.6, browL: 0.5, browR: 0.5, mouth: -0.8, open: 0, look: [0, 0.3] },
  defeated: { eye: 0, browL: 0.4, browR: 0.4, mouth: -0.4, open: 0, look: [0, 0] },
  panic: { eye: 1, browL: -0.8, browR: -0.8, mouth: -0.2, open: 0.8, look: [0, 0] },
  cheer: { eye: 0.3, browL: -0.3, browR: -0.3, mouth: 1, open: 0.7, look: [0, 0] },
};

export function drawHost(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, mood: Mood, time: number, composure: number, opts: { reduced: boolean; off?: boolean; lookX?: number } = { reduced: false }): void {
  const base = FACES[mood];
  // he watches you: his pupils lean toward the player whenever the mood does not already say where to look
  const face: Face = opts.lookX === undefined || mood === 'thinking' ? base : { ...base, look: [Math.max(-1, Math.min(1, opts.lookX)) * 0.8, base.look[1]] };
  const off = opts.off === true;
  const bob = opts.reduced ? 0 : Math.sin(time / 480) * r * 0.06;
  const y = cy + bob;
  ctx.save();
  // glow
  const glow = ctx.createRadialGradient(cx, y, r * 0.4, cx, y, r * 1.7);
  glow.addColorStop(0, off ? 'rgba(120,130,170,0.15)' : 'rgba(111,140,255,0.38)');
  glow.addColorStop(1, 'rgba(111,140,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, y, r * 1.7, 0, Math.PI * 2);
  ctx.fill();
  // body
  const body = ctx.createRadialGradient(cx - r * 0.35, y - r * 0.4, r * 0.1, cx, y, r);
  body.addColorStop(0, off ? '#7d86a8' : '#b9c8ff');
  body.addColorStop(1, off ? '#3b4268' : '#4a5fe0');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.stroke();
  // face plate
  ctx.fillStyle = off ? '#1a1f3a' : '#10163a';
  ctx.beginPath();
  ctx.ellipse(cx, y + r * 0.02, r * 0.78, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  const ex = r * 0.32;
  const ey = y - r * 0.12;
  const er = r * 0.2;
  const eyeCol = off ? '#8a92b8' : composure < 25 ? '#ff9aa8' : '#e8efff';
  const drawEye = (x: number, brow: number): void => {
    if (off) {
      ctx.strokeStyle = eyeCol;
      ctx.lineWidth = Math.max(1.5, r * 0.07);
      ctx.beginPath();
      ctx.moveTo(x - er * 0.7, ey - er * 0.7);
      ctx.lineTo(x + er * 0.7, ey + er * 0.7);
      ctx.moveTo(x + er * 0.7, ey - er * 0.7);
      ctx.lineTo(x - er * 0.7, ey + er * 0.7);
      ctx.stroke();
    } else if (face.eye < 0.25) {
      ctx.strokeStyle = eyeCol;
      ctx.lineWidth = Math.max(1.5, r * 0.08);
      ctx.beginPath();
      ctx.arc(x, ey + er * 0.2, er * 0.8, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else {
      ctx.fillStyle = eyeCol;
      ctx.beginPath();
      ctx.ellipse(x, ey, er, er * face.eye, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#10163a';
      ctx.beginPath();
      ctx.arc(x + face.look[0] * er * 0.5, ey + face.look[1] * er * 0.4, er * 0.45, 0, Math.PI * 2);
      ctx.fill();
      if (face.eye < 0.7) {
        // heavy lid: a smug half-closed look
        ctx.fillStyle = '#10163a';
        ctx.fillRect(x - er * 1.1, ey - er * 1.1, er * 2.2, er * (1.1 - face.eye) * 1.2);
      }
    }
    ctx.strokeStyle = eyeCol;
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(x - er * 0.9, ey - er * 1.5 + brow * er);
    ctx.lineTo(x + er * 0.9, ey - er * 1.5 - brow * er);
    ctx.stroke();
  };
  drawEye(cx - ex, face.browL);
  drawEye(cx + ex, -face.browR);
  // monocle
  ctx.strokeStyle = C.human;
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.beginPath();
  ctx.arc(cx + ex, ey, er * 1.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + ex + er * 0.95, ey + er * 0.95);
  ctx.quadraticCurveTo(cx + r * 0.75, y + r * 0.5, cx + r * 0.55, y + r * 0.95);
  ctx.stroke();
  // mouth
  const my = y + r * 0.3;
  const mw = r * 0.38;
  ctx.strokeStyle = eyeCol;
  ctx.fillStyle = eyeCol;
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.beginPath();
  if (face.open > 0.2) {
    ctx.ellipse(cx, my + r * 0.04, mw * 0.55, r * 0.18 * face.open, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(cx - mw, my);
    ctx.quadraticCurveTo(cx, my + face.mouth * r * 0.28, cx + mw, my - (mood === 'smirk' ? r * 0.1 : 0));
    ctx.stroke();
  }
  // bow tie
  ctx.fillStyle = C.human;
  const by = y + r * 0.98;
  ctx.beginPath();
  ctx.moveTo(cx, by);
  ctx.lineTo(cx - r * 0.34, by - r * 0.2);
  ctx.lineTo(cx - r * 0.34, by + r * 0.2);
  ctx.closePath();
  ctx.moveTo(cx, by);
  ctx.lineTo(cx + r * 0.34, by - r * 0.2);
  ctx.lineTo(cx + r * 0.34, by + r * 0.2);
  ctx.closePath();
  ctx.fill();
  // rattled: a crack across the plate and a sweat drop; a still image for reduced motion, never a flash
  if (!off && composure < 55) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.55, y - r * 0.5);
    ctx.lineTo(cx - r * 0.3, y - r * 0.2);
    ctx.lineTo(cx - r * 0.42, y + r * 0.05);
    ctx.stroke();
  }
  if (!off && (mood === 'panic' || composure < 25)) {
    ctx.fillStyle = '#9fd4ff';
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.85, y - r * 0.35, r * 0.1, r * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------- the world
const solid = (s: Sim, tx: number, ty: number): boolean => tx < 0 || tx >= W || ty < 0 || (ty < H && s.parsed.grid[ty]![tx] === '#');

export function drawScene(ctx: CanvasRenderingContext2D, cssW: number, view: RenderView): void {
  const s = view.sim;
  const T = cssW / W;
  const px = (x: number): number => x * T;
  const py = (y: number): number => (BAND + y) * T;
  const totalH = (H + BAND) * T;
  ctx.save();
  ctx.clearRect(0, 0, cssW, totalH);
  if (view.shakePx > 0 && !view.reduced) ctx.translate((Math.sin(view.time) * view.shakePx) | 0, (Math.cos(view.time * 1.3) * view.shakePx) | 0);

  // background and a faint grid so distances read
  const bg = ctx.createLinearGradient(0, 0, 0, totalH);
  bg.addColorStop(0, C.night2);
  bg.addColorStop(1, C.night);
  ctx.fillStyle = bg;
  ctx.fillRect(-8, -8, cssW + 16, totalH + 16);
  ctx.fillStyle = 'rgba(169,176,214,0.12)';
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) ctx.fillRect(px(tx + 0.5) - 1, py(ty + 0.5) - 1, 2, 2);

  // host strip
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, 0, cssW, BAND * T);

  // tiles
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const c = s.parsed.grid[ty]![tx];
      if (c === '#') {
        ctx.fillStyle = C.tile;
        ctx.fillRect(px(tx), py(ty), T + 0.5, T + 0.5);
        ctx.fillStyle = C.tileShade;
        ctx.fillRect(px(tx) + T * 0.08, py(ty) + T * 0.08, T * 0.84, T * 0.84);
        ctx.fillStyle = C.tileEdge;
        if (!solid(s, tx, ty - 1)) ctx.fillRect(px(tx), py(ty), T + 0.5, Math.max(2, T * 0.1));
        if (!solid(s, tx, ty + 1)) ctx.fillRect(px(tx), py(ty + 1) - Math.max(2, T * 0.1), T + 0.5, Math.max(2, T * 0.1));
      } else if (c === 'c' && !s.broken.includes(tx * 100 + ty)) {
        ctx.fillStyle = '#3b2f66';
        ctx.fillRect(px(tx) + 1, py(ty), T - 2, T + 0.5);
        ctx.strokeStyle = C.violet;
        ctx.lineWidth = Math.max(1.5, T * 0.07);
        ctx.setLineDash([T * 0.18, T * 0.1]);
        ctx.strokeRect(px(tx) + 2, py(ty) + 1, T - 4, T - 2);
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(px(tx) + T * 0.3, py(ty) + T * 0.1);
        ctx.lineTo(px(tx) + T * 0.55, py(ty) + T * 0.45);
        ctx.lineTo(px(tx) + T * 0.4, py(ty) + T * 0.9);
        ctx.stroke();
      }
    }
  }

  // ceiling vents (level 2) and the spikes they hide
  s.level.zones.forEach((z, i) => {
    const slots = Math.max(2, Math.round(z.spikeW * 1.5));
    for (let k = 0; k < slots; k++) {
      const x = z.spikeX + (k + 0.5) * (z.spikeW / slots);
      ctx.fillStyle = view.ventsLearned ? C.human : '#0b1026';
      ctx.fillRect(px(x) - T * 0.18, py(z.y0) - T * 0.08, T * 0.36, T * 0.12);
    }
    const r = zoneRect(z, s.zones[i]!);
    if (r) drawSpikeRow(ctx, px(r.x0), py(r.y0), px(r.x1) - px(r.x0), py(r.y1) - py(r.y0), true, T);
  });

  // spikes on tiles
  for (const sp of s.parsed.spikes) drawSpikeRow(ctx, px(sp.x) + T * 0.1, py(sp.down ? sp.y : sp.y + 0.35), T * 0.8, T * 0.65, sp.down, T);

  // falling bars
  s.level.drops.forEach((d, i) => {
    const st = s.drops[i]!;
    const shake = st.phase === 'tell' && !view.reduced ? Math.sin(s.tick * 2.4) * T * 0.05 : 0;
    const x = px(d.x) + shake;
    const w = d.w * T;
    if (st.phase === 'landed') {
      drawSpikeRow(ctx, x, py(st.y + d.len - 0.65), w, T * 0.65, false, T);
    } else {
      ctx.fillStyle = C.metal;
      ctx.fillRect(x, py(st.y), w, T * 0.28);
      drawSpikeRow(ctx, x, py(st.y) + T * 0.2, w, T * 0.7, true, T);
    }
    void dropRect;
  });

  // buttons
  for (const [i, b] of s.parsed.buttons.entries()) {
    const pressed = s.buttonsPressed[i]!;
    const big = b.kind === 'R';
    const cx = px(b.x + 0.5);
    const base = py(b.y + 1);
    const w = T * (big ? 1.0 : 0.9);
    if (!pressed) {
      const glow = ctx.createRadialGradient(cx, base - T * 0.3, T * 0.1, cx, base - T * 0.3, T * (big ? 1.1 : 0.85));
      glow.addColorStop(0, 'rgba(255,107,107,0.38)');
      glow.addColorStop(1, 'rgba(255,107,107,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - T * 1.2, base - T * 1.5, T * 2.4, T * 1.6);
    }
    ctx.fillStyle = '#2a3270';
    ctx.fillRect(cx - w / 2, base - T * 0.18, w, T * 0.18);
    ctx.fillStyle = pressed ? C.warnDeep : C.warn;
    const capH = T * (pressed ? 0.12 : big ? 0.5 : 0.4);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.4, base - T * 0.18);
    ctx.quadraticCurveTo(cx, base - T * 0.18 - capH * 2, cx + w * 0.4, base - T * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1.5, T * 0.06);
    ctx.stroke();
    // the sign: it says exactly what it says
    ctx.fillStyle = C.ink;
    ctx.font = `800 ${Math.max(8, T * 0.27)}px system-ui, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    const label = "DON'T PRESS THAT";
    const half = ctx.measureText(label).width / 2 + T * 0.1;
    ctx.textAlign = 'center';
    ctx.fillText(label, Math.min(cssW - half, Math.max(half, cx)), base - T * (big ? 0.9 : 0.78));
  }

  // exit door
  if (s.parsed.exit) {
    const e = s.parsed.exit;
    const x = px(e.x);
    const y = py(e.y + 0.5);
    ctx.fillStyle = 'rgba(91,227,138,0.22)';
    ctx.beginPath();
    ctx.arc(x, y - T * 0.45, T * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.exit;
    ctx.beginPath();
    ctx.moveTo(x - T * 0.36, y);
    ctx.lineTo(x - T * 0.36, y - T * 0.65);
    ctx.arc(x, y - T * 0.65, T * 0.36, Math.PI, 0);
    ctx.lineTo(x + T * 0.36, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0b1026';
    ctx.beginPath();
    ctx.arc(x + T * 0.17, y - T * 0.35, T * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  // stars
  s.parsed.stars.forEach((st, i) => {
    if (s.starsTaken[i]) return;
    const x = px(st.x);
    const y = py(st.y) + (view.reduced ? 0 : Math.sin(view.time / 300 + i) * T * 0.05);
    ctx.fillStyle = 'rgba(183,140,255,0.28)';
    ctx.beginPath();
    ctx.arc(x, y, T * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.violet;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1.2, T * 0.05);
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 === 0 ? T * 0.36 : T * 0.16;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0b1026';
    ctx.font = `800 ${Math.max(8, T * 0.3)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⇅', x, y + T * 0.02); // small print: stars turn gravity over
  });

  // beam
  if (s.level.beams !== 'off') drawBeam(ctx, s, view, T, px, py);

  // you
  if (!s.dead) drawPlayer(ctx, s, view, T, px, py);

  // particles
  for (const p of view.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(px(p.x) - p.size / 2, py(p.y) - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // the host himself, last so nothing covers him
  const off = view.finaleMs !== null;
  const hx = px(view.hostX);
  const hy = (BAND * T) / 2 + (off && !view.reduced ? Math.min(view.finaleMs! / 8, 6) : 0);
  drawHost(ctx, hx, hy, Math.min(T * 0.5, BAND * T * 0.42), view.mood, view.time, view.composure, { reduced: view.reduced, off, lookX: (s.p.x - view.hostX) / 5 });
  ctx.restore();
}

function drawSpikeRow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, down: boolean, T: number): void {
  if (w <= 0 || h <= 0) return;
  const n = Math.max(1, Math.round(w / (T * 0.5)));
  const sw = w / n;
  ctx.fillStyle = C.warn;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(1.2, T * 0.05);
  ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    if (down) {
      ctx.moveTo(x + i * sw, y);
      ctx.lineTo(x + (i + 1) * sw, y);
      ctx.lineTo(x + (i + 0.5) * sw, y + h);
    } else {
      ctx.moveTo(x + i * sw, y + h);
      ctx.lineTo(x + (i + 1) * sw, y + h);
      ctx.lineTo(x + (i + 0.5) * sw, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawBeam(ctx: CanvasRenderingContext2D, s: Sim, view: RenderView, T: number, px: (x: number) => number, py: (y: number) => number): void {
  const b = s.beam;
  if (b.phase === 'idle') return;
  const col = beamColumn(b.aim);
  const x0 = px(col.x0);
  const w = px(col.x1) - x0;
  const top = py(0);
  const h = H * T;
  if (b.phase === 'active') {
    ctx.fillStyle = 'rgba(255,107,107,0.55)';
    ctx.fillRect(x0, top, w, h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x0 + w * 0.3, top, w * 0.4, h);
    return;
  }
  const locked = b.phase === 'lock';
  const frac = locked ? b.left / BEAM.lock : 1;
  ctx.fillStyle = locked ? 'rgba(255,107,107,0.2)' : 'rgba(255,107,107,0.08)';
  ctx.fillRect(x0, top, w, h);
  ctx.strokeStyle = locked ? C.warn : 'rgba(255,107,107,0.6)';
  ctx.lineWidth = locked ? Math.max(2.5, T * 0.1) : Math.max(1.5, T * 0.05);
  ctx.setLineDash(locked ? [] : [T * 0.25, T * 0.2]);
  ctx.strokeRect(x0, top, w, h);
  ctx.setLineDash([]);
  // a crosshair on the floor line and, once locked, a shrinking bar: this is how long you have
  const cx = px(b.aim);
  const cy = py(H - 2) + T * 0.5;
  ctx.strokeStyle = locked ? '#fff' : C.warn;
  ctx.lineWidth = Math.max(1.5, T * 0.07);
  ctx.beginPath();
  ctx.arc(cx, cy, T * 0.38, 0, Math.PI * 2);
  ctx.moveTo(cx - T * 0.55, cy);
  ctx.lineTo(cx + T * 0.55, cy);
  ctx.moveTo(cx, cy - T * 0.55);
  ctx.lineTo(cx, cy + T * 0.55);
  ctx.stroke();
  if (locked) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x0, top + h - T * 0.14, w * frac, T * 0.14);
  }
  // a line from the host to the target, so it is clear who is aiming
  ctx.strokeStyle = locked ? 'rgba(255,107,107,0.9)' : 'rgba(255,107,107,0.35)';
  ctx.lineWidth = Math.max(1, T * 0.04);
  ctx.beginPath();
  ctx.moveTo(px(view.hostX), BAND * T * 0.85);
  ctx.lineTo(cx, top);
  ctx.stroke();
}

function drawPlayer(ctx: CanvasRenderingContext2D, s: Sim, view: RenderView, T: number, px: (x: number) => number, py: (y: number) => number): void {
  const p = s.p;
  const w = HW * 2 * T;
  const h = HH * 2 * T;
  const sq = view.reduced ? 0 : view.squash;
  const sw = w * (1 + sq * 0.25);
  const sh = h * (1 - sq * 0.2);
  const cx = px(p.x);
  const cy = py(p.y);
  ctx.save();
  ctx.translate(cx, cy);
  if (p.gs === -1) ctx.scale(1, -1);
  const g = ctx.createLinearGradient(0, -sh / 2, 0, sh / 2);
  g.addColorStop(0, '#ffd08a');
  g.addColorStop(1, C.human);
  ctx.fillStyle = g;
  const r = T * 0.18;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(-sw / 2, -sh / 2 + (h - sh) / 2, sw, sh, r);
  else ctx.rect(-sw / 2, -sh / 2 + (h - sh) / 2, sw, sh);
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, T * 0.06);
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  // eyes look the way you are going
  const look = p.face * T * 0.07;
  ctx.fillStyle = '#10163a';
  ctx.beginPath();
  ctx.arc(-T * 0.13 + look, -sh * 0.15, T * 0.07, 0, Math.PI * 2);
  ctx.arc(T * 0.13 + look, -sh * 0.15, T * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------- effects
export function burst(x: number, y: number, count: number, colors: string[], seed: number): Particle[] {
  const out: Particle[] = [];
  let r = seed >>> 0 || 1;
  const rnd = (): number => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const sp = 2 + rnd() * 6;
    out.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, life: 0.5 + rnd() * 0.4, max: 0.9, color: colors[i % colors.length]!, size: 4 + rnd() * 5 });
  }
  return out;
}
export function stepParticles(list: Particle[], dt: number): Particle[] {
  return list
    .map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vy: p.vy + 20 * dt, life: p.life - dt }))
    .filter((p) => p.life > 0);
}
