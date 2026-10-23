import { useEffect, useMemo, useState } from 'react';
import { BackIcon } from '../../components/icons';
import type { GameProps } from '../../suite/contract';
import { CHALLENGES, logOf, newRun, predict, probe, startPrediction, submit, verifyLog } from './engine';
import type { PhChallenge, PhRun } from './engine';
import { emitPh } from './events';
import { loadPh, recordPhResult } from './storage';
import type { PhChallengeRecord } from './storage';

/** The whole game is one screen: look at the examples, test some numbers, predict six more. */
export function PatternHunterGame({ onHome }: GameProps) {
  const challenge = CHALLENGES[0] as PhChallenge;
  const [run, setRun] = useState<PhRun>(() => newRun(challenge));
  const [note, setNote] = useState('');
  const [record, setRecord] = useState<PhChallengeRecord | undefined>(() => loadPh().challenges[challenge.id]);
  const ref = { id: challenge.id, version: challenge.version };

  useEffect(() => {
    emitPh(ref, 'run_start', { probe_budget: challenge.probeBudget, examples: challenge.examples.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per visit to the game
  }, []);

  const numbers = useMemo(() => Array.from({ length: challenge.max - challenge.min + 1 }, (_, i) => challenge.min + i), [challenge]);
  const example = (n: number) => challenge.examples.find((e) => e.n === n);
  const probesLeft = challenge.probeBudget - run.probes.length;

  const doProbe = (n: number) => {
    const r = probe(challenge, run, n);
    if ('error' in r) return;
    setRun(r.run);
    const fits = r.run.revealed[n] as boolean;
    setNote(`${n}: ${fits ? 'the gate lets it through' : 'the gate blocks it'}. ${challenge.probeBudget - r.run.probes.length} test${challenge.probeBudget - r.run.probes.length === 1 ? '' : 's'} left.`);
    emitPh(ref, 'probe', { n, fits, probes_left: challenge.probeBudget - r.run.probes.length });
  };
  const toPredict = () => {
    const r = startPrediction(run);
    if ('error' in r) return;
    setRun(r.run);
    setNote('Now predict what the gate does with each of the six numbers below.');
    emitPh(ref, 'predict_start', { probes_used: run.probes.length });
  };
  const say = (n: number, yes: boolean) => {
    const r = predict(challenge, run, n, yes);
    if (!('error' in r)) setRun(r.run);
  };
  const doSubmit = () => {
    const r = submit(challenge, run);
    if ('error' in r) return;
    // The stored result is re-derived from the log, never taken from the screen state.
    const checked = verifyLog(logOf(r.run));
    if (!checked) return;
    setRun({ ...r.run, result: checked });
    setRecord(recordPhResult(challenge.id, { correct: checked.correct, total: checked.total, probes: checked.probesUsed }).challenges[challenge.id]);
    setNote(checked.solved ? 'You found the rule.' : `${checked.correct} of ${checked.total} right.`);
    emitPh(ref, 'submit', { correct: checked.correct, total: checked.total, solved: checked.solved, probes_used: checked.probesUsed, said_yes: challenge.holdout.filter((n) => run.predictions[n]) });
  };
  const again = () => {
    emitPh(ref, 'reset', { after_submit: run.phase === 'done' });
    setRun(newRun(challenge));
    setNote('Fresh start. The rule has not changed.');
  };

  const result = run.result;
  return (
    <main className="ph" aria-label="Pattern Hunter prototype">
      <header className="map-head">
        <button className="icon-btn" aria-label="Back to the arcade" onClick={onHome} data-testid="ph-home">
          <BackIcon />
        </button>
        <h1 className="display">Pattern Hunter</h1>
        <span />
      </header>

      <p className="ph-proto">
        <span className="badge experimental" data-testid="ph-experimental">
          Experimental prototype
        </span>{' '}
        One small puzzle to test the arcade. Not the finished game.
      </p>
      <p className="ph-brief">{challenge.briefing}</p>

      <div className="ph-status" role="status" aria-live="polite" data-testid="ph-note">
        {note}
      </div>

      <section className="panel" aria-labelledby="ph-ex">
        <h2 id="ph-ex">Examples</h2>
        <ul className="ph-examples">
          {challenge.examples.map((e) => (
            <li key={e.n} className={e.fits ? 'yes' : 'no'} data-testid={`ph-example-${e.n}`}>
              <b>{e.n}</b> <span>{e.fits ? 'let through' : 'blocked'}</span>
            </li>
          ))}
        </ul>
      </section>

      {run.phase !== 'predict' && run.phase !== 'done' && (
        <section className="panel" aria-labelledby="ph-test">
          <h2 id="ph-test">Test a number</h2>
          <p className="note" data-testid="ph-probes-left">
            {probesLeft} test{probesLeft === 1 ? '' : 's'} left. Tap a number to see what the gate does with it.
          </p>
          <div className="ph-grid" role="group" aria-label="Numbers you can test">
            {numbers.map((n) => {
              const ex = example(n);
              const shown = ex ? ex.fits : run.revealed[n];
              const known = ex !== undefined || n in run.revealed;
              return (
                <button
                  key={n}
                  className={`ph-cell${known ? (shown ? ' yes' : ' no') : ''}`}
                  data-testid={`ph-n-${n}`}
                  disabled={known || probesLeft === 0}
                  aria-label={`${n}, ${known ? (shown ? 'let through' : 'blocked') : 'not tested'}`}
                  onClick={() => doProbe(n)}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="row">
            <button className="btn" data-testid="ph-ready" onClick={toPredict}>
              I think I know it
            </button>
          </div>
        </section>
      )}

      {(run.phase === 'predict' || run.phase === 'done') && (
        <section className="panel" aria-labelledby="ph-pred">
          <h2 id="ph-pred">Predict</h2>
          <ul className="ph-predict">
            {challenge.holdout.map((n) => {
              const item = result?.items.find((i) => i.n === n);
              const said = run.predictions[n];
              return (
                <li key={n} className={item ? (item.right ? 'right' : 'wrong') : ''} data-testid={`ph-predict-${n}`}>
                  <b>{n}</b>
                  <div role="radiogroup" aria-label={`Number ${n}`} className="radio-row">
                    {([true, false] as const).map((yes) => (
                      <button key={String(yes)} role="radio" aria-checked={said === yes} disabled={run.phase === 'done'} className={`chip${said === yes ? ' on' : ''}`} data-testid={`ph-say-${n}-${yes ? 'yes' : 'no'}`} onClick={() => say(n, yes)}>
                        {yes ? 'Lets it through' : 'Blocks it'}
                      </button>
                    ))}
                  </div>
                  {item && (
                    <span className="ph-verdict">
                      {item.right ? 'Right' : `Wrong: the gate ${item.truth ? 'lets it through' : 'blocks it'}`}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {run.phase === 'predict' && (
            <div className="row">
              <button className="btn" data-testid="ph-submit" disabled={challenge.holdout.some((n) => run.predictions[n] === undefined)} onClick={doSubmit}>
                Check my answers
              </button>
            </div>
          )}
        </section>
      )}

      {result && (
        <section className="panel" aria-labelledby="ph-result" data-testid="ph-result">
          <h2 id="ph-result">{result.solved ? 'You found the rule' : 'Not quite'}</h2>
          <p>
            {result.correct} of {result.total} right, using {result.probesUsed} test{result.probesUsed === 1 ? '' : 's'}. <b>The rule:</b> {challenge.ruleText}
          </p>
          <p className="note">This result was re-derived from your tests and answers by the same rules, not copied from the screen. It is saved on this device only.</p>
          <div className="row">
            <button className="btn ghost" onClick={onHome}>
              Back to the arcade
            </button>
            <button className="btn" data-testid="ph-again" onClick={again}>
              Try again
            </button>
          </div>
        </section>
      )}

      {record && (
        <p className="note" data-testid="ph-record">
          Your record here: {record.attempts} attempt{record.attempts === 1 ? '' : 's'}, best {record.bestCorrect} of {record.total}
          {record.fewestProbes !== null ? `, solved in as few as ${record.fewestProbes} test${record.fewestProbes === 1 ? '' : 's'}` : ''}.
        </p>
      )}
    </main>
  );
}
