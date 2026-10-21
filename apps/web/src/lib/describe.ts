import type { PublicEntity, PublicGameState } from '@hva/game-core';

const kindName: Record<PublicEntity['kind'], string> = { door: 'door', switch: 'switch', plate: 'pressure plate', block: 'movable block', tripwire: 'glowing rune' };
const nice = (id: string) => id.replace(/^(switch|door|plate|block|tripwire)-/, '').replace(/-/g, ' ');

const where = (p: { x: number; y: number }) => `column ${p.x + 1}, row ${p.y + 1}`;

function relative(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return 'on your tile';
  const parts: string[] = [];
  if (dy !== 0) parts.push(`${Math.abs(dy)} ${Math.abs(dy) === 1 ? 'tile' : 'tiles'} ${dy < 0 ? 'up' : 'down'}`);
  if (dx !== 0) parts.push(`${Math.abs(dx)} ${Math.abs(dx) === 1 ? 'tile' : 'tiles'} ${dx < 0 ? 'left' : 'right'}`);
  return parts.join(' and ');
}

/**
 * A complete plain-language description of the public state, built only from what the player may know.
 * It is the text equivalent of the board for screen-reader users and anyone who wants it spelled out.
 */
export function describeBoard(o: PublicGameState): string[] {
  const lines: string[] = [];
  lines.push(`The world is ${o.width} columns wide and ${o.height} rows tall. Row 1 is the top.`);
  lines.push(`You are at ${where(o.player)}. The exit is at ${where(o.exit)}, ${relative(o.player, o.exit)}.`);
  const open: string[] = [];
  for (let y = 0; y < o.height; y++) {
    const cols: number[] = [];
    for (let x = 0; x < o.width; x++) if (o.tiles[y]?.[x] === '.') cols.push(x + 1);
    if (cols.length) open.push(`row ${y + 1}: columns ${cols.join(', ')}`);
  }
  lines.push(`Open floor (not walls): ${open.join('; ')}.`);
  for (const e of o.entities) {
    const state = e.state === 'static' ? '' : `, ${e.state}`;
    lines.push(`A ${kindName[e.kind]} (${nice(e.id)}) at ${where(e.pos)}, ${relative(o.player, e.pos)}${state}.`);
  }
  lines.push(
    o.phase === 'explore'
      ? `You are scouting: ${o.scout.used} of ${o.scout.budget} scouting actions used. Reset is free. Nothing can be won or lost until you start the run.`
      : `You are in the run: ${o.run.used} of ${o.run.budget} run actions used.`,
  );
  if (o.epoch >= 1) lines.push('The world has changed its rules.');
  return lines;
}
