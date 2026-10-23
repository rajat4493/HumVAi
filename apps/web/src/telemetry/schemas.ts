import { registerGameSchema, shape, v } from './envelope';

/**
 * Event vocabularies of the games that use the neutral envelope. Registered eagerly (they are tiny) so stored events from an
 * earlier visit validate before a game's code is loaded. The Experiment's vocabulary lives in envelope.ts.
 * Numbers, booleans and short ids only: nothing the player types can be recorded.
 */
registerGameSchema('pattern-hunter', {
  run_start: shape({ probe_budget: v.int, examples: v.int }),
  probe: shape({ n: v.int, fits: v.bool, probes_left: v.int }),
  predict_start: shape({ probes_used: v.int }),
  submit: shape({ correct: v.int, total: v.int, solved: v.bool, probes_used: v.int, said_yes: v.intList(40) }),
  reset: shape({ after_submit: v.bool }),
});

/**
 * DON'T PRESS THAT. Everything is a number, a flag or one of a few fixed words. Inputs are run-length encoded as `keys + 16 * ticks`
 * (keys: 1 left, 2 right, 4 jump), capped at 240 runs. Predictions carry only their id and whether they came true.
 */
const personality = v.oneOf('playful', 'edge', 'chaos');
const cause = v.oneOf('spike', 'drop', 'zone', 'beam', 'pit');
registerGameSchema('dont-press-that', {
  attempt_start: shape({ attempt: v.int, mode: v.oneOf('none', 'lead', 'camp'), personality, host_muted: v.bool }),
  death: shape({ attempt: v.int, cause, x10: v.int, y10: v.int, ticks: v.int, still_max: v.int }),
  respawn: shape({ attempt: v.int, latency_ms: v.int }),
  retry_input: shape({ attempt: v.int, time_to_retry_ms: v.int }),
  restart: shape({ attempt: v.int, ticks: v.int }),
  complete: shape({ attempt: v.int, ticks: v.int, deaths: v.int }),
  inputs: shape({ attempt: v.int, outcome: v.oneOf('death', 'win', 'restart'), runs: v.intList(240) }),
  prediction: shape({ pid: v.id, verdict: v.oneOf('correct', 'wrong', 'void'), attempt: v.int }),
  hint: shape({ tier: v.int }),
  skip: shape({ level: v.int }),
  feedback: shape({ level: v.int, fair: v.oneOf('fair', 'unfair', 'skip'), fun: v.oneOf('fun', 'meh', 'skip') }),
  share: shape({ ok: v.bool }),
});
