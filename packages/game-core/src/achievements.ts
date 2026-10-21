import type { RunAnalysis } from './analysis';

export interface RunContext {
  levelId: string;
  analysis: RunAnalysis;
  /** Shortest possible run for this world (from the solver). */
  optimalLength: number;
  hintsUsed: number;
}

export interface Achievement {
  id: string;
  name: string;
  /** Shown once earned. */
  description: string;
  /** Shown while locked, without spoiling the rule. */
  teaser: string;
  /** Awarded from a single verified (replayed) winning run, unassisted. */
  check: (c: RunContext) => boolean;
}

const won = (c: RunContext) => c.analysis.outcome.won && c.hintsUsed === 0;
const sawInScout = (c: RunContext, pred: (e: RunAnalysis['events'][number]['event']) => boolean) => c.analysis.events.some((x) => x.phase === 'explore' && pred(x.event));

/** Per-run achievements. Each is re-derived by replaying the stored action log, so it is verifiable on the device. */
export const RUN_ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-exit', name: 'Out of the Garden', description: 'Reached the exit of a world on your own.', teaser: 'Win a world without hints.', check: won },
  { id: 'shortest-path', name: 'Shortest Path', description: 'Matched the shortest possible run.', teaser: 'Win a world in the fewest possible actions.', check: (c) => won(c) && c.analysis.outcome.runActions === c.optimalLength },
  { id: 'scouts-honor', name: "Scout's Honor", description: 'Learned the world in Scout, then won the Run.', teaser: 'Use Scout before a winning Run.', check: (c) => won(c) && c.analysis.outcome.scoutActions >= 1 },
  { id: 'second-wind', name: 'Second Wind', description: 'Reset during the Run and still got out.', teaser: 'Win a Run after a reset.', check: (c) => won(c) && c.analysis.runResets >= 1 },
  {
    id: 'decoy-detective',
    name: 'Decoy Detective',
    description: 'Tested the switch that does nothing, and still found the right one.',
    teaser: 'Check everything in World 2 before you run.',
    check: (c) => won(c) && c.levelId === 'w02-orange-switch' && sawInScout(c, (e) => e.type === 'SWITCH_TOGGLED' && e.id === 'switch-teal'),
  },
  {
    id: 'hands-on',
    name: 'Hands On',
    description: 'Dragged a block and won.',
    teaser: 'Blocks can be pulled as well as pushed.',
    check: (c) => won(c) && c.levelId === 'w03-locked-garden' && c.analysis.events.some((x) => x.event.type === 'PULLED'),
  },
  {
    id: 'failure-is-information',
    name: 'Failure Is Information',
    description: 'Found out why a switch would not work, then fixed it.',
    teaser: 'Sometimes nothing happening is the clue.',
    check: (c) => won(c) && c.levelId === 'w04-only-when' && sawInScout(c, (e) => e.type === 'NO_EFFECT'),
  },
  {
    id: 'tide-turner',
    name: 'Tide Turner',
    description: 'Saw the world change its rules during Scout, then used it.',
    teaser: 'Something in World 5 changes everything.',
    check: (c) => won(c) && c.levelId === 'w05-garden-shifts' && sawInScout(c, (e) => e.type === 'EPOCH_CHANGED'),
  },
];

/** Achievements that depend on the whole save (evaluated by the app, not a single run). */
export const AGGREGATE_ACHIEVEMENTS = [
  { id: 'no-help', name: 'No Help Needed', description: 'Finished three worlds without a single hint.', teaser: 'Win three worlds unassisted.' },
  { id: 'every-world', name: 'Every World', description: 'Finished every world in this build.', teaser: 'Finish every available world.' },
] as const;

export const ALL_ACHIEVEMENTS: readonly { id: string; name: string; description: string; teaser: string }[] = [...RUN_ACHIEVEMENTS, ...AGGREGATE_ACHIEVEMENTS];

export function earnedFromRun(ctx: RunContext): string[] {
  return RUN_ACHIEVEMENTS.filter((a) => a.check(ctx)).map((a) => a.id);
}
