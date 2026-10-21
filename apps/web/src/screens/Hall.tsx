import { ALL_ACHIEVEMENTS, levelById } from '@hva/game-core';
import { BackIcon } from '../components/icons';
import type { SaveData } from '../save/types';

export function Hall({ save, onBack }: { save: SaveData; onBack: () => void }) {
  const earned = ALL_ACHIEVEMENTS.filter((a) => save.achievements[a.id]).length;
  return (
    <main className="panel-screen" aria-label="Hall of Humanity">
      <header className="map-head">
        <button className="icon-btn" aria-label="Back" onClick={onBack} data-testid="hall-back">
          <BackIcon />
        </button>
        <div>
          <h1 className="display">Hall of Humanity</h1>
          <p className="map-sub" data-testid="hall-count">
            {earned} of {ALL_ACHIEVEMENTS.length} earned
          </p>
        </div>
        <span />
      </header>
      <p className="note hall-note">Your own verified achievements, kept on this device. Each one is re-checked by replaying your run through the game engine. Nothing here is public, ranked or compared with anyone.</p>
      <ul className="hall-grid">
        {ALL_ACHIEVEMENTS.map((a) => {
          const got = save.achievements[a.id];
          const world = got?.levelId ? levelById(got.levelId)?.name : null;
          return (
            <li key={a.id} className={`ach${got ? ' got' : ''}`} data-testid={`ach-${a.id}`}>
              <b>{got ? a.name : 'Not yet earned'}</b>
              <span>{got ? a.description : a.teaser}</span>
              {got && (
                <small>
                  {world ? `${world} · ` : ''}
                  {new Date(got.at).toLocaleDateString()}
                </small>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
