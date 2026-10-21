import { useEffect, useRef, useState } from 'react';
import type { ChallengeDefinition } from '@hva/game-core';
import { ActorCard } from '../components/ActorCard';
import { BudgetPips } from '../components/BudgetPips';
import { Dpad } from '../components/Dpad';
import { GameController } from '../game/controller';
import type { Snapshot } from '../game/controller';

interface Props {
  challenge: ChallengeDefinition;
  index: number;
  total: number;
  skipBriefing: boolean;
  onNext: (() => void) | null;
}

export function Arena({ challenge, index, total, skipBriefing, onNext }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<GameController | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [briefing, setBriefing] = useState(!skipBriefing);
  const [toast, setToast] = useState<string | null>(null);
  const scouts = challenge.budget.explore > 0;

  useEffect(() => {
    if (!host.current) return;
    const c = new GameController(host.current, challenge);
    ctl.current = c;
    const off = c.subscribe((s) => {
      setSnap(s);
      const committed = s.events.find((e) => e.type === 'COMMITTED');
      if (committed && committed.type === 'COMMITTED') {
        setToast(
          committed.reason === 'exit-found'
            ? 'You found the exit. The world has reset: now do it for real.'
            : committed.reason === 'scout-spent'
              ? 'Scouting spent. The world has reset: the run begins.'
              : 'The run begins. The world has reset; what you learned stays with you.',
        );
      } else if (s.events.some((e) => e.type === 'NO_EFFECT')) {
        setToast('Nothing happened.');
      } else if (s.events.some((e) => e.type === 'EPOCH_CHANGED')) {
        setToast('The world just changed.');
      }
    });
    return () => {
      off();
      c.destroy();
      ctl.current = null;
    };
  }, [challenge]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const obs = snap?.obs;
  const status = obs?.status ?? 'playing';
  const phase = obs?.phase ?? (scouts ? 'explore' : 'execute');
  const dispatch = ctl.current?.dispatch.bind(ctl.current);
  const current = obs ? (phase === 'explore' ? obs.scout : obs.run) : null;

  return (
    <div className={`arena ${phase}${obs && obs.epoch >= 1 ? ' shifted' : ''}`}>
      <header className="hud">
        <div className="title">
          <small>
            World {index + 1} of {total}
          </small>
          <h2>{challenge.name}</h2>
        </div>
        <div className="budget">
          {obs && (
            <span className={`phase-pill ${phase}`} data-testid="phase">
              {phase === 'explore' ? 'Scout' : 'Run'}
            </span>
          )}
          {obs && current && <BudgetPips phase={phase} budget={current.budget} used={current.used} />}
          {phase === 'explore' && (
            <button className="btn small" data-testid="start-run" onClick={() => ctl.current?.commit()}>
              Start run
            </button>
          )}
        </div>
      </header>

      <ActorCard
        side="human"
        name="You"
        role={phase === 'explore' ? 'Scouting: experiment freely. Reset is free.' : 'Running: every action counts.'}
        stat={obs ? `${obs.actionsRemaining} left` : ''}
      />

      <div className="board">
        <div className="board-frame" />
        <div ref={host} style={{ position: 'absolute', inset: 0 }} data-testid="board" />
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>

      <ActorCard
        side="ai"
        name="The AI"
        role="Gets the same world, the same scouting and the same run budget. Its recorded attempt arrives in a later milestone."
        stat={scouts ? `Scout ${challenge.budget.explore} · Run ${challenge.budget.execute}` : `Run ${challenge.budget.execute}`}
      />

      <Dpad
        onMove={(direction) => dispatch?.({ type: 'MOVE', direction })}
        onAct={() => ctl.current?.interact()}
        onReset={() => dispatch?.({ type: 'RESET' })}
        onCommit={phase === 'explore' ? () => ctl.current?.commit() : null}
      />

      {briefing && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Challenge briefing">
          <div className="card">
            <div className="kicker">Briefing</div>
            <h2>{challenge.name}</h2>
            <p>{challenge.briefing}</p>
            {scouts ? (
              <p className="rules">
                <b>Scout</b> up to {challenge.budget.explore} actions, resets are free. Then <b>Run</b> with {challenge.budget.execute} actions on a fresh world.
              </p>
            ) : (
              <p className="rules">
                You have <b>{challenge.budget.execute}</b> actions.
              </p>
            )}
            <p className="legend">
              <span>Arrows / WASD: move</span>
              <span>Space: interact</span>
              <span>R: reset</span>
              {scouts && <span>C: start run</span>}
            </p>
            <div className="row">
              <button className="btn" autoFocus onClick={() => setBriefing(false)}>
                {scouts ? 'Start scouting' : 'Begin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!briefing && status !== 'playing' && obs && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Result">
          <div className="card">
            <div className="kicker">{status === 'won' ? 'Exit reached' : 'Out of actions'}</div>
            <h2 className={status === 'won' ? 'win-title' : 'lose-title'}>{status === 'won' ? 'You made it out.' : 'Not this time.'}</h2>
            <div className="compare">
              <div>
                <small>You · run</small>
                <b>
                  {obs.run.used}
                  <span className="of"> / {obs.run.budget}</span>
                </b>
                <small>{scouts ? `after scouting ${obs.scout.used} of ${obs.scout.budget}` : 'no scouting here'}</small>
              </div>
              <div>
                <small>The AI</small>
                <b>?</b>
                <small>recorded run in M2</small>
              </div>
            </div>
            <div className="row">
              <button className="btn" autoFocus={!onNext || status !== 'won'} onClick={() => ctl.current?.restart()}>
                {status === 'won' ? 'Play again' : 'Try again'}
              </button>
              {onNext && status === 'won' && (
                <button className="btn ghost" autoFocus onClick={onNext}>
                  Next world
                </button>
              )}
            </div>
            {!onNext && status === 'won' && <p className="note">That was the last world in this review build.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
