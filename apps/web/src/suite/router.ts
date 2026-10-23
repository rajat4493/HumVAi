import { useEffect, useState } from 'react';

/** Hash routes work on GitHub Pages under /HumVAi/ with no server rewrites, keep Back/Forward working, and survive a refresh. */
export interface Route {
  /** Game id, or null for the suite itself. */
  game: string | null;
  rest: string[];
  query: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [path = '', q = ''] = raw.split('?');
  const safe = (x: string): string => {
    try {
      return decodeURIComponent(x);
    } catch {
      return x; // a hand-typed, badly encoded address must never crash the page
    }
  };
  const parts = path.split('/').filter(Boolean).map(safe);
  return { game: parts[0] ?? null, rest: parts.slice(1), query: new URLSearchParams(q) };
}

export const hashFor = (game: string | null, rest: string[] = [], query?: Record<string, string>): string => {
  const path = [game, ...rest].filter((p): p is string => !!p).map(encodeURIComponent).join('/');
  const q = query && Object.keys(query).length > 0 ? `?${new URLSearchParams(query).toString()}` : '';
  return `#/${path}${q}`;
};

/** Moves to a route. A normal move adds a history entry (so Back works); `replace` does not. */
export function go(hash: string, opts: { replace?: boolean } = {}): void {
  if (window.location.hash === hash) return;
  if (opts.replace) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
