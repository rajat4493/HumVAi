import { useState } from 'react';
import { BackIcon } from '../../components/icons';
import { ScrollMain } from '../../components/ScrollMain';
import { TONES, TONE_LABEL, TONE_NOTE } from './lines';
import { LEVELS } from './levels';
import { run } from './runState';
import { loadDpt, resetDpt, resultsText, setSettings, unlockedUpTo } from './storage';

interface Props {
  onBack: () => void;
  onPlay: (n: number) => void;
  unlockAll: boolean;
}

export function Menu({ onBack, onPlay, unlockAll }: Props) {
  const [save, setSave] = useState(loadDpt);
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  const ids = LEVELS.map((l) => l.id);
  const open = unlockAll ? LEVELS.length : unlockedUpTo(save, ids);
  const next = Math.min(open, LEVELS.length);
  const started = Object.values(save.levels).some((r) => r.attempts > 0);
  return (
    <ScrollMain className="dpt-menu" aria-label="Don't Press That" data-testid="dpt-menu">
      <header className="dpt-menu-top">
        <button className="icon-btn" aria-label="Back to the arcade" onClick={onBack} data-testid="dpt-arcade">
          <BackIcon />
        </button>
        <span className="badge experimental">Playable slice · 5 levels</span>
      </header>
      <h1 className="dpt-logo display">
        DON'T <span>PRESS</span> THAT
      </h1>
      <p className="dpt-sub">A smug AI host predicts you will fail. Five small levels. Prove him wrong, then press the button he begged you not to.</p>
      <div className="dpt-cta">
        <button className="btn" onClick={() => onPlay(next)} data-testid="dpt-play" data-autofocus>
          {started ? `Continue: level ${next}` : 'Play'}
        </button>
      </div>
      <ol className="dpt-levels" aria-label="Levels">
        {LEVELS.map((l) => {
          const r = save.levels[l.id];
          const locked = l.n > open;
          return (
            <li key={l.id}>
              <button className={`dpt-node${r?.cleared ? ' done' : ''}`} disabled={locked} onClick={() => onPlay(l.n)} data-testid={`dpt-level-${l.n}`} aria-label={`Level ${l.n}: ${l.name}${locked ? ' (locked)' : r?.cleared ? ' (cleared)' : ''}`}>
                <span className="dpt-num">{l.n}</span>
                <span className="dpt-nm">{l.name}</span>
                <span className="dpt-meta">{locked ? 'Locked' : r?.cleared ? `Cleared · ${r.deaths} death${r.deaths === 1 ? '' : 's'}` : r?.skipped ? 'Skipped' : r && r.attempts > 0 ? `${r.deaths} death${r.deaths === 1 ? '' : 's'} so far` : 'New'}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <section className="panel" aria-labelledby="dpt-how-h">
        <h2 id="dpt-how-h">How to play</h2>
        <p>
          Move with <kbd>←</kbd> <kbd>→</kbd> (or A and D). Jump with <kbd>Space</kbd>. Restart with <kbd>R</kbd>. On a phone, use the buttons under the level.
        </p>
        <p className="note">You will die. You come back in a quarter of a second. Every trap does the same thing every time, so each death teaches you something.</p>
      </section>

      <section className="panel" aria-labelledby="dpt-host-h">
        <h2 id="dpt-host-h">The host</h2>
        <div role="radiogroup" aria-labelledby="dpt-host-h" className="radio-row">
          {TONES.map((t) => (
            <button key={t} role="radio" aria-checked={save.settings.tone === t} className={`chip${save.settings.tone === t ? ' on' : ''}`} data-testid={`dpt-menu-tone-${t}`} onClick={() => setSave(setSettings({ tone: t }))}>
              {TONE_LABEL[t]}
            </button>
          ))}
        </div>
        <p className="note">{TONE_NOTE[save.settings.tone]}</p>
        <div className="setting-row">
          <span id="dpt-menu-mute-l">Mute the host (you can still play every level)</span>
          <button role="switch" aria-checked={save.settings.muted} aria-labelledby="dpt-menu-mute-l" className={`switch${save.settings.muted ? ' on' : ''}`} data-testid="dpt-menu-mute" onClick={() => setSave(setSettings({ muted: !save.settings.muted }))}>
            <span className="knob" />
          </button>
        </div>
        <p className="note">
          His lines are written in advance and picked by what you actually do. Nothing is sent anywhere, and no AI model is running. His predictions are checked against what really happened, and his score is shown.
        </p>
      </section>

      {started ? (
        <section className="panel" aria-labelledby="dpt-res-h">
          <h2 id="dpt-res-h">Helping test this game?</h2>
          <p className="note">This copies a short summary of numbers (levels, deaths, hints, your ratings) so you can paste it where the tester asked. Nothing is sent by the game.</p>
          <button
            className="chip"
            data-testid="dpt-copy-results"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(resultsText(save, ids, LEVELS.map((l) => l.name)));
                setCopied('yes');
              } catch {
                setCopied('failed');
              }
            }}
          >
            Copy my results
          </button>
          <p className="note" role="status" data-testid="dpt-copy-status">
            {copied === 'yes' ? 'Copied.' : copied === 'failed' ? 'Your browser would not copy it. Try the arcade settings export instead.' : ''}
          </p>
        </section>
      ) : null}

      {started ? (
        <p className="dpt-erase">
          {confirm ? (
            <>
              Erase this game's progress?{' '}
              <button
                className="link-btn"
                onClick={() => {
                  run.reset();
                  setSave(resetDpt());
                  setConfirm(false);
                }}
                data-testid="dpt-erase-yes"
              >
                Yes, erase
              </button>{' '}
              <button className="link-btn" onClick={() => setConfirm(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button className="link-btn" onClick={() => setConfirm(true)} data-testid="dpt-erase">
              Erase this game's progress
            </button>
          )}
        </p>
      ) : null}
    </ScrollMain>
  );
}
