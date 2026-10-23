import { Suspense, lazy, useEffect, useMemo, useRef } from 'react';
import { CAMPAIGN_ORDER, LEVELS, levelById } from '@hva/game-core';
import { isUnlocked } from '../../save/save';
import { store, useSave } from '../../save/instance';
import { Finale } from '../../screens/Finale';
import { Hall } from '../../screens/Hall';
import { Settings } from '../../screens/Settings';
import { WorldMap } from '../../screens/WorldMap';
import type { GameProps } from '../../suite/contract';
import { go, hashFor } from '../../suite/router';

// The game board (Phaser, ~330 KB gzipped) loads only when a world is opened, so the map is quick.
const Arena = lazy(() => import('../../screens/Arena').then((m) => ({ default: m.Arena })));

const H = {
  map: () => hashFor('experiment', ['map']),
  play: (id: string) => hashFor('experiment', ['play', id]),
  finale: () => hashFor('experiment', ['finale']),
  settings: (from: 'home' | 'map') => hashFor('experiment', ['settings'], { from }),
  hall: (from: 'home' | 'map') => hashFor('experiment', ['hall'], { from }),
};

/**
 * The Experiment as a game module. The URL is the screen: #/experiment/map, /play/<world>, /settings, /hall, /finale,
 * so Back, refresh and links work. Developer switches (screenshots, tests): ?screen=arena&level=N|level-id&briefing=0,
 * ?unlock=all, ?fixtures=1; they open the matching screen once and are otherwise ignored.
 */
export function ExperimentGame({ route, query, onHome }: GameProps) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const save = useSave();
  const unlockAll = params.get('unlock') === 'all';
  const redirected = useRef(false);

  // One-time: a developer query parameter picks the first screen.
  useEffect(() => {
    if (redirected.current || route.length > 0) return;
    redirected.current = true;
    const want = params.get('screen');
    const levelParam = params.get('level') ?? '1';
    const devLevel = CAMPAIGN_ORDER.includes(levelParam) ? levelParam : CAMPAIGN_ORDER[Math.min(Math.max(Number(levelParam) || 1, 1), LEVELS.length) - 1];
    if (want === 'arena' && devLevel) go(H.play(devLevel), { replace: true });
    else if (want === 'finale') go(H.finale(), { replace: true });
    else go(H.map(), { replace: true });
  }, [route.length, params]);

  const session = store.getSession();
  const resumeId = session && levelById(session.levelId)?.version === session.levelVersion ? session.levelId : null;
  const from = query.get('from') === 'home' ? 'home' : 'map';
  const [screen, arg] = route;

  const toMap = () => go(H.map());
  const map = (hasSession: string | null) => (
    <WorldMap
      save={save}
      unlockAll={unlockAll}
      hasSession={hasSession}
      onPlay={(levelId) => go(H.play(levelId))}
      onBack={onHome}
      onSettings={() => go(H.settings('map'))}
      onHall={() => go(H.hall('map'))}
      onFinale={() => go(H.finale())}
    />
  );

  let view;
  switch (screen) {
    case 'finale':
      view = <Finale save={save} onMap={toMap} onHall={() => go(H.hall('map'))} />;
      break;
    case 'settings':
      view = <Settings save={save} store={store} onBack={() => (from === 'home' ? onHome() : toMap())} />;
      break;
    case 'hall':
      view = <Hall save={save} onBack={() => (from === 'home' ? onHome() : toMap())} />;
      break;
    case 'play': {
      const challenge = levelById(arg ?? '');
      if (!challenge || !isUnlocked(save, challenge.id, { unlockAll })) {
        view = map(null);
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
          onMap={toMap}
          onNext={nextId ? () => go(H.play(nextId)) : null}
          onFinish={() => go(H.finale())}
        />
      );
      break;
    }
    default:
      view = map(resumeId);
  }

  return (
    <Suspense
      fallback={
        <div className="loading" role="status">
          Loading the world…
        </div>
      }
    >
      {view}
    </Suspense>
  );
}
