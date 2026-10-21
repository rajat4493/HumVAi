import { Suspense, lazy, useEffect, useState } from 'react';
import { CAMPAIGN_ORDER, LEVELS, levelById } from '@hva/game-core';
import { applyMotion } from './lib/motion';
import { completedCount, isUnlocked } from './save/save';
import { store, useSave } from './save/instance';
import { Hall } from './screens/Hall';
import { Settings } from './screens/Settings';
import { Welcome } from './screens/Welcome';
import { WorldMap } from './screens/WorldMap';

// The game board (Phaser, ~330 KB gzipped) loads only when a world is opened, so the title and map are quick.
const Arena = lazy(() => import('./screens/Arena').then((m) => ({ default: m.Arena })));

type Screen = { name: 'welcome' } | { name: 'map' } | { name: 'settings'; from: 'welcome' | 'map' } | { name: 'hall'; from: 'welcome' | 'map' } | { name: 'play'; levelId: string };

/**
 * Screens: Welcome -> World map -> Briefing/Arena/Result, plus Settings and the Hall of Humanity.
 * Developer switches (screenshots, tests): ?screen=arena&level=N&briefing=0, ?unlock=all
 */
export function App() {
  const params = new URLSearchParams(window.location.search);
  const save = useSave();
  const unlockAll = params.get('unlock') === 'all';
  const devLevel = CAMPAIGN_ORDER[Math.min(Math.max(Number(params.get('level') ?? 1), 1), LEVELS.length) - 1];
  const [screen, setScreen] = useState<Screen>(() => {
    if (params.get('screen') === 'arena' && devLevel) return { name: 'play', levelId: devLevel };
    if (params.get('screen') === 'map') return { name: 'map' };
    return { name: 'welcome' };
  });

  useEffect(() => {
    applyMotion(save.settings.motion);
  }, [save.settings.motion]);

  const session = store.getSession();
  const resumeId = session && levelById(session.levelId)?.version === session.levelVersion ? session.levelId : null;

  let view;
  switch (screen.name) {
    case 'welcome':
      view = (
        <Welcome
          hasProgress={completedCount(save) > 0 || resumeId !== null}
          persistent={store.persistent}
          onPlay={() => setScreen({ name: 'map' })}
          onSettings={() => setScreen({ name: 'settings', from: 'welcome' })}
          onHall={() => setScreen({ name: 'hall', from: 'welcome' })}
        />
      );
      break;
    case 'map':
      view = (
        <WorldMap
          save={save}
          unlockAll={unlockAll}
          hasSession={resumeId}
          onPlay={(levelId) => setScreen({ name: 'play', levelId })}
          onBack={() => setScreen({ name: 'welcome' })}
          onSettings={() => setScreen({ name: 'settings', from: 'map' })}
          onHall={() => setScreen({ name: 'hall', from: 'map' })}
        />
      );
      break;
    case 'settings':
      view = <Settings save={save} store={store} onBack={() => setScreen(screen.from === 'map' ? { name: 'map' } : { name: 'welcome' })} />;
      break;
    case 'hall':
      view = <Hall save={save} onBack={() => setScreen(screen.from === 'map' ? { name: 'map' } : { name: 'welcome' })} />;
      break;
    case 'play': {
      const challenge = levelById(screen.levelId);
      if (!challenge || !isUnlocked(save, challenge.id, { unlockAll })) {
        view = <WorldMap save={save} unlockAll={unlockAll} hasSession={null} onPlay={(levelId) => setScreen({ name: 'play', levelId })} onBack={() => setScreen({ name: 'welcome' })} onSettings={() => setScreen({ name: 'settings', from: 'map' })} onHall={() => setScreen({ name: 'hall', from: 'map' })} />;
        break;
      }
      const i = CAMPAIGN_ORDER.indexOf(challenge.id);
      const nextId = CAMPAIGN_ORDER[i + 1];
      view = (
        <Arena
          key={challenge.id}
          challenge={challenge}
          index={i}
          total={CAMPAIGN_ORDER.length}
          store={store}
          skipBriefing={params.get('briefing') === '0'}
          onMap={() => setScreen({ name: 'map' })}
          onNext={nextId ? () => setScreen({ name: 'play', levelId: nextId }) : null}
        />
      );
      break;
    }
  }
  return (
    <div className="stage">
      <Suspense
        fallback={
          <div className="loading" role="status">
            Loading the world…
          </div>
        }
      >
        {view}
      </Suspense>
    </div>
  );
}
