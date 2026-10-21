import Phaser from 'phaser';
import type { BoardController } from './controller';
import { GameScene } from './GameScene';

/** One Phaser board bound to a controller (live play or replay). */
export function createBoard(parent: HTMLElement, controller: BoardController): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    transparent: true,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    scene: [GameScene],
    callbacks: { preBoot: (g) => g.registry.set('controller', controller) },
    render: { antialias: true, roundPixels: false },
    input: { keyboard: false },
  });
}
