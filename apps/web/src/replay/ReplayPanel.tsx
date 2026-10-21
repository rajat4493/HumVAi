import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChallengeDefinition } from '@hva/game-core';
import type { OpponentRecording } from '@hva/ai-adapters';
import { audio } from '../audio/instance';
import { RecordedBadge } from '../components/Recorded';
import { Modal } from '../components/Modal';
import { captionFor, tickKind } from '../game/caption';
import { ReplayController } from '../game/replay';
import type { ReplayStep } from '../game/replay';

declare global {
  interface Window {
    __HVA_REPLAY__?: { stepTimes: number[]; position: () => number };
  }
}

/** One step every 450 ms at 1x, whatever the recorded latency was. Fixed cadence: nothing here imitates live reasoning. */
export const STEP_MS = 450;
const SPEEDS = [0.5, 1, 2, 4] as const;

export type ReplaySource =
  | { kind: 'recorded'; rec: OpponentRecording }
  | { kind: 'computed'; label: string };

interface Props {
  challenge: ChallengeDefinition;
  steps: ReplayStep[];
  seed: string;
  source: ReplaySource;
  onClose: () => void;
}

export function ReplayPanel({ challenge, steps, seed, source, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<ReplayController | null>(null);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [last, setLast] = useState<ReplayStep | null>(null);
  const isAi = source.kind === 'recorded';
  const stepTimes = useRef<number[]>([]);

  useEffect(() => {
    if (!host.current) return;
    const c = new ReplayController(host.current, challenge, seed, steps, isAi ? 'ai' : 'human');
    ctl.current = c;
    window.__HVA_REPLAY__ = { stepTimes: stepTimes.current, position: () => c.position };
    return () => {
      c.destroy();
      ctl.current = null;
      delete window.__HVA_REPLAY__;
    };
  }, [challenge, steps, seed, isAi]);

  const advance = useCallback((): boolean => {
    const c = ctl.current;
    if (!c) return false;
    const s = c.next();
    if (!s) return false;
    stepTimes.current.push(performance.now());
    setPos(c.position);
    setLast(s);
    if (s.action) audio.play(s.events.some((e) => e.type === 'EPOCH_CHANGED') ? 'shift' : s.action.type === 'COMMIT' ? 'commit' : 'ai_step');
    return c.position < steps.length;
  }, [steps.length]);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => {
      if (!advance()) setPlaying(false);
    }, STEP_MS / speed);
    return () => window.clearInterval(t);
  }, [playing, speed, advance]);

  const seek = (i: number) => {
    setPlaying(false);
    ctl.current?.seekTo(i);
    setPos(i);
    setLast(i > 0 ? (steps[i - 1] ?? null) : null);
  };
  const commitIndex = steps.findIndex((s) => s.action?.type === 'COMMIT');
  const scoutCount = commitIndex >= 0 ? commitIndex + 1 : 0;
  const atEnd = pos >= steps.length;
  const title = isAi ? 'The AI’s recorded run' : source.label;

  return (
    <Modal label={`Replay: ${title}`} onClose={onClose} className="replay">
      <div className="replay-head">
        <div>
          <div className="kicker">Replay</div>
          <h2>{title}</h2>
        </div>
        <button className="btn ghost small" data-testid="replay-close" onClick={onClose} data-autofocus>
          Close
        </button>
      </div>
      {source.kind === 'recorded' ? (
        <div data-source="recorded" className="replay-source" data-testid="replay-source">
          <RecordedBadge rec={source.rec} />
          <p className="replay-notlive">Recorded replay. This is not live.</p>
        </div>
      ) : (
        <p className="replay-notlive" data-testid="replay-source">
          Computed shortest solution (not an AI). Not a recording.
        </p>
      )}

      <div className="replay-board">
        <div className="board-frame" />
        <div ref={host} style={{ position: 'absolute', inset: 0 }} data-testid="replay-board" />
      </div>

      <p className="replay-caption" role="status" data-testid="replay-caption">
        {last ? `Step ${pos}: ${captionFor(last)}` : 'Press play to watch. Each step is shown at a steady pace.'}
      </p>
      {source.kind === 'recorded' && last?.note && (
        <div className="replay-note" data-source="recorded" data-testid="replay-note">
          <b>Self-reported note</b>
          <span>“{last.note}”</span>
          <small>Written by the model during the attempt. It may not reflect how it actually decided.</small>
        </div>
      )}

      <div className="timeline" aria-hidden="true">
        {steps.map((s, i) => (
          <span key={i} className={`tick ${tickKind(s)}${i < pos ? ' seen' : ''}${i < scoutCount ? ' scout' : ''}`} />
        ))}
      </div>
      <input
        className="scrub"
        type="range"
        min={0}
        max={steps.length}
        value={pos}
        aria-label="Replay position"
        aria-valuetext={`Step ${pos} of ${steps.length}`}
        data-testid="replay-scrub"
        onChange={(e) => seek(Number(e.target.value))}
      />
      <p className="timeline-legend">
        {scoutCount > 0 ? `Scout ${scoutCount} actions · Run ${steps.length - scoutCount} actions` : `${steps.length} actions`}
      </p>

      <div className="transport">
        <button className="icon-btn" aria-label="Step back" data-testid="replay-back" onClick={() => seek(pos - 1)} disabled={pos === 0}>
          ◀︎
        </button>
        <button
          className="btn small"
          data-testid="replay-play"
          onClick={() => {
            if (atEnd) seek(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
        </button>
        <button className="icon-btn" aria-label="Step forward" data-testid="replay-forward" onClick={() => { setPlaying(false); advance(); }} disabled={atEnd}>
          ▶︎
        </button>
        <div role="radiogroup" aria-label="Playback speed" className="speeds">
          {SPEEDS.map((s) => (
            <button key={s} role="radio" aria-checked={speed === s} className={`chip${speed === s ? ' on' : ''}`} data-testid={`speed-${s}`} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
        {scoutCount > 0 && (
          <button className="btn ghost small" data-testid="replay-skip-scout" onClick={() => seek(scoutCount)} disabled={pos >= scoutCount}>
            Skip Scout
          </button>
        )}
      </div>

      {source.kind === 'recorded' && (
        <details className="replay-details" data-source="recorded" data-testid="replay-details">
          <summary>How was this recorded?</summary>
          <dl>
            <dt>Who</dt>
            <dd>
              {source.rec.model.displayName} ({source.rec.model.provider}: <code>{source.rec.model.modelId}</code>)
              {source.rec.kind === 'reference' && ' — a computed reference player, not an AI model'}
            </dd>
            <dt>Recorded</dt>
            <dd>{new Date(source.rec.recordedAt).toLocaleString()}</dd>
            <dt>Attempts</dt>
            <dd>
              {source.rec.attempts.length} recorded; {source.rec.attempts.filter((a) => a.status === 'won').length} reached the exit. Shown: attempt {source.rec.shownAttempt}.
            </dd>
            <dt>Why this attempt</dt>
            <dd>
              {source.rec.selection === 'median-success'
                ? 'The rule was fixed in advance: among the attempts that reached the exit, the one with the median number of run actions.'
                : 'No attempt reached the exit, so the one that ended nearest it is shown, labelled unsuccessful.'}
            </dd>
            <dt>Configuration</dt>
            <dd>
              <code>{source.rec.configHash}</code>
            </dd>
            <dt>Verified</dt>
            <dd>This attempt was replayed through the game engine in your browser before being shown.</dd>
            <dt>Cost and speed</dt>
            <dd>
              Measured while recording, not shown during replay: {source.rec.measured.calls} calls, {source.rec.measured.inputTokens.toLocaleString()} input / {source.rec.measured.outputTokens.toLocaleString()} output tokens
              {source.rec.measured.costUsd !== null ? `, $${source.rec.measured.costUsd.toFixed(4)}` : ', cost not available'}
              {source.rec.measured.latencyMsP50 !== null ? `, median ${source.rec.measured.latencyMsP50} ms per call` : ''}.
            </dd>
          </dl>
        </details>
      )}
    </Modal>
  );
}
