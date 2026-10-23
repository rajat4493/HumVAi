import { Suspense, lazy, useEffect, useMemo } from 'react';
import type { ComponentType } from 'react';
import { applyMotion } from './lib/motion';
import { store, useSave } from './save/instance';
import { Settings } from './screens/Settings';
import type { GameProps } from './suite/contract';
import { Home } from './suite/Home';
import { gameById } from './suite/registry';
import { go, hashFor, useRoute } from './suite/router';

/**
 * The arcade shell. The URL decides what is on screen: #/ (home), #/settings, #/<game>/... (a game owns everything after
 * its id). Each game is a lazy chunk, so the home screen never pays for a game it is not showing. Old developer links such
 * as /?screen=arena&level=3 (no hash) open The Experiment directly.
 */
export function App() {
  const save = useSave();
  const route = useRoute();
  useEffect(() => {
    applyMotion(save.settings.motion);
  }, [save.settings.motion]);

  const legacyDeepLink = route.game === null && route.rest.length === 0 && new URLSearchParams(window.location.search).has('screen');
  const game = legacyDeepLink ? gameById('experiment') : gameById(route.game);
  const playable = game?.load ? game : undefined;
  const onHome = () => go(hashFor(null));

  // One lazy component per game, created once.
  const Lazy = useMemo(() => {
    const cache = new Map<string, ComponentType<GameProps>>();
    return (id: string, load: NonNullable<typeof playable>['load']) => {
      if (!cache.has(id)) cache.set(id, lazy(load as NonNullable<typeof load>));
      return cache.get(id) as ComponentType<GameProps>;
    };
  }, []);

  useEffect(() => {
    document.title = playable ? `${playable.name} · Humans vs AI` : route.game === 'settings' ? 'Settings · Humans vs AI' : 'Humans vs AI';
  }, [playable, route.game]);

  let view;
  if (playable) {
    const G = Lazy(playable.id, playable.load);
    view = <G route={legacyDeepLink ? [] : route.rest} query={route.query} onHome={onHome} />;
  } else if (route.game === 'settings') {
    view = <Settings save={save} store={store} onBack={onHome} />;
  } else {
    view = <Home />;
  }

  return (
    <div className="stage">
      <Suspense
        fallback={
          <div className="loading" role="status">
            Loading…
          </div>
        }
      >
        {view}
      </Suspense>
    </div>
  );
}
