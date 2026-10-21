import type { ReactNode } from 'react';
import type { OpponentRecording } from '@hva/ai-adapters';

export const recordedDate = (iso: string): string => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

/**
 * The mandatory label on everything derived from an AI attempt (honesty rule H1/H2).
 * Text, not colour alone: RECORDED, who recorded it, when, and which attempt of how many.
 */
export function RecordedBadge({ rec }: { rec: OpponentRecording }) {
  return (
    <span className="recorded-badge" data-testid="recorded-badge">
      <span className="rec-dot" aria-hidden="true" />
      <b>RECORDED</b>
      <span>
        {' · '}
        {rec.model.displayName}
        {rec.kind === 'model' ? ` · ${rec.model.provider}` : ''}
        {' · '}
        {recordedDate(rec.recordedAt)}
        {' · attempt '}
        {rec.shownAttempt} of {rec.attempts.length}
      </span>
    </span>
  );
}

/** Every AI-derived element lives inside one of these; tests fail if one lacks a RECORDED badge. */
export function RecordedSection({ rec, className, children, testId }: { rec: OpponentRecording; className?: string; children: ReactNode; testId?: string }) {
  return (
    <div className={className} data-source="recorded" data-testid={testId}>
      <RecordedBadge rec={rec} />
      {children}
    </div>
  );
}

export const IS_REFERENCE_NOTE = 'A computed reference player, not an AI model.';
