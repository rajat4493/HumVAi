import { useEffect, useRef, useState } from 'react';
import type { ChallengeDefinition } from '@hva/game-core';
import { ActorCard } from '../components/ActorCard';
import { BudgetPips } from '../components/BudgetPips';
import { Dpad } from '../components/Dpad';
import { GameController } from '../game/controller';
import type { Snapshot } from '../game/controller';

export function Arena({ challenge, skipBriefing }: { challenge: ChallengeDefinition; skipBriefing: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<GameController | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [briefing, setBriefing] = useState(!skipBriefing);

  useEffect(() => {
    if (!host.current) return;
    const c = new GameController(host.current, challenge);
    ctl.current = c;
    const off = c.subscribe(setSnap);
    return () => {
      off();
      c.destroy();
      ctl.current = null;
    };
  }, [challenge]);

  const obs = snap?.obs;
  const status = obs?.status ?? 'playing';
  const dispatch = ctl.current?.dispatch.bind(ctl.current);

  return (
    <div className="arena">
      <header className="hud">
        <div className="title">
          <small>World {challenge.id.slice(1, 3)} · The Experiment</small>
          <h2>{challenge.name}</h2>
        </div>
        {obs && <BudgetPips budget={obs.budget} used={obs.actionsUsed} />}
      </header>

      <ActorCard side="human" name="You" role="Exploring. Every action spends budget." stat={obs ? `${obs.actionsRemaining} left` : ''} />

      <div className="board">
        <div className="board-frame" />
        <div ref={host} style={{ position: 'absolute', inset: 0 }} data-testid="board" />
      </div>

      <ActorCard side="ai" name="The AI" role="Plays the same world on its own. Its recorded attempt arrives in a later milestone." stat="not yet in this build" />

      <Dpad
        onMove={(direction) => dispatch?.({ type: 'MOVE', direction })}
        onAct={() => ctl.current?.interact()}
        onReset={() => dispatch?.({ type: 'RESET' })}
      />

      {briefing && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Challenge briefing">
          <div className="card">
            <div className="kicker">Briefing</div>
            <h2>{challenge.name}</h2>
            <p>{challenge.briefing}</p>
            <p className="legend">
              <span>Arrows / WASD: move</span>
              <span>Space: interact</span>
              <span>R: reset (costs 1)</span>
            </p>
            <div className="row">
              <button className="btn" autoFocus onClick={() => setBriefing(false)}>
                Begin
              </button>
            </div>
          </div>
        </div>
      )}

      {!briefing && status !== 'playing' && obs && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Result">
          <div className="card">
            <div className="kicker">{status === 'won' ? 'Exit reached' : 'Out of actions'}</div>
            <h2 className={status === 'won' ? 'win-title' : 'lose-title'}>{status === 'won' ? 'Humanity scores.' : 'Not this time.'}</h2>
            <div className="compare">
              <div>
                <small>You</small>
                <b>{obs.actionsUsed}</b>
                <small>actions</small>
              </div>
              <div>
                <small>The AI</small>
                <b>?</b>
                <small>recorded run in M2</small>
              </div>
            </div>
            <div className="row">
              <button className="btn" autoFocus onClick={() => ctl.current?.restart()}>
                Try again
              </button>
              <button className="btn ghost" disabled title="Next worlds arrive in M1">
                Next world
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
