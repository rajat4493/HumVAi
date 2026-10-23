// Design bench for DON'T PRESS THAT: solve every level in each beam mode and print what the solver found.
import { LEVELS } from '../apps/web/src/games/dont-press-that/levels';
import { solve, fixedPlayer } from '../apps/web/src/games/dont-press-that/solver';
import { KEY, replay } from '../apps/web/src/games/dont-press-that/sim';

const brief = (e: { type: string } & Record<string, unknown>) => `${e.t}:${e.type}${e.cause ? '(' + e.cause + ')' : ''}${typeof e.x === 'number' ? '@' + (e.x as number).toFixed(1) : ''}${e.id ? ':' + e.id : ''}${typeof e.aim === 'number' ? '->' + (e.aim as number).toFixed(1) : ''}${e.hit !== undefined ? ' hit=' + e.hit : ''}`;
for (const level of LEVELS) {
  for (const mode of level.beams === 'adaptive' ? (['lead', 'camp'] as const) : (['lead'] as const)) {
    const t0 = Date.now();
    const r = solve(level, mode, { maxNodes: Number(process.env.NODES ?? 150000) });
    console.log(`\n${level.id} [${mode}] solved=${r.solved} ticks=${r.ticks} (${(r.ticks / 60).toFixed(1)}s) nodes=${r.nodes} in ${Date.now() - t0} ms`);
    if (r.solved) console.log('  solution events:', replay(level, r.inputs, mode).events.map((e) => brief(e as never)).join('  '));
    const run = fixedPlayer(level, () => KEY.R, 900, mode);
    console.log('  hold-right player:', run.won ? 'WINS' : run.dead ? `dies (${run.dead.cause}) at x=${run.dead.x.toFixed(1)} t=${run.tick}` : 'stuck');
    const jumpy = fixedPlayer(level, (t) => KEY.R | (t % 40 < 8 ? KEY.J : 0), 900, mode);
    console.log('  hop-right player :', jumpy.won ? 'WINS' : jumpy.dead ? `dies (${jumpy.dead.cause}) at x=${jumpy.dead.x.toFixed(1)}` : 'stuck');
  }
}
