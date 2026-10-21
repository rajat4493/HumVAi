import { useEffect, useState } from 'react';
import type { ChallengeDefinition } from '@hva/game-core';
import { loadOpponent } from './load';
import type { OpponentState } from './load';

export const fixturesEnabled = (): boolean => new URLSearchParams(window.location.search).get('fixtures') === '1';

export function useOpponent(level: ChallengeDefinition): OpponentState {
  const [state, setState] = useState<OpponentState>({ kind: 'loading' });
  useEffect(() => {
    let live = true;
    void loadOpponent(level, { fixtures: fixturesEnabled() }).then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, [level]);
  return state;
}
