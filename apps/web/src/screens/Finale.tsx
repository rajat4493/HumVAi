import { useEffect, useMemo, useState } from 'react';
import { ALL_ACHIEVEMENTS, CAMPAIGN_ORDER, levelById } from '@hva/game-core';
import { audio } from '../audio/instance';
import { BackIcon } from '../components/icons';
import { finaleShareText } from '../lib/share';
import { optimalLength } from '../lib/solve';
import { countRecordedWorlds } from '../opponent/count';
import { progressOf } from '../save/save';
import type { SaveData } from '../save/types';
import { ScrollMain } from '../components/ScrollMain';

interface Props {
  save: SaveData;
  onMap: () => void;
  onHall: () => void;
}

/** The ending. Everything on it is derived from the player's own save; nothing about the AI is claimed beyond what exists. */
export function Finale({ save, onMap, onHall }: Props) {
  const [recorded, setRecorded] = useState<number | null>(null);
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);

  const stats = useMemo(() => {
    let finished = 0;
    let shortest = 0;
    let assisted = 0;
    let attempts = 0;
    for (const id of CAMPAIGN_ORDER) {
      const p = progressOf(save, id);
      const level = levelById(id);
      attempts += p.attempts;
      if (p.completed) finished += 1;
      if (p.usedHints) assisted += 1;
      if (level && p.bestUnassistedRun !== null && p.bestUnassistedRun <= optimalLength(level)) shortest += 1;
    }
    return { finished, shortest, assisted, attempts, total: CAMPAIGN_ORDER.length, earned: ALL_ACHIEVEMENTS.filter((a) => save.achievements[a.id]).length };
  }, [save]);

  useEffect(() => {
    audio.play('campaign_complete');
    let live = true;
    void countRecordedWorlds().then((n) => live && setRecorded(n));
    return () => {
      live = false;
    };
  }, []);

  const share = async () => {
    const text = finaleShareText(stats);
    try {
      if (typeof navigator.share === 'function') await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setCopied('yes');
    } catch {
      setCopied('no');
    }
  };

  return (
    <ScrollMain className="finale" aria-label="The experiment is complete">
      <div className="finale-glow" aria-hidden="true" />
      <header className="map-head">
        <button className="icon-btn" aria-label="Back to the world map" onClick={onMap}>
          <BackIcon />
        </button>
        <span />
        <span />
      </header>
      <div className="kicker">The Experiment</div>
      <h1 className="display finale-title" data-testid="finale-title">
        You found the way out.
      </h1>
      <p className="finale-lead">Every world, every rule that was never explained. You worked it out by trying things, which is exactly what the experiment was about.</p>

      <dl className="finale-stats" data-testid="finale-stats">
        <div>
          <dt>Worlds finished</dt>
          <dd>
            {stats.finished} / {stats.total}
          </dd>
        </div>
        <div>
          <dt>Shortest possible runs</dt>
          <dd>{stats.shortest}</dd>
        </div>
        <div>
          <dt>Worlds that used a hint</dt>
          <dd>{stats.assisted}</dd>
        </div>
        <div>
          <dt>Attempts in all</dt>
          <dd>{stats.attempts}</dd>
        </div>
        <div>
          <dt>Achievements</dt>
          <dd>
            {stats.earned} / {ALL_ACHIEVEMENTS.length}
          </dd>
        </div>
      </dl>

      <p className="note finale-ai" data-testid="finale-ai">
        {recorded === null
          ? ''
          : recorded === 0
            ? 'No recorded AI attempts are included in this version yet, so there is no human-versus-AI scoreboard to show. When verified recordings are added, each world will show one, labelled as a recording.'
            : `Recorded AI attempts are included for ${recorded} of ${stats.total} worlds. Each is a recording, verified by replaying it through the same rules, never a live opponent.`}
      </p>

      <div className="row finale-actions">
        <button className="btn ghost" onClick={onHall}>
          Hall of Humanity
        </button>
        <button className="btn ghost" data-testid="finale-share" onClick={() => void share()}>
          {copied === 'yes' ? 'Copied' : copied === 'no' ? 'Could not share' : 'Share my result'}
        </button>
        <button className="btn" data-autofocus data-testid="finale-map" onClick={onMap}>
          Back to the worlds
        </button>
      </div>
    </ScrollMain>
  );
}
