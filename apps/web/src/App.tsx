import { useState } from 'react';
import { LEVELS } from '@hva/game-core';
import { Arena } from './screens/Arena';
import { Welcome } from './screens/Welcome';

/**
 * M0 prototype: level 1 only. `?level=N` and `?screen=arena` are developer
 * switches used for screenshots and tests; the player-facing flow is Welcome -> Briefing -> Arena.
 */
export function App() {
  const params = new URLSearchParams(window.location.search);
  const index = Math.min(Math.max(Number(params.get('level') ?? 1), 1), LEVELS.length) - 1;
  const [screen, setScreen] = useState<'welcome' | 'arena'>(params.get('screen') === 'arena' ? 'arena' : 'welcome');
  const challenge = LEVELS[index] ?? LEVELS[0];
  if (!challenge) return null;

  return (
    <div className="stage">
      {screen === 'welcome' ? (
        <Welcome onPlay={() => setScreen('arena')} />
      ) : (
        <Arena key={challenge.id} challenge={challenge} skipBriefing={params.get('briefing') === '0'} />
      )}
    </div>
  );
}
