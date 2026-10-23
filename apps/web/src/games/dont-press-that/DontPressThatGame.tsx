import { useEffect, useState } from 'react';
import type { GameProps } from '../../suite/contract';
import { Done } from './Done';
import { Menu } from './Menu';
import { Play } from './Play';
import { LEVELS } from './levels';
import { run } from './runState';
import { loadDpt, setSettings, unlockedUpTo } from './storage';

const here = (rest: string[] = []): string => `#/dont-press-that${rest.length ? `/${rest.join('/')}` : ''}`;
const go = (hash: string): void => void (window.location.hash = hash);

/** DON'T PRESS THAT. A third game in the suite: its own rules, host, save and screens. Nothing here is shared with The Experiment. */
export default function DontPressThatGame({ route, query, onHome }: GameProps) {
  const [screen, arg] = route;
  const unlockAll = query.get('unlock') === 'all';

  // an address like #/dont-press-that/play/9 or to a level not unlocked yet goes to the list
  // A tester's link can preset the host for a fair comparison: ...#/dont-press-that?host=muted (or host=on).
  // (Applied while rendering the first time, so the screens below read the preset, not the old value.)
  const hostParam = query.get('host');
  useState(() => {
    if (hostParam === 'muted') setSettings({ muted: true });
    else if (hostParam === 'on') setSettings({ muted: false });
    return hostParam;
  });

  const n = Number(arg);
  const valid = screen === 'play' && Number.isInteger(n) && n >= 1 && n <= LEVELS.length;
  const allowed = valid && (unlockAll || n <= unlockedUpTo(loadDpt(), LEVELS.map((l) => l.id)));
  // the ending is only shown to someone who has reached it (never a victory screen from a typed address)
  const endAllowed = screen === 'done' && (unlockAll || loadDpt().finished);
  useEffect(() => {
    if (screen === 'play' && !allowed) window.location.replace(here());
    else if (screen === 'done' && !endAllowed) window.location.replace(here());
    else if (screen !== undefined && screen !== 'play' && screen !== 'done') window.location.replace(here());
  }, [screen, allowed, endAllowed]);

  if (screen === 'play' && allowed) {
    return <Play key={n} n={n} onMenu={() => go(here())} onNext={() => go(here(['play', String(Math.min(LEVELS.length, n + 1))]))} onDone={() => go(here(['done']))} />;
  }
  if (screen === 'done' && endAllowed) {
    return (
      <Done
        onMenu={() => go(here())}
        onArcade={onHome}
        onAgain={() => {
          run.reset();
          go(here(['play', '1']));
        }}
      />
    );
  }
  return <Menu onBack={onHome} onPlay={(k) => go(here(['play', String(k)]))} unlockAll={unlockAll} />;
}
