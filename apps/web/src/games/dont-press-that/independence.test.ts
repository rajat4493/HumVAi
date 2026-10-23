import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = new URL('.', import.meta.url).pathname;
const files = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f));
/** Source without comments, so a sentence about "the window" in a doc comment is not mistaken for code that uses one. */
const code = (f: string): string => readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const importsOf = (f: string): string[] => [...readFileSync(join(dir, f), 'utf8').matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]!);

describe('DON\'T PRESS THAT is its own game', () => {
  it('imports nothing from The Experiment, its engine, its save, or Pattern Hunter', () => {
    for (const f of files) {
      for (const i of importsOf(f)) {
        expect(i, `${f} imports ${i}`).not.toMatch(/@hva\/game-core|@hva\/ai-adapters|\.\.\/\.\.\/screens|\.\.\/\.\.\/game\/|\.\.\/experiment|\.\.\/pattern-hunter|opponent|save\/save$|save\/store/);
      }
    }
  });

  it('the rules, the host and the predictions run without a browser: no React, no DOM, no storage in them', () => {
    for (const f of ['sim.ts', 'levels.ts', 'solver.ts', 'lines.ts', 'host.ts', 'predictions.ts', 'session.ts', 'controller.ts']) {
      const src = code(f);
      for (const i of importsOf(f)) expect(i, `${f} imports ${i}`).not.toMatch(/react|storage|audio|render|telemetry|suite/);
      expect(src, f).not.toMatch(/\b(window|document|localStorage|performance\.now|Date\.now|Math\.random)\b/);
    }
  });

  it('the simulation and host never read the player\'s settings: personality cannot reach physics', () => {
    for (const f of ['sim.ts', 'session.ts']) expect(code(f), f).not.toMatch(/tone|muted|personality|composure/i);
  });
});
