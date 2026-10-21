import type Phaser from 'phaser';
import type { Shape } from './theme';
import { C, SWITCH_LOOK, TILE } from './theme';

type G = Phaser.GameObjects.Graphics;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function glow(g: G, cx: number, cy: number, r: number, color: number, a = 0.18): void {
  for (let i = 4; i >= 1; i--) {
    g.fillStyle(color, a * (1 - i / 6));
    g.fillCircle(cx, cy, r + i * 5);
  }
}

function shapeIcon(g: G, shape: Shape, cx: number, cy: number, r: number): void {
  switch (shape) {
    case 'circle':
      g.fillCircle(cx, cy, r);
      break;
    case 'square':
      g.fillRoundedRect(cx - r, cy - r, r * 2, r * 2, 5);
      break;
    case 'triangle':
      g.fillTriangle(cx, cy - r * 1.1, cx - r * 1.05, cy + r * 0.8, cx + r * 1.05, cy + r * 0.8);
      break;
    case 'diamond':
      g.fillPoints(
        [
          { x: cx, y: cy - r * 1.15 },
          { x: cx + r * 1.1, y: cy },
          { x: cx, y: cy + r * 1.15 },
          { x: cx - r * 1.1, y: cy },
        ],
        true,
      );
      break;
  }
}

function star(g: G, cx: number, cy: number, r: number, color: number): void {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
  }
  g.fillStyle(color, 1);
  g.fillPoints(pts, true);
}

export function buildTextures(scene: Phaser.Scene): void {
  const T = TILE;

  const floors = [
    ['floorA', C.floorA],
    ['floorB', C.floorB],
    ['floorScoutA', 0x1d3a6b], // scouting: blueprint blue
    ['floorScoutB', 0x214373],
    ['floorShiftA', 0x4a2f86], // the world changed its rules: violet
    ['floorShiftB', 0x53368f],
  ] as const;
  for (const [key, base] of floors) {
    make(scene, key, T, T, (g) => {
      g.fillStyle(base, 1);
      g.fillRoundedRect(2, 2, T - 4, T - 4, 12);
      g.fillStyle(0xffffff, 0.06);
      g.fillRoundedRect(5, 5, T - 10, (T - 10) / 2, { tl: 10, tr: 10, bl: 3, br: 3 });
      g.lineStyle(2, 0x0b1026, 0.35);
      g.strokeRoundedRect(2, 2, T - 4, T - 4, 12);
    });
  }

  make(scene, 'wall', T, T + 16, (g) => {
    g.fillStyle(0x070b1f, 0.45);
    g.fillRoundedRect(4, 12, T - 8, T, 14); // contact shadow
    g.fillStyle(C.wallSide, 1);
    g.fillRoundedRect(2, 12, T - 4, T - 4, 14); // side face
    g.fillStyle(C.wallTop, 1);
    g.fillRoundedRect(2, 0, T - 4, T - 8, 14); // top face
    g.fillStyle(0xffffff, 0.14);
    g.fillRoundedRect(8, 5, T - 16, 12, 8);
    g.fillStyle(0xffffff, 0.08);
    g.fillCircle(T * 0.3, T * 0.5, 4);
    g.fillCircle(T * 0.62, T * 0.38, 3);
  });

  make(scene, 'exit', T, T, (g) => {
    glow(g, T / 2, T / 2, 26, C.exit, 0.35);
    g.lineStyle(6, C.exit, 1);
    g.strokeCircle(T / 2, T / 2, 28);
    g.lineStyle(3, 0xffffff, 0.55);
    g.strokeCircle(T / 2, T / 2, 20);
    star(g, T / 2, T / 2 + 1, 15, 0xeafff1);
  });

  make(scene, 'human', T, T, (g) => {
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(T / 2, T - 16, 46, 14);
    glow(g, T / 2, T / 2 - 4, 30, C.human, 0.28);
    g.fillStyle(C.humanDeep, 1);
    g.fillCircle(T / 2, T / 2 - 2, 31);
    g.fillStyle(C.human, 1);
    g.fillCircle(T / 2, T / 2 - 5, 30);
    g.fillStyle(0xffffff, 0.35);
    g.fillEllipse(T / 2 - 9, T / 2 - 20, 20, 12);
    g.fillStyle(0x2a1a3d, 1);
    g.fillCircle(T / 2 - 10, T / 2 - 4, 4.5);
    g.fillCircle(T / 2 + 10, T / 2 - 4, 4.5);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(T / 2 - 8.5, T / 2 - 6, 1.6);
    g.fillCircle(T / 2 + 11.5, T / 2 - 6, 1.6);
  });

  make(scene, 'block', T, T, (g) => {
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(T / 2, T - 12, 62, 14);
    g.fillStyle(C.discoveryDeep, 1);
    g.fillRoundedRect(12, 16, T - 24, T - 28, 12);
    g.fillStyle(C.discovery, 1);
    g.fillRoundedRect(12, 10, T - 24, T - 32, 12);
    g.fillStyle(0xffffff, 0.3);
    g.fillRoundedRect(18, 15, T - 36, 9, 6);
    // four-way arrow glyph: "this can be pushed"
    g.fillStyle(0x3d2478, 0.9);
    g.fillRect(T / 2 - 2.5, 28, 5, 28);
    g.fillRect(T / 2 - 14, 39.5, 28, 5);
    g.fillTriangle(T / 2, 24, T / 2 - 6, 31, T / 2 + 6, 31);
    g.fillTriangle(T / 2, 60, T / 2 - 6, 53, T / 2 + 6, 53);
    g.fillTriangle(T / 2 - 18, 42, T / 2 - 11, 36, T / 2 - 11, 48);
    g.fillTriangle(T / 2 + 18, 42, T / 2 + 11, 36, T / 2 + 11, 48);
  });

  for (const state of ['idle', 'pressed'] as const) {
    make(scene, `plate-${state}`, T, T, (g) => {
      const on = state === 'pressed';
      g.fillStyle(0x0b1026, 0.55);
      g.fillRoundedRect(14, 14, T - 28, T - 28, 12);
      g.fillStyle(on ? C.exit : C.dim, on ? 0.9 : 0.8);
      g.fillRoundedRect(18, on ? 20 : 18, T - 36, T - 36, 10);
      g.lineStyle(3, 0xffffff, on ? 0.7 : 0.3);
      g.strokeRoundedRect(18, on ? 20 : 18, T - 36, T - 36, 10);
      g.fillStyle(0xffffff, on ? 0.9 : 0.4);
      g.fillTriangle(T / 2, 34, T / 2 - 9, 50, T / 2 + 9, 50); // down-pointing chevron ("press here")
    });
  }

  for (const state of ['closed', 'open'] as const) {
    make(scene, `door-${state}`, T, T, (g) => {
      if (state === 'closed') {
        g.fillStyle(0x000000, 0.35);
        g.fillRoundedRect(8, 14, T - 16, T - 10, 10);
        g.fillStyle(0x6b4a2a, 1);
        g.fillRoundedRect(8, 6, T - 16, T - 14, 10);
        g.fillStyle(0x8a6238, 1);
        for (let i = 0; i < 3; i++) g.fillRoundedRect(14, 12 + i * 22, T - 28, 15, 5);
        g.fillStyle(0xffd27d, 1);
        g.fillCircle(T / 2, T / 2 + 2, 9); // padlock body
        g.lineStyle(4, 0xffd27d, 1);
        g.strokeCircle(T / 2, T / 2 - 8, 6);
        g.fillStyle(0x3b2410, 1);
        g.fillRect(T / 2 - 1.5, T / 2, 3, 6);
      } else {
        g.fillStyle(0x6b4a2a, 0.9);
        g.fillRoundedRect(8, 6, 10, T - 14, 5);
        g.fillRoundedRect(T - 18, 6, 10, T - 14, 5);
        g.fillStyle(C.exit, 0.18);
        g.fillRoundedRect(18, 8, T - 36, T - 20, 6);
      }
    });
  }

  for (const [id, look] of Object.entries(SWITCH_LOOK)) {
    for (const on of [false, true]) {
      make(scene, `${id}-${on ? 'on' : 'off'}`, T, T, (g) => {
        g.fillStyle(0x000000, 0.35);
        g.fillEllipse(T / 2, T - 14, 60, 14);
        g.fillStyle(0x2a3475, 1);
        g.fillRoundedRect(14, 40, T - 28, 38, 12); // plinth
        g.fillStyle(0x4a58b8, 1);
        g.fillRoundedRect(14, 34, T - 28, 38, 12);
        if (on) glow(g, T / 2, 40, 22, look.color, 0.4);
        g.fillStyle(look.color, on ? 1 : 0.62);
        shapeIcon(g, look.shape, T / 2, 38, 17);
        if (on) {
          g.fillStyle(0xffffff, 0.55);
          g.fillCircle(T / 2 - 5, 32, 4);
        }
      });
    }
  }

  for (const spent of [false, true]) {
    make(scene, `tripwire-${spent ? 'spent' : 'armed'}`, T, T, (g) => {
      const col = spent ? C.dim : C.discovery;
      g.lineStyle(4, col, spent ? 0.5 : 1);
      for (let i = 0; i < 8; i++) {
        const a0 = (Math.PI / 4) * i;
        g.beginPath();
        g.arc(T / 2, T / 2, 24, a0, a0 + 0.45);
        g.strokePath();
      }
      g.fillStyle(col, spent ? 0.4 : 0.9);
      g.fillPoints(
        [
          { x: T / 2, y: T / 2 - 11 },
          { x: T / 2 + 9, y: T / 2 },
          { x: T / 2, y: T / 2 + 11 },
          { x: T / 2 - 9, y: T / 2 },
        ],
        true,
      );
    });
  }

  make(scene, 'spark', 16, 16, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 6);
  });
}
