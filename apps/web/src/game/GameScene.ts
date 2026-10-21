import Phaser from 'phaser';
import type { GameEvent, PublicEntity, PublicGameState } from '@hva/game-core';
import type { GameController } from './controller';
import { buildTextures } from './textures';
import { C, TILE, prefersReducedMotion } from './theme';

type Img = Phaser.GameObjects.Image;

export class GameScene extends Phaser.Scene {
  private ctl!: GameController;
  private board!: Phaser.GameObjects.Container;
  private floors: { img: Img; parity: 'A' | 'B' }[] = [];
  private sprites = new Map<string, Img>();
  private player!: Img;
  private exit!: Img;
  private reduced = false;
  private dims = { w: 1, h: 1 };

  constructor() {
    super('game');
  }

  create(): void {
    this.ctl = this.game.registry.get('controller') as GameController;
    this.reduced = prefersReducedMotion();
    buildTextures(this);
    this.board = this.add.container(0, 0);
    this.build(this.ctl.observe());
    this.scale.on('resize', () => this.layout());
    this.layout();
    this.bindInput();
    this.ctl.attach(this);
  }

  private bindInput(): void {
    // swipe to move
    let down: { x: number; y: number } | null = null;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (down = { x: p.x, y: p.y }));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!down) return;
      const dx = p.x - down.x;
      const dy = p.y - down.y;
      down = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : dy > 0 ? 'DOWN' : 'UP';
      this.ctl.dispatch({ type: 'MOVE', direction: dir });
    });
  }

  private cell(x: number, y: number): { x: number; y: number } {
    return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
  }

  private build(o: PublicGameState): void {
    this.board.removeAll(true);
    this.sprites.clear();
    this.floors = [];
    this.dims = { w: o.width * TILE, h: o.height * TILE + 16 };

    for (let y = 0; y < o.height; y++) {
      for (let x = 0; x < o.width; x++) {
        if (o.tiles[y]?.[x] === '#') continue;
        const parity = (x + y) % 2 ? 'A' : 'B';
        const f = this.add.image(x * TILE, y * TILE, `floor${parity}`).setOrigin(0, 0);
        f.setDepth(0);
        this.floors.push({ img: f, parity });
        this.board.add(f);
      }
    }

    this.exit = this.add.image(0, 0, 'exit').setDepth(1);
    const ec = this.cell(o.exit.x, o.exit.y);
    this.exit.setPosition(ec.x, ec.y);
    this.board.add(this.exit);
    if (!this.reduced) {
      this.tweens.add({ targets: this.exit, scale: { from: 0.94, to: 1.08 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.tweens.add({ targets: this.exit, angle: 360, duration: 14000, repeat: -1 });
    }

    for (let y = 0; y < o.height; y++) {
      for (let x = 0; x < o.width; x++) {
        if (o.tiles[y]?.[x] !== '#') continue;
        const w = this.add.image(x * TILE, y * TILE, 'wall').setOrigin(0, 0).setDepth(y * 10 + 5);
        this.board.add(w);
      }
    }

    for (const e of o.entities) {
      const c = this.cell(e.pos.x, e.pos.y);
      const img = this.add.image(c.x, c.y, this.textureFor(e)).setDepth(e.kind === 'plate' || e.kind === 'tripwire' ? 2 : e.pos.y * 10 + 6);
      this.sprites.set(e.id, img);
      this.board.add(img);
    }

    const pc = this.cell(o.player.x, o.player.y);
    this.player = this.add.image(pc.x, pc.y, 'human').setDepth(o.player.y * 10 + 7);
    this.board.add(this.player);
    this.board.sort('depth');
    this.sync(o);
  }

  private textureFor(e: PublicEntity): string {
    switch (e.kind) {
      case 'door':
        return `door-${e.state === 'open' ? 'open' : 'closed'}`;
      case 'switch':
        return `${e.id}-${e.state === 'on' ? 'on' : 'off'}`;
      case 'plate':
        return `plate-${e.state === 'pressed' ? 'pressed' : 'idle'}`;
      case 'tripwire':
        return `tripwire-${e.state === 'spent' ? 'spent' : 'armed'}`;
      case 'block':
        return 'block';
    }
  }

  /** Idempotent: snaps every non-moving visual to the observed state. */
  private sync(o: PublicGameState): void {
    for (const e of o.entities) {
      const s = this.sprites.get(e.id);
      if (!s) continue;
      const tex = this.textureFor(e);
      if (s.texture.key !== tex) s.setTexture(tex);
    }
    const theme = o.epoch >= 1 ? 'Shift' : o.phase === 'explore' ? 'Scout' : '';
    this.floors.forEach((f) => {
      const key = `floor${theme}${f.parity}`;
      if (f.img.texture.key !== key) f.img.setTexture(key);
    });
  }

  private layout(): void {
    const { width, height } = this.scale;
    const pad = Math.min(width, height) * 0.04;
    const s = Math.min((width - pad * 2) / this.dims.w, (height - pad * 2) / this.dims.h);
    this.board.setScale(s);
    this.board.setPosition((width - this.dims.w * s) / 2, (height - this.dims.h * s) / 2);
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): void {
    if (this.reduced) {
      const t = cfg.targets as Img;
      if (typeof cfg.x === 'number') t.x = cfg.x;
      if (typeof cfg.y === 'number') t.y = cfg.y;
      return;
    }
    this.tweens.add(cfg);
  }

  /** Cause-and-effect animation for one step; always ends by syncing to truth. */
  present(events: GameEvent[], o: PublicGameState): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'MOVED': {
          const c = this.cell(ev.to.x, ev.to.y);
          this.player.setDepth(ev.to.y * 10 + 7);
          this.tweens.killTweensOf(this.player);
          this.tween({ targets: this.player, x: c.x, y: c.y, duration: 120, ease: 'Quad.out' });
          this.squash(this.player);
          break;
        }
        case 'PUSHED': {
          const b = this.sprites.get(ev.id);
          if (b) {
            const c = this.cell(ev.to.x, ev.to.y);
            b.setDepth(ev.to.y * 10 + 6);
            this.tweens.killTweensOf(b);
            this.tween({ targets: b, x: c.x, y: c.y, duration: 140, ease: 'Quad.out' });
          }
          break;
        }
        case 'BLOCKED': {
          const dx = Math.sign(ev.at.x - o.player.x);
          const dy = Math.sign(ev.at.y - o.player.y);
          this.bump(this.player, dx, dy);
          break;
        }
        case 'PULLED': {
          const b = this.sprites.get(ev.id);
          if (b) {
            const c = this.cell(ev.to.x, ev.to.y);
            b.setDepth(ev.to.y * 10 + 6);
            this.tweens.killTweensOf(b);
            this.tween({ targets: b, x: c.x, y: c.y, duration: 140, ease: 'Quad.out' });
          }
          break;
        }
        case 'COMMITTED':
          this.cameras.main.fadeIn(320, 11, 16, 38);
          break;
        case 'SWITCH_TOGGLED':
          this.pulse(this.sprites.get(ev.id));
          break;
        case 'NO_EFFECT':
          this.shake(this.sprites.get(ev.targetId));
          break;
        case 'DOOR_OPENED':
        case 'DOOR_CLOSED':
          this.pulse(this.sprites.get(ev.id), 1.18);
          break;
        case 'EPOCH_CHANGED':
          this.cameras.main.flash(380, 183, 140, 255);
          break;
        case 'RESET':
          this.cameras.main.fadeIn(220, 11, 16, 38);
          break;
        case 'WON':
          this.celebrate();
          break;
        case 'LOST':
          this.cameras.main.shake(160, 0.004);
          break;
        default:
          break;
      }
    }
    if (events.some((e) => e.type === 'RESET' || e.type === 'COMMITTED')) this.build(o);
    else {
      this.board.sort('depth');
      this.sync(o);
    }
  }

  private squash(img: Img): void {
    if (this.reduced) return;
    img.setScale(1.12, 0.88);
    this.tweens.add({ targets: img, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.out' });
  }
  private pulse(img: Img | undefined, to = 1.25): void {
    if (!img || this.reduced) return;
    this.tweens.add({ targets: img, scale: { from: 1, to }, duration: 110, yoyo: true, ease: 'Quad.out' });
  }
  private shake(img: Img | undefined): void {
    if (!img || this.reduced) return;
    const x = img.x;
    this.tweens.add({ targets: img, x: { from: x - 5, to: x + 5 }, duration: 55, yoyo: true, repeat: 2, onComplete: () => (img.x = x) });
  }
  private bump(img: Img, dx: number, dy: number): void {
    if (this.reduced) return;
    const { x, y } = img;
    this.tweens.killTweensOf(img);
    this.tweens.add({ targets: img, x: x + dx * 9, y: y + dy * 9, duration: 70, yoyo: true, ease: 'Quad.out', onComplete: () => img.setPosition(x, y) });
  }

  private celebrate(): void {
    if (this.reduced) return;
    const c = { x: this.exit.x, y: this.exit.y };
    const colors = [C.human, C.exit, C.discovery, C.ai, 0xffffff];
    for (let i = 0; i < 36; i++) {
      const p = this.add.image(c.x, c.y, 'spark').setTint(colors[i % colors.length] as number).setDepth(9999).setScale(0.6 + Math.random() * 0.7);
      this.board.add(p);
      const a = (Math.PI * 2 * i) / 36 + Math.random() * 0.4;
      const d = 90 + Math.random() * 130;
      this.tweens.add({
        targets: p,
        x: c.x + Math.cos(a) * d,
        y: c.y + Math.sin(a) * d - 20,
        alpha: 0,
        duration: 650 + Math.random() * 400,
        ease: 'Cubic.out',
        onComplete: () => p.destroy(),
      });
    }
    this.tweens.add({ targets: this.player, scale: { from: 1, to: 1.3 }, duration: 160, yoyo: true, repeat: 1 });
  }
}
