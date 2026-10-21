import { useEffect, useState } from 'react';
import { compareHeadToHead } from '@hva/ai-adapters';
import type { Outcome, OpponentRecording } from '@hva/ai-adapters';
import type { ChallengeDefinition } from '@hva/game-core';
import { audio } from '../audio/instance';
import type { CueId } from '../audio/cues';
import { RecordedSection, IS_REFERENCE_NOTE } from '../components/Recorded';
import { reducedMotion } from '../lib/motion';
import { shareText } from '../lib/share';
import type { OpponentState } from '../opponent/load';

export interface HumanResult {
  won: boolean;
  runActions: number;
  scoutActions: number;
  assisted: boolean;
}

interface Props {
  challenge: ChallengeDefinition;
  human: HumanResult;
  optimal: number;
  opponent: OpponentState;
  onReplay: () => void;
  onShortest: () => void;
}

const CUE: Record<Outcome, CueId> = { HUMAN_AHEAD: 'reveal_human', AI_AHEAD: 'reveal_ai', TIE: 'reveal_tie', BOTH_FAILED: 'reveal_none', INCONCLUSIVE: 'reveal_none', ASSISTED: 'reveal_none' };

function copy(outcome: Outcome, human: HumanResult, rec: OpponentRecording | null, opponent: OpponentState): { headline: string; sub: string } {
  const ai = rec?.shown.outcome;
  switch (outcome) {
    case 'HUMAN_AHEAD':
      return {
        headline: 'You got there first.',
        sub: ai?.status === 'won' ? `You: ${human.runActions} actions. The AI's recorded attempt: ${ai.runActions}.` : "The AI's recorded attempt did not reach the exit.",
      };
    case 'AI_AHEAD':
      return {
        headline: 'The AI got there faster.',
        sub: human.won ? `The AI's recorded attempt: ${ai?.runActions} actions. You: ${human.runActions}. Watch how it did it.` : "The AI's recorded attempt reached the exit. You ran out of actions.",
      };
    case 'TIE':
      return { headline: 'Dead even.', sub: `Both reached the exit in ${human.runActions} actions, with ${human.scoutActions} scout actions each.` };
    case 'BOTH_FAILED':
      return { headline: 'Neither made it out.', sub: 'Here is one way through.' };
    case 'ASSISTED':
      return { headline: 'Out, with a little help.', sub: "Hints were used, so this run is not compared with the AI's recorded attempt." };
    default:
      return {
        headline: 'No fair comparison this time.',
        sub: opponent.kind === 'unusable' ? "We couldn't verify the AI's recorded attempt, so we're not scoring it." : opponent.kind === 'loading' ? 'Looking for the AI’s recorded attempt…' : 'There is no recorded AI attempt for this world yet.',
      };
  }
}

function Distribution({ rec, budget, optimal, human }: { rec: OpponentRecording; budget: number; optimal: number; human: HumanResult }) {
  const W = 320;
  const x = (n: number) => 14 + (Math.min(n, budget) / budget) * (W - 28);
  const wins = rec.attempts.filter((a) => a.status === 'won');
  const fails = rec.attempts.filter((a) => a.status !== 'won');
  const fastest = Math.min(...wins.map((a) => a.runActions));
  const sorted = wins.map((a) => a.runActions).sort((a, b) => a - b);
  const median = sorted[Math.floor((sorted.length - 1) / 2)];
  const sentence =
    wins.length === 0
      ? `The AI reached the exit in 0 of ${rec.attempts.length} recorded attempts.`
      : `The AI reached the exit in ${wins.length} of ${rec.attempts.length} recorded attempts. Fastest ${fastest}, median ${median}.`;
  const stacks = new Map<number, number>();
  return (
    <figure className="dist" data-testid="distribution">
      <svg viewBox={`0 0 ${W} 86`} role="img" aria-label={`${sentence}${human.won ? ` You: ${human.runActions}.` : ''}`}>
        <line x1={14} x2={W - 14} y1={46} y2={46} className="axis" />
        <line x1={x(optimal)} x2={x(optimal)} y1={8} y2={52} className="opt" />
        <text x={x(optimal)} y={7} className="lbl" textAnchor="middle">
          shortest {optimal}
        </text>
        {wins.map((a) => {
          const k = stacks.get(a.runActions) ?? 0;
          stacks.set(a.runActions, k + 1);
          return <circle key={a.attempt} cx={x(a.runActions)} cy={36 - k * 11} r={5} className="dot won" />;
        })}
        {fails.map((a, i) => (
          <circle key={a.attempt} cx={W - 24 - i * 13} cy={62} r={5} className="dot fail" />
        ))}
        {fails.length > 0 && (
          <text x={W - 14} y={80} className="lbl" textAnchor="end">
            did not reach the exit
          </text>
        )}
        {human.won && <polygon points={`${x(human.runActions) - 6},${58} ${x(human.runActions) + 6},${58} ${x(human.runActions)},${48}`} className="you" />}
        {human.won && (
          <text x={x(human.runActions)} y={70} className="lbl you-l" textAnchor="middle">
            you
          </text>
        )}
      </svg>
      <figcaption>{sentence}</figcaption>
    </figure>
  );
}

export function Reveal({ challenge, human, optimal, opponent, onReplay, onShortest }: Props) {
  const rec = opponent.kind === 'ready' ? opponent.rec : null;
  const aiSide = rec ? { won: rec.shown.outcome.status === 'won', runActions: rec.shown.outcome.runActions, scoutActions: rec.shown.outcome.scoutActions } : null;
  const cmp = compareHeadToHead(human, aiSide, { humanAssisted: human.assisted });
  const { headline, sub } = copy(cmp.outcome, human, rec, opponent);
  const [shared, setShared] = useState<string | null>(null);
  const budget = challenge.budget.execute;

  useEffect(() => {
    const t = window.setTimeout(() => audio.play(CUE[cmp.outcome]), reducedMotion() ? 0 : 900);
    return () => window.clearTimeout(t);
  }, [cmp.outcome]);

  const share = async () => {
    const text = shareText({
      worldName: challenge.name,
      human: { won: human.won, runActions: human.runActions, optimal, assisted: human.assisted },
      ai: rec && aiSide ? { label: rec.model.displayName, kind: rec.kind, won: aiSide.won, runActions: aiSide.runActions, attemptsWon: rec.attempts.filter((a) => a.status === 'won').length, attemptsTotal: rec.attempts.length } : null,
      outcome: cmp.outcome,
    });
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setShared('Copied.');
    } catch {
      setShared('Could not copy. Select the text yourself:\n' + text);
    }
  };

  const bar = (n: number, won: boolean, kind: 'human' | 'ai') => (
    <div className={`bar-track ${kind}`}>
      <div className={`bar-fill${won ? '' : ' failed'}`} style={{ ['--w' as string]: `${Math.max(6, Math.min(100, (n / budget) * 100))}%` }} />
    </div>
  );

  return (
    <section className="reveal" data-outcome={cmp.outcome} data-testid="reveal" aria-live="polite">
      <h3 className="reveal-headline" data-testid="reveal-headline">
        {headline}
      </h3>
      <p className="reveal-sub">{sub}</p>

      <div className="versus">
        <div className="side human">
          <small>You</small>
          <b data-testid="human-run">{human.won ? human.runActions : '—'}</b>
          <span>{human.won ? `run actions of ${budget}` : 'did not reach the exit'}</span>
          {bar(human.won ? human.runActions : budget, human.won, 'human')}
          <em>
            {challenge.budget.explore > 0 ? `scouted ${human.scoutActions}` : 'no scouting here'}
            {human.assisted ? ' · hints used' : ''}
          </em>
        </div>

        {rec && aiSide ? (
          <RecordedSection rec={rec} className="side ai" testId="ai-side">
            <small>The AI</small>
            <b data-testid="ai-run">{aiSide.won ? aiSide.runActions : '—'}</b>
            <span>{aiSide.won ? `run actions of ${budget}` : 'did not reach the exit'}</span>
            {bar(aiSide.won ? aiSide.runActions : budget, aiSide.won, 'ai')}
            <em>{challenge.budget.explore > 0 ? `scouted ${aiSide.scoutActions}` : 'no scouting here'}</em>
            {rec.kind === 'reference' && <p className="ref-note">{IS_REFERENCE_NOTE}</p>}
          </RecordedSection>
        ) : (
          <div className="side ai none" data-testid="ai-none">
            <small>The AI</small>
            <b>?</b>
            <span>{opponent.kind === 'unusable' ? 'recorded attempt could not be verified' : 'no recorded attempt yet'}</span>
          </div>
        )}
      </div>

      {rec && (
        <RecordedSection rec={rec} className="dist-wrap">
          <Distribution rec={rec} budget={budget} optimal={optimal} human={human} />
        </RecordedSection>
      )}

      <div className="reveal-actions">
        {rec && (
          <button className="btn ghost" data-testid="watch-ai" onClick={onReplay}>
            Watch the AI’s recorded run
          </button>
        )}
        {cmp.outcome === 'BOTH_FAILED' && (
          <button className="btn ghost" data-testid="watch-shortest" onClick={onShortest}>
            Show the shortest way
          </button>
        )}
        <button className="btn ghost" data-testid="share" onClick={() => void share()}>
          Copy result
        </button>
      </div>
      {shared && (
        <p className="note" role="status" style={{ whiteSpace: 'pre-line' }}>
          {shared}
        </p>
      )}
    </section>
  );
}
