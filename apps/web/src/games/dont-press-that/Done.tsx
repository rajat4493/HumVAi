import { useState } from 'react';
import { ScrollMain } from '../../components/ScrollMain';
import { emitDpt } from './events';
import { LEVELS } from './levels';
import { run } from './runState';
import { loadDpt } from './storage';

interface Props {
  onMenu: () => void;
  onArcade: () => void;
  onAgain: () => void;
}

const LINK = (): string => `${window.location.origin}${window.location.pathname}#/dont-press-that`;

export function Done({ onMenu, onArcade, onAgain }: Props) {
  const save = loadDpt();
  const live = run.ledger.counts();
  const fromSave = save.predictions;
  const correct = live.correct + live.wrong > 0 ? live.correct : fromSave.correct;
  const wrong = live.correct + live.wrong > 0 ? live.wrong : fromSave.wrong;
  const total = correct + wrong;
  const deaths = Object.values(save.levels).reduce((n, r) => n + r.deaths, 0);
  const skipped = Object.values(save.levels).filter((r) => r.skipped).length;
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  const summary = `I switched off Professor Probably in DON'T PRESS THAT: ${deaths} death${deaths === 1 ? '' : 's'}. He predicted ${total} things and got ${correct} right. Can you do better? ${LINK()}`;
  const share = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied('yes');
      emitDpt(LEVELS[4]!, 'share', { ok: true });
    } catch {
      setCopied('failed');
      emitDpt(LEVELS[4]!, 'share', { ok: false });
    }
  };
  return (
    <ScrollMain className="dpt-menu dpt-end" aria-label="You beat the host" data-testid="dpt-end">
      <h1 className="dpt-logo display">
        He is <span>off.</span>
      </h1>
      <p className="dpt-sub">You pressed the button he told you not to press. It was the off switch. Naturally.</p>
      <dl className="finale-stats" data-testid="dpt-end-stats">
        <div>
          <dt>Deaths on the way</dt>
          <dd>{deaths}</dd>
        </div>
        <div>
          <dt>His predictions</dt>
          <dd data-testid="dpt-end-pred">{total === 0 ? 'none judged' : `${correct} of ${total} came true`}</dd>
        </div>
        <div>
          <dt>Levels skipped</dt>
          <dd>{skipped}</dd>
        </div>
      </dl>
      <p className="note">The numbers above are counted from what happened on screen. His accuracy is not adjusted.</p>
      <div className="dpt-cta">
        <button className="btn" onClick={() => void share()} data-testid="dpt-share" data-autofocus>
          Challenge a friend
        </button>
        <button className="btn ghost" onClick={onAgain} data-testid="dpt-again">
          Play again from the start
        </button>
        <button className="btn ghost" onClick={onMenu}>
          Level list
        </button>
        <button className="btn ghost" onClick={onArcade}>
          Back to the arcade
        </button>
      </div>
      <p className="note" role="status" data-testid="dpt-copied">
        {copied === 'yes' ? 'Copied. Paste it to a friend.' : copied === 'failed' ? `Your browser would not copy it. Here it is: ${summary}` : 'This copies a sentence and a link to your clipboard. Nothing is uploaded.'}
      </p>
    </ScrollMain>
  );
}
