import { useState } from 'react';
import { LEVELS } from '@hva/game-core';
import { Arena } from './screens/Arena';
import { Welcome } from './screens/Welcome';

/**
 * M0 review build. All five worlds are playable in order so progression, scouting and
 * experimentation can be judged; there is no map, saving or AI yet.
 * `?screen=arena&briefing=0&level=N` are developer switches for screenshots and tests.
 */
export function App() {
  const params = new URLSearchParams(window.location.search);
  const start = Math.min(Math.max(Number(params.get('level') ?? 1), 1), LEVELS.length) - 1;
  const [index, setIndex] = useState(start);
  const [screen, setScreen] = useState<'welcome' | 'arena'>(params.get('screen') === 'arena' ? 'arena' : 'welcome');
  const challenge = LEVELS[index] ?? LEVELS[0];
  if (!challenge) return null;

  return (
    <div className="stage">
      {screen === 'welcome' ? (
        <Welcome onPlay={() => setScreen('arena')} />
      ) : (
        <Arena
          key={challenge.id}
          challenge={challenge}
          index={index}
          total={LEVELS.length}
          skipBriefing={params.get('briefing') === '0'}
          onNext={index < LEVELS.length - 1 ? () => setIndex(index + 1) : null}
        />
      )}
    </div>
  );
}
