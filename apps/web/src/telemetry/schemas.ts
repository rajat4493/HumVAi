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
