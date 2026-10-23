import { CAMPAIGN, CAMPAIGN_ORDER, levelById } from '@hva/game-core';
import { BackIcon, CheckIcon, GearIcon, LockIcon, StarIcon, TrophyIcon } from '../components/icons';
import { optimalLength } from '../lib/solve';
import { completedCount, isUnlocked, progressOf } from '../save/save';
import type { SaveData } from '../save/types';
import { ScrollMain } from '../components/ScrollMain';

interface Props {
  save: SaveData;
  unlockAll: boolean;
  hasSession: string | null;
  onPlay: (levelId: string) => void;
  onBack: () => void;
  onSettings: () => void;
  onHall: () => void;
  onFinale?: () => void;
}

export function WorldMap({ save, unlockAll, hasSession, onPlay, onBack, onSettings, onHall, onFinale }: Props) {
  const done = completedCount(save);
  const next = CAMPAIGN_ORDER.find((id) => isUnlocked(save, id, { unlockAll }) && !progressOf(save, id).completed) ?? null;
  return (
    <ScrollMain className="map" aria-label="World map">
      <header className="map-head">
        <button className="icon-btn" aria-label="Back to the title screen" onClick={onBack}>
          <BackIcon />
        </button>
        <div>
          <h1 className="display">The Experiment</h1>
          <p className="map-sub" data-testid="progress-summary">
            {done} of {CAMPAIGN_ORDER.length} worlds finished
          </p>
        </div>
        <div className="map-actions">
          <button className="icon-btn" data-testid="hall-button" aria-label="Hall of Humanity" onClick={onHall}>
            <TrophyIcon />
          </button>
          <button className="icon-btn" data-testid="settings-button" aria-label="Settings" onClick={onSettings}>
            <GearIcon />
          </button>
        </div>
      </header>

      {done === CAMPAIGN_ORDER.length && onFinale && (
        <button className="btn continue" data-testid="see-ending" onClick={onFinale}>
          The experiment is complete: see the ending
        </button>
      )}
      {(hasSession || next) && (
        <button className="btn continue" data-testid="continue" onClick={() => onPlay((hasSession ?? next) as string)}>
          {hasSession ? 'Continue your run' : done === 0 ? 'Start the first world' : 'Next world'}
        </button>
      )}

      <div className="chapters">
        {CAMPAIGN.map((chapter) => (
          <section key={chapter.id} className="chapter" aria-label={chapter.name}>
            <h2>{chapter.name}</h2>
            <p>{chapter.blurb}</p>
            <ol className="nodes">
              {chapter.levels.map((entry) => {
                const level = levelById(entry.levelId);
                if (!level) return null;
                const p = progressOf(save, entry.levelId);
                const open = isUnlocked(save, entry.levelId, { unlockAll });
                const n = CAMPAIGN_ORDER.indexOf(entry.levelId) + 1;
                // only finished worlds need the shortest length; solving all twenty on every visit would be wasted work
                const perfect = p.bestUnassistedRun !== null && p.bestUnassistedRun === optimalLength(level);
                const status = !open ? 'Locked' : p.completed ? (perfect ? 'Shortest possible' : 'Finished') : 'New';
                return (
                  <li key={entry.levelId}>
                    <button
                      className={`node${p.completed ? ' done' : ''}${!open ? ' locked' : ''}${perfect ? ' perfect' : ''}`}
                      data-testid={`node-${entry.levelId}`}
                      disabled={!open}
                      onClick={() => onPlay(entry.levelId)}
                      aria-label={`World ${n}: ${level.name}. ${status}${p.bestRun !== null ? `. Best ${p.bestRun} actions` : ''}`}
                    >
                      <span className="node-num" aria-hidden="true">
                        {!open ? <LockIcon /> : p.completed ? (perfect ? <StarIcon /> : <CheckIcon />) : n}
                      </span>
                      <span className="node-body">
                        <b>{level.name}</b>
                        <small>
                          {status}
                          {p.bestRun !== null && ` · best ${p.bestRun}`}
                          {p.completed && p.bestUnassistedRun === null && ' · assisted'}
                        </small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
      <p className="map-foot">Progress is saved on this device only.</p>
    </ScrollMain>
  );
}
