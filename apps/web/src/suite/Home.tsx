import { useEffect, useState } from 'react';
import { GearIcon, TrophyIcon } from '../components/icons';
import { countRecordedWorlds } from '../opponent/count';
import { store, useSave } from '../save/instance';
import type { GameModule, GameStatus } from './contract';
import { isPlayable } from './contract';
import { GAMES, gameById } from './registry';
import { go, hashFor } from './router';
import { ScrollMain } from '../components/ScrollMain';

const STATUS_LABEL: Record<GameStatus, string> = { available: 'Available', experimental: 'Experimental prototype', 'coming-soon': 'Coming soon' };

function Card({ game, aiRecorded }: { game: GameModule; aiRecorded: number | null }) {
  const save = useSave(); // re-render when progress changes
  void save;
  const progress = game.progress?.() ?? null;
  const open = () => go(hashFor(game.id, game.id === 'experiment' ? ['map'] : []));
  return (
    <article className={`game-card ${game.status}`} data-testid={`game-${game.id}`} aria-labelledby={`g-${game.id}`}>
      <div className="game-card-top">
        <h3 id={`g-${game.id}`}>{game.name}</h3>
        <span className={`badge ${game.status}`}>{STATUS_LABEL[game.status]}</span>
      </div>
      <p>{game.tagline}</p>
      {progress && (
        <p className="game-progress" data-testid={`progress-${game.id}`}>
          {progress.label}
        </p>
      )}
      {game.id === 'experiment' && aiRecorded !== null && (
        <p className="game-ai" data-testid="experiment-ai-note">
          {aiRecorded === 0 ? 'AI comparison: no recorded AI attempts yet. When verified recordings exist, each world will show one, labelled as a recording.' : `AI comparison: recorded, verified AI attempts for ${aiRecorded} worlds.`}
        </p>
      )}
      {game.status === 'coming-soon' && !isPlayable(game) && <p className="game-soon">Not playable yet.</p>}
      {game.status === 'experimental' && isPlayable(game) && (
        <button className="btn ghost small" data-testid={`open-${game.id}`} onClick={open}>
          Try the prototype
        </button>
      )}
      {game.status === 'available' && isPlayable(game) && (
        <button className="btn ghost small" data-testid={`open-${game.id}`} onClick={open}>
          {progress?.started ? 'Continue' : 'Open'}
        </button>
      )}
    </article>
  );
}

/** The arcade's front door. The Experiment is one tap away; nothing here claims more than exists. */
export function Home() {
  const save = useSave();
  const experiment = gameById('experiment') as GameModule;
  const progress = experiment.progress?.() ?? null;
  const [recorded, setRecorded] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void countRecordedWorlds().then((n) => live && setRecorded(n));
    return () => {
      live = false;
    };
  }, []);
  void save;

  return (
    <ScrollMain className="home" aria-label="Humans vs AI">
      <div className="home-hero">
        <h1 className="logo display">
          <span className="human-t">HUMANS</span>
          <span className="vs">vs</span>
          <span className="ai-t">AI</span>
        </h1>
        <p className="home-pitch">Different games. Different intelligences. One question: can you beat AI?</p>
        <button className="btn" autoFocus data-autofocus data-testid="play" onClick={() => go(hashFor('experiment', ['map']))}>
          {progress?.started ? 'Continue The Experiment' : 'Play The Experiment'}
        </button>
        <p className="home-sub" data-testid="home-progress">
          {progress?.started ? progress.label : '20 worlds with hidden rules. No account, no sign-up.'}
        </p>
      </div>

      <section className="catalogue" aria-labelledby="cat-h">
        <h2 id="cat-h">The games</h2>
        <div className="catalogue-grid">
          {GAMES.map((g) => (
            <Card key={g.id} game={g} aiRecorded={recorded} />
          ))}
        </div>
      </section>

      <div className="welcome-links">
        <button className="link-btn" data-testid="welcome-settings" onClick={() => go(hashFor('settings'))}>
          <GearIcon /> Settings
        </button>
        <button className="link-btn" data-testid="welcome-hall" onClick={() => go(hashFor('experiment', ['hall'], { from: 'home' }))}>
          <TrophyIcon /> Hall of Humanity
        </button>
      </div>
      <p className="home-sub">{store.persistent ? 'Progress is saved on this device only.' : 'This browser mode cannot save progress.'}</p>
    </ScrollMain>
  );
}
