import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChallengeDefinition } from '@hva/game-core';
import { ALL_ACHIEVEMENTS, analyzeRun, campaignEntry, solve } from '@hva/game-core';
import type { GameAction } from '@hva/game-core';
import { ActorCard } from '../components/ActorCard';
import { BudgetPips } from '../components/BudgetPips';
import { Dpad } from '../components/Dpad';
import { captionFor } from '../game/caption';
import { describeBoard } from '../lib/describe';
import { BackIcon, BulbIcon, MenuIcon } from '../components/icons';
import { audio } from '../audio/instance';
import { cuesForEvents } from '../audio/cues';
import { Modal } from '../components/Modal';
import { GameController } from '../game/controller';
import type { Snapshot } from '../game/controller';
import { stepsFromActions, stepsFromRecord } from '../game/replay';
import { optimalLength } from '../lib/solve';
import { useOpponent } from '../opponent/useOpponent';
import { ReplayPanel } from '../replay/ReplayPanel';
import { Reveal } from './Reveal';
import { progressOf, recordLoss, recordWin } from '../save/save';
import type { SaveStore } from '../save/store';

interface Props {
  challenge: ChallengeDefinition;
  index: number;
  total: number;
  store: SaveStore;
  skipBriefing: boolean;
  onMap: () => void;
  onNext: (() => void) | null;
}

interface ResultInfo {
  won: boolean;
  runActions: number;
  scoutActions: number;
  optimal: number;
  isOptimal: boolean;
  newBestRun: boolean;
  newUnassistedBest: boolean;
  bestRun: number | null;
  hintsUsed: number;
  achievements: string[];
}

export function Arena({ challenge, index, total, store, skipBriefing, onMap, onNext }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<GameController | null>(null);
  const recorded = useRef(false);
  const startedAt = useRef(new Date().toISOString());
  const entry = campaignEntry(challenge.id);
  const resumable = useRef(
    (() => {
      const s = store.getSession();
      return s && s.levelId === challenge.id && s.levelVersion === challenge.version && s.actions.length > 0 ? s : null;
    })(),
  );
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [briefing, setBriefing] = useState(!skipBriefing || resumable.current !== null);
  const [toast, setToast] = useState<string | null>(null);
  const [hintsUsed, setHintsUsed] = useState(resumable.current?.hintsUsed ?? 0);
  const [dialog, setDialog] = useState<'menu' | 'hints' | 'confirm-restart' | 'describe' | null>(null);
  const [announce, setAnnounce] = useState('');
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [replay, setReplay] = useState<'ai' | 'shortest' | null>(null);
  const opponent = useOpponent(challenge);
  // Memoised: a new steps array would rebuild the replay board on every render.
  const aiSteps = useMemo(() => (opponent.kind === 'ready' ? stepsFromRecord(opponent.rec.shown) : null), [opponent]);
  const shortestSteps = useMemo(
    () => stepsFromActions(challenge, [...(challenge.budget.explore > 0 ? ([{ type: 'COMMIT' }] as GameAction[]) : []), ...((solve(challenge).optimalSolution ?? []) as GameAction[])], 'shortest'),
    [challenge],
  );
  const hintsRef = useRef(hintsUsed);
  hintsRef.current = hintsUsed;
  const scouts = challenge.budget.explore > 0;

  useEffect(() => {
    if (!host.current) return;
    const c = new GameController(host.current, challenge, resumable.current?.actions ?? []);
    ctl.current = c;
    const off = c.subscribe((s) => {
      setSnap(s);
      audio.setIntensity(s.obs.phase === 'explore' ? 'scout' : 'run');
      if (s.action) setAnnounce(`${captionFor({ action: s.action, valid: true, events: s.events })} ${s.obs.actionsRemaining} actions left in the ${s.obs.phase === 'explore' ? 'scout' : 'run'}.`);
      for (const cue of cuesForEvents(s.events)) audio.play(cue);
      if (s.obs.status === 'playing' && c.log.length > 0) {
        store.setSession({ v: 1, levelId: challenge.id, levelVersion: challenge.version, actions: [...c.log], hintsUsed: hintsRef.current, startedAt: startedAt.current });
      }
      const committed = s.events.find((e) => e.type === 'COMMITTED');
      if (committed && committed.type === 'COMMITTED') {
        setToast(committed.reason === 'scout-spent' ? 'Scouting spent. The world has reset: the run begins.' : 'The run begins. The world has reset; what you learned stays with you.');
      } else if (s.events.some((e) => e.type === 'EXIT_FOUND')) {
        setToast('You found the exit. Keep experimenting, or press Start run when you are ready.');
      } else if (s.events.some((e) => e.type === 'NO_EFFECT')) {
        setToast('Nothing happened.');
      } else if (s.events.some((e) => e.type === 'EPOCH_CHANGED')) {
        setToast('The world just changed.');
      } else if (s.events.some((e) => e.type === 'SWITCH_TOGGLED' && !e.on && !(s.action?.type === 'INTERACT' && s.action.targetId === e.id))) {
        setToast('A switch sprang back off by itself.');
      }
    });
    return () => {
      off();
      c.destroy();
      ctl.current = null;
    };
  }, [challenge, store]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const obs = snap?.obs;
  const status = obs?.status ?? 'playing';

  // Record the outcome exactly once per attempt. A win is re-derived by replaying the action log, never taken on trust.
  useEffect(() => {
    const c = ctl.current;
    if (!obs || !c || status === 'playing' || recorded.current) return;
    recorded.current = true;
    const actions = [...c.log];
    const analysis = analyzeRun(challenge, actions);
    const optimal = optimalLength(challenge);
    store.clearSession();
    if (status === 'won' && analysis.outcome.won) {
      const r = recordWin(store.get(), { level: challenge, actions, analysis, hintsUsed, optimalLength: optimal, now: new Date() });
      store.set(r.save);
      setResult({
        won: true,
        runActions: analysis.outcome.runActions,
        scoutActions: analysis.outcome.scoutActions,
        optimal,
        isOptimal: r.isOptimal,
        newBestRun: r.newBestRun,
        newUnassistedBest: r.newUnassistedBest,
        bestRun: progressOf(r.save, challenge.id).bestRun,
        hintsUsed,
        achievements: r.newAchievements,
      });
    } else {
      store.set(recordLoss(store.get(), challenge.id));
      setResult({ won: false, runActions: obs.run.used, scoutActions: obs.scout.used, optimal, isOptimal: false, newBestRun: false, newUnassistedBest: false, bestRun: progressOf(store.get(), challenge.id).bestRun, hintsUsed, achievements: [] });
    }
  }, [status, obs, challenge, store, hintsUsed]);

  const restart = () => {
    recorded.current = false;
    setResult(null);
    setHintsUsed(0);
    startedAt.current = new Date().toISOString();
    store.clearSession();
    ctl.current?.restart();
  };

  const phase = obs?.phase ?? (scouts ? 'explore' : 'execute');
  const dispatch = ctl.current?.dispatch.bind(ctl.current);
  const current = obs ? (phase === 'explore' ? obs.scout : obs.run) : null;
  const hints = entry?.entry.hints ?? [];
  const atExit = !!obs && obs.player.x === obs.exit.x && obs.player.y === obs.exit.y;
  const chapterName = entry?.chapter.name ?? 'The Experiment';

  return (
    <div className={`arena ${phase}${obs && obs.epoch >= 1 ? ' shifted' : ''}`}>
      <div className="sr-only" role="status" aria-live="polite" data-testid="announcer">
        {announce}
      </div>
      <header className="hud">
        <div className="hud-left">
          <button className="icon-btn" aria-label="Back to the world map" onClick={onMap}>
            <BackIcon />
          </button>
          <div className="title">
            <small>
              {chapterName} · World {index + 1} of {total}
            </small>
            <h2>{challenge.name}</h2>
          </div>
        </div>
        <div className="budget">
          {obs && (
            <span className={`phase-pill ${phase}`} data-testid="phase">
              {phase === 'explore' ? 'Scout' : 'Run'}
            </span>
          )}
          {obs && current && <BudgetPips phase={phase} budget={current.budget} used={current.used} />}
          {hintsUsed > 0 && (
            <span className="assist-chip" title="Hints used: this run counts as assisted">
              Assisted
            </span>
          )}
          {phase === 'explore' && (
            <button className={`btn small${atExit ? ' ready' : ''}`} data-testid="start-run" onClick={() => ctl.current?.commit()}>
              Start run
            </button>
          )}
          <button className="icon-btn" data-testid="hint-button" aria-label="Hints" onClick={() => setDialog('hints')}>
            <BulbIcon />
          </button>
          <button className="icon-btn" data-testid="menu-button" aria-label="Menu" onClick={() => setDialog('menu')}>
            <MenuIcon />
          </button>
        </div>
      </header>

      <ActorCard side="human" name="You" role={phase === 'explore' ? 'Scouting: experiment freely. Reset is free.' : 'Running: every action counts.'} stat={obs ? `${obs.actionsRemaining} left` : ''} />

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
        role={
          opponent.kind === 'ready'
            ? opponent.rec.kind === 'reference'
              ? 'A recorded reference attempt (a computed player, not an AI) is waiting. You will see it when your run ends.'
              : 'A recorded attempt is waiting. You will see it when your run ends.'
            : opponent.kind === 'loading'
              ? 'Gets the same world, the same scouting and the same run budget.'
              : 'Gets the same world, the same scouting and the same run budget. There is no recorded attempt for this world yet.'
        }
        stat={scouts ? `Scout ${challenge.budget.explore} · Run ${challenge.budget.execute}` : `Run ${challenge.budget.execute}`}
      />

      <Dpad
        onMove={(direction) => dispatch?.({ type: 'MOVE', direction })}
        onAct={() => ctl.current?.interact()}
        onReset={() => dispatch?.({ type: 'RESET' })}
        onCommit={phase === 'explore' ? () => ctl.current?.commit() : null}
      />

      {briefing && (
        <Modal label="Challenge briefing">
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
            <span>Space: interact (Shift+arrow picks a side)</span>
            <span>R: reset</span>
            {scouts && <span>C: start run</span>}
          </p>
          <div className="row">
            {resumable.current && (
              <button
                className="btn ghost"
                onClick={() => {
                  restart();
                  resumable.current = null;
                  setBriefing(false);
                }}
              >
                Start over
              </button>
            )}
            <button className="btn" data-autofocus data-testid="begin" onClick={() => setBriefing(false)}>
              {resumable.current ? 'Continue' : scouts ? 'Start scouting' : 'Begin'}
            </button>
          </div>
          {resumable.current && <p className="note">You left this world part-way. Continue where you stopped, or start over.</p>}
        </Modal>
      )}

      {dialog === 'hints' && (
        <Modal label="Hints" onClose={() => setDialog(null)}>
          <div className="kicker">Hints</div>
          <h2>Need a nudge?</h2>
          <p className="note">Using a hint is fine. The run is marked <b>Assisted</b>: it still completes the world, but it will not count as a personal best, a shortest-path result or a fair comparison with the AI.</p>
          <ol className="hint-list">
            {hints.slice(0, hintsUsed).map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
          <div className="row">
            <button className="btn ghost" data-autofocus onClick={() => setDialog(null)}>
              Close
            </button>
            {hintsUsed < hints.length && (
              <button className="btn" data-testid="reveal-hint" onClick={() => setHintsUsed(hintsUsed + 1)}>
                {hintsUsed === 0 ? 'Show a hint' : 'Show another hint'} ({hintsUsed}/{hints.length})
              </button>
            )}
          </div>
        </Modal>
      )}

      {dialog === 'menu' && (
        <Modal label="Menu" onClose={() => setDialog(null)}>
          <div className="kicker">Paused</div>
          <h2>{challenge.name}</h2>
          <div className="menu-list">
            <button className="btn" data-autofocus onClick={() => setDialog(null)}>
              Resume
            </button>
            <button className="btn ghost" data-testid="describe-board" onClick={() => setDialog('describe')}>
              Describe the board
            </button>
            <button className="btn ghost" onClick={() => setDialog('confirm-restart')}>
              Restart this world
            </button>
            <button className="btn ghost" onClick={onMap}>
              Back to the map
            </button>
          </div>
        </Modal>
      )}

      {dialog === 'describe' && obs && (
        <Modal label="Board description" onClose={() => setDialog('menu')}>
          <div className="kicker">Board description</div>
          <h2>{challenge.name}</h2>
          <ul className="describe-list" data-testid="board-description">
            {describeBoard(obs).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <div className="row">
            <button className="btn" data-autofocus onClick={() => setDialog('menu')}>
              Back
            </button>
          </div>
        </Modal>
      )}

      {dialog === 'confirm-restart' && (
        <Modal label="Restart this world?" onClose={() => setDialog('menu')}>
          <h2>Restart this world?</h2>
          <p>Your current attempt will be abandoned. Your best results are kept.</p>
          <div className="row">
            <button className="btn ghost" data-autofocus onClick={() => setDialog('menu')}>
              Keep playing
            </button>
            <button
              className="btn"
              onClick={() => {
                setDialog(null);
                restart();
              }}
            >
              Restart
            </button>
          </div>
        </Modal>
      )}

      {replay === 'ai' && opponent.kind === 'ready' && aiSteps && (
        <ReplayPanel challenge={challenge} steps={aiSteps} seed={opponent.rec.shown.seed} source={{ kind: 'recorded', rec: opponent.rec }} onClose={() => setReplay(null)} />
      )}
      {replay === 'shortest' && (
        <ReplayPanel challenge={challenge} steps={shortestSteps} seed="shortest" source={{ kind: 'computed', label: 'The shortest way (computed)' }} onClose={() => setReplay(null)} />
      )}

      {!briefing && status !== 'playing' && obs && result && (
        <Modal label="Result" className="result">
          <div className="kicker">{result.won ? (result.hintsUsed > 0 ? 'Exit reached · Assisted' : 'Exit reached') : 'Out of actions'}</div>
          <h2 className={result.won ? 'win-title' : 'lose-title'}>{result.won ? 'You made it out.' : 'Not this time.'}</h2>
          <Reveal
            challenge={challenge}
            human={{ won: result.won, runActions: result.runActions, scoutActions: result.scoutActions, assisted: result.hintsUsed > 0 }}
            optimal={result.optimal}
            opponent={opponent}
            onReplay={() => setReplay('ai')}
            onShortest={() => setReplay('shortest')}
          />
          {result.won && (
            <ul className="result-notes chips">
              {result.newUnassistedBest && result.hintsUsed === 0 && <li className="good">New personal best.</li>}
              {result.isOptimal && <li className="good">Shortest possible run.</li>}
              {result.hintsUsed > 0 && <li>Assisted run: it completes the world but does not set a personal best.</li>}
              {result.bestRun !== null && <li>Your best here: {result.bestRun} actions.</li>}
              {result.achievements.map((id) => (
                <li key={id} className="good">
                  Achievement: {ALL_ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id}
                </li>
              ))}
            </ul>
          )}
          <div className="row">
            <button className="btn ghost" data-autofocus={!result.won || !onNext} onClick={restart}>
              {result.won ? 'Play again' : 'Try again'}
            </button>
            {result.won && onNext && (
              <button className="btn" data-autofocus onClick={onNext}>
                Next world
              </button>
            )}
            <button className="btn ghost" onClick={onMap}>
              Map
            </button>
          </div>
          {result.won && !onNext && <p className="note">That was the last world in this build.</p>}
        </Modal>
      )}
    </div>
  );
}
