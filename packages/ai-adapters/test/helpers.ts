import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { GameAction } from '@hva/game-core';
import { LEVELS, solve } from '@hva/game-core';
import type { ChallengeDefinition } from '@hva/game-core';

export const level = (id: string): ChallengeDefinition => LEVELS.find((l) => l.id.startsWith(id)) as ChallengeDefinition;

/** Optimal plan including COMMIT when the level has a scout phase. */
export function planFor(l: ChallengeDefinition): GameAction[] {
  return [...(l.budget.explore > 0 ? [{ type: 'COMMIT' } as GameAction] : []), ...(solve(l).optimalSolution as GameAction[])];
}

export interface Seen {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: Record<string, unknown> | null;
}

export type Handler = (seen: Seen, n: number) => { status: number; body: unknown; headers?: Record<string, string>; delayMs?: number };

/** Local stand-in for a provider API. Records every request so tests can assert exactly what was sent. */
export async function mockServer(handler: Handler): Promise<{ url: string; seen: Seen[]; close: () => Promise<void>; server: Server }> {
  const seen: Seen[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      const entry: Seen = { method: req.method ?? '', url: req.url ?? '', headers: req.headers, body: text ? (JSON.parse(text) as Record<string, unknown>) : null };
      seen.push(entry);
      const out = handler(entry, seen.length);
      setTimeout(() => {
        res.writeHead(out.status, { 'content-type': 'application/json', ...out.headers });
        res.end(typeof out.body === 'string' ? out.body : JSON.stringify(out.body));
      }, out.delayMs ?? 0);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    seen,
    server,
    close: () => new Promise<void>((r) => (server.closeAllConnections(), server.close(() => r()))),
  };
}

export const noWait = () => ({ maxRetries: 3, backoffMs: () => 1 });
