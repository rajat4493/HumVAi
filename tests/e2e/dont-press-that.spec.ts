import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import '../../apps/web/src/telemetry/schemas';
import { checkSequence, validateEnvelope } from '../../apps/web/src/telemetry/envelope';
import type { EventEnvelope } from '../../apps/web/src/telemetry/envelope';
import { LEVELS } from '../../apps/web/src/games/dont-press-that/levels';
import { SOLUTIONS, expand } from '../../apps/web/src/games/dont-press-that/solutions';

/**
 * DON'T PRESS THAT, played in a real browser. The game loop runs at its own 60 Hz; the tests either press real keys and buttons, or
 * hand the loop a recorded list of inputs (one per tick) through the debug hook, so the same code that a player's keys reach is what
 * plays the level. A level is cleared only when the browser's own simulation says so.
 */
interface DptState {
  level: number;
  tick: number;
  attempt: number;
  x: number;
  y: number;
  gs: number;
  grounded: boolean;
  dead: string | null;
  won: boolean;
  deaths: number;
  mode: string | null;
  beam: string;
  line: string | null;
  composure: number;
  predictions: { correct: number; wrong: number; void: number };
  verdicts: string[];
  respawnMs: number | null;
  queued: number;
  history: { n: number; outcome: string; ticks: number; cause: string | null; respawnTicks: number | null; retryTicks: number | null }[];
}
const st = (page: Page): Promise<DptState> => page.evaluate(() => (window as unknown as { __DPT__: { state(): unknown } }).__DPT__.state() as never);
const feed = (page: Page, inputs: number[], fast = false): Promise<void> => page.evaluate(([i, f]) => (window as unknown as { __DPT__: { feed(x: number[], o?: { fast?: boolean }): void } }).__DPT__.feed(i as number[], { fast: f as boolean }), [inputs, fast] as const);
const open = async (page: Page, n: number, extra = ''): Promise<void> => {
  await page.goto(`/#/dont-press-that/play/${n}?unlock=all${extra}`);
  await page.waitForFunction(() => '__DPT__' in window);
};
const solutionFor = (n: number, mode: string): number[] => {
  const level = LEVELS[n - 1]!;
  return expand(SOLUTIONS.find((s) => s.level === level.id && s.mode === mode)!.runs);
};
/** Fresh attempt, then the recorded winning inputs for whichever way the host is aiming. */
// A restart only counts on the tick the key goes down, so every restart is preceded by a tick with nothing pressed.
const RESTART = 8;
async function beat(page: Page, n: number): Promise<void> {
  await feed(page, [0, RESTART]);
  await expect.poll(async () => (await st(page)).queued).toBe(0);
  const mode = (await st(page)).mode ?? 'lead';
  await feed(page, [0, RESTART, ...solutionFor(n, mode)], true); // the leading restart makes the attempt start at tick 0, whatever the clock said
  await expect.poll(async () => (await st(page)).won, { timeout: 30_000 }).toBe(true);
}

test.describe("DON'T PRESS THAT: in the arcade", () => {
  test('is the third game on the home screen, labelled honestly, and opens to its level list', async ({ page }) => {
    await page.goto('/');
    const card = page.getByTestId('game-dont-press-that');
    await expect(card).toContainText("DON'T PRESS THAT");
    await expect(card).toContainText('Experimental prototype');
    await expect(card.getByRole('button')).toHaveCount(1);
    // the other games are where they were
    await expect(page.getByTestId('game-experiment')).toContainText('Available');
    await expect(page.getByTestId('game-pattern-hunter')).toContainText('Experimental prototype');
    await expect(page.getByTestId('game-detective').getByRole('button')).toHaveCount(0);
    await card.getByRole('button').click();
    await expect(page).toHaveURL(/#\/dont-press-that$/);
    await expect(page.getByTestId('dpt-menu')).toContainText('Five small levels');
    await expect(page.getByTestId('dpt-level-1')).toBeEnabled();
    await expect(page.getByTestId('dpt-level-2')).toBeDisabled();
    await page.getByTestId('dpt-arcade').click();
    await expect(page.getByTestId('game-dont-press-that')).toBeVisible();
  });

  test('the Experiment and Pattern Hunter saves are untouched by playing it', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('hva.ph.v1', JSON.stringify({ v: 1, challenges: { 'ph-001': { attempts: 3, solved: true, bestCorrect: 6, total: 6, fewestProbes: 3 } } }));
    });
    await page.goto('/#/dont-press-that/play/1');
    await page.waitForFunction(() => '__DPT__' in window);
    const before = await page.evaluate(() => [localStorage.getItem('hva.save.v1'), localStorage.getItem('hva.ph.v1')]);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(600);
    await page.keyboard.up('ArrowRight');
    const after = await page.evaluate(() => [localStorage.getItem('hva.save.v1'), localStorage.getItem('hva.ph.v1')]);
    expect(after).toEqual(before);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('hva.dpt')))).toEqual(expect.any(Array));
  });
});

test.describe("DON'T PRESS THAT: controls and respawn", () => {
  test('arrow keys move, Space jumps, R restarts', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard');
    await open(page, 1);
    const s0 = await st(page);
    // Hold the key until the world has moved, however many frames the browser managed (WebKit on a busy runner is slow to start).
    await page.keyboard.down('ArrowRight');
    await expect.poll(async () => (await st(page)).x, { timeout: 5000 }).toBeGreaterThan(s0.x + 2);
    await page.keyboard.up('ArrowRight');
    const s1 = await st(page);
    await page.keyboard.press('Space');
    await expect.poll(async () => (await st(page)).grounded).toBe(false);
    await page.keyboard.down('ArrowLeft');
    await expect.poll(async () => (await st(page)).x, { timeout: 5000 }).toBeLessThan(s1.x - 0.5);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.press('r');
    await expect.poll(async () => (await st(page)).x, { timeout: 3000 }).toBeCloseTo(s0.x, 0);
    // Space on a button must never press it: after using the settings button, Space still jumps
    await page.getByTestId('dpt-settings').click();
    await page.getByTestId('dpt-resume').click();
    await expect(page.getByTestId('dpt-resume')).toHaveCount(0);
    await page.keyboard.press('Space');
    await expect(page.getByTestId('dpt-resume')).toHaveCount(0);
  });

  test('after a death, control is back in under half a second, on a clean level, and the death is explained', async ({ page }) => {
    await open(page, 1);
    await feed(page, [0, RESTART, ...Array(300).fill(2)]); // walk right into the falling bar
    await expect.poll(async () => (await st(page)).history.length, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect.poll(async () => (await st(page)).attempt).toBeGreaterThanOrEqual(3);
    const s = await st(page);
    const death = s.history.find((h) => h.outcome === 'death')!;
    expect(death.cause).toBe('drop');
    expect(death.respawnTicks).toBeLessThanOrEqual(15);
    expect(s.respawnMs).not.toBeNull();
    expect(s.respawnMs!).toBeLessThan(500);
    await expect(page.getByTestId('dpt-deaths')).toContainText('1');
  });

  test('the on-screen buttons work by touch: left, right and jump', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch layout');
    await open(page, 1);
    await expect(page.getByTestId('dpt-pad')).toBeVisible();
    /** Holds a button until `done` is true (or 5 s), so the check does not depend on how many frames the browser managed. */
    const hold = async (id: string, done: () => Promise<boolean>): Promise<void> => {
      const b = (await page.getByTestId(id).boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await expect.poll(done, { timeout: 5000 }).toBe(true);
      await page.mouse.up();
    };
    const x0 = (await st(page)).x;
    await hold('dpt-right', async () => (await st(page)).x > x0 + 2);
    const x1 = (await st(page)).x;
    await hold('dpt-left', async () => (await st(page)).x < x1 - 0.5);
    const y0 = (await st(page)).y;
    await hold('dpt-jump', async () => (await st(page)).y < y0 - 0.5);
    for (const id of ['dpt-left', 'dpt-right', 'dpt-jump', 'dpt-restart']) {
      const b = (await page.getByTestId(id).boundingBox())!;
      expect(b.width, id).toBeGreaterThanOrEqual(44);
      expect(b.height, id).toBeGreaterThanOrEqual(44);
    }
    await feed(page, Array(40).fill(0));
    await expect.poll(async () => (await st(page)).queued).toBe(0);
    const before = (await st(page)).tick;
    expect(before).toBeGreaterThan(30);
    await page.getByTestId('dpt-restart').dispatchEvent('pointerdown');
    await expect.poll(async () => (await st(page)).tick).toBeLessThan(before);
  });

  test('the level fits the screen with the controls reachable, on a phone and on a desktop', async ({ page, isMobile }) => {
    await open(page, 5);
    const w = page.viewportSize()!.width;
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const box = (await page.getByTestId('dpt-canvas').boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(w);
    expect(box.width / 20).toBeGreaterThanOrEqual(18); // tiles are readable
    if (isMobile) {
      const jump = (await page.getByTestId('dpt-jump').boundingBox())!;
      expect(jump.y + jump.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    }
  });
});

test.describe("DON'T PRESS THAT: the five levels", () => {
  test('every level can be beaten in the real game, in order, and the ending reports only what happened', async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto('/#/dont-press-that');
    await page.getByTestId('dpt-play').click();
    for (let n = 1; n <= 5; n++) {
      await expect(page).toHaveURL(new RegExp(`#/dont-press-that/play/${n}$`));
      await page.waitForFunction(() => '__DPT__' in window);
      await expect(page.getByTestId('dpt-name')).toHaveText(LEVELS[n - 1]!.name);
      await expect(page.getByTestId('dpt-line')).not.toBeEmpty(); // the host introduces every level
      await beat(page, n);
      await expect(page.getByTestId('dpt-cleared')).toBeVisible();
      await page.getByTestId('dpt-next').click();
    }
    await expect(page).toHaveURL(/#\/dont-press-that\/done$/);
    await expect(page.getByTestId('dpt-end')).toContainText('He is off');
    const pred = page.getByTestId('dpt-end-pred');
    await expect(pred).toContainText(/\d+ of \d+ came true|none judged/);
    // progress persisted: the list shows everything cleared
    await page.goto('/#/dont-press-that');
    for (let n = 1; n <= 5; n++) await expect(page.getByTestId(`dpt-level-${n}`)).toContainText('Cleared');
    await expect(page.getByTestId('dpt-play')).toContainText('Continue');
  });

  test('level 4 changes how it aims after you wait, and level 5 breaks its own wall', async ({ page }) => {
    test.setTimeout(90_000);
    await open(page, 4);
    // attempt 1: stand still after moving until the beam has had its chance
    await feed(page, [0, RESTART]);
    await expect.poll(async () => (await st(page)).queued).toBe(0);
    expect((await st(page)).mode).toBe('lead');
    await feed(page, [0, RESTART, 2, 2, 2, 2, 2, ...Array(200).fill(0)], true);
    await expect.poll(async () => (await st(page)).history.some((h) => h.outcome === 'death'), { timeout: 15_000 }).toBe(true);
    await expect.poll(async () => (await st(page)).attempt).toBeGreaterThanOrEqual(2);
    expect((await st(page)).mode).toBe('camp');
    await expect(page.getByTestId('dpt-line')).toContainText(/waited|paused|stopped|hiding|stand/i);
    await page.getByTestId('dpt-back').click();

    await open(page, 5);
    await beat(page, 5);
    const s = await st(page);
    expect(s.won).toBe(true);
    expect(s.composure).toBeLessThan(60);
    expect(s.verdicts).toContain('l5-button:wrong');
    await expect(page.getByTestId('dpt-line')).toContainText(/off|button|goodnight|shutting/i);
  });
});

test.describe("DON'T PRESS THAT: the host", () => {
  test('his predictions are judged by what really happened, and his score is shown', async ({ page }) => {
    test.setTimeout(60_000);
    await open(page, 2);
    // jump early (before x = 8), springing the vents
    await feed(page, [0, RESTART, ...Array(45).fill(2), ...Array(60).fill(6)], true);
    await expect.poll(async () => (await st(page)).verdicts.join(), { timeout: 10_000 }).toContain('l2-early:correct');
    await expect.poll(async () => (await st(page)).history.some((h) => h.cause === 'zone'), { timeout: 10_000 }).toBe(true);
    await expect(page.getByTestId('dpt-score')).toContainText('1 came true');
    // now the late jump, from the recorded solution
    await expect.poll(async () => (await st(page)).attempt).toBeGreaterThanOrEqual(2);
    await beat(page, 2);
    const s = await st(page);
    expect(s.verdicts).toContain('l2-early:wrong');
    expect(s.predictions.correct).toBe(1);
    expect(s.predictions.wrong).toBe(1);
    await expect(page.getByTestId('dpt-score')).toContainText('1 came true, 1 did not');
    await expect(page.getByTestId('dpt-score')).toContainText('50% right');
  });

  test('mute silences him but not the game; personality is remembered', async ({ page }) => {
    await page.goto('/#/dont-press-that');
    await page.getByTestId('dpt-menu-tone-chaos').click();
    await page.getByTestId('dpt-menu-mute').click();
    await page.getByTestId('dpt-play').click();
    await page.waitForFunction(() => '__DPT__' in window);
    await expect(page.getByTestId('dpt-line')).toContainText('Host muted');
    expect((await st(page)).line).toBeNull();
    await page.keyboard.down('ArrowRight');
    await expect.poll(async () => (await st(page)).x, { timeout: 5000 }).toBeGreaterThan(2);
    await page.keyboard.up('ArrowRight');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hva.dpt.v1') ?? '{}').settings);
    expect(saved).toMatchObject({ tone: 'chaos', muted: true });
    await page.reload();
    await page.waitForFunction(() => '__DPT__' in window);
    await expect(page.getByTestId('dpt-line')).toContainText('Host muted');
    await page.getByTestId('dpt-settings').click();
    await expect(page.getByTestId('dpt-tone-chaos')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('dpt-mute').click();
    await page.getByTestId('dpt-resume').click();
    await feed(page, [0, RESTART, ...Array(200).fill(2)]); // walk into the first trap: the first death of a level always gets a line
    await expect.poll(async () => (await st(page)).line, { timeout: 8000 }).not.toBeNull();
  });

  test('a hint appears after six deaths and a way to skip after fourteen, never before', async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, 2);
    await expect(page.getByTestId('dpt-hint')).toHaveCount(0);
    await expect(page.getByTestId('dpt-skip')).toHaveCount(0);
    // run, jump early: a repeatable death. Each chunk starts with a restart, so every attempt begins at tick 0.
    const attempt = (): number[] => [0, RESTART, ...Array(45).fill(2), ...Array(30).fill(6), ...Array(15).fill(0)];
    await feed(page, Array.from({ length: 16 }, attempt).flat(), true);
    await expect.poll(async () => (await st(page)).deaths, { timeout: 60_000 }).toBeGreaterThanOrEqual(6);
    await expect(page.getByTestId('dpt-hint')).toBeVisible();
    await expect(page.getByTestId('dpt-skip')).toHaveCount(0);
    await page.getByTestId('dpt-hint').click();
    await expect(page.getByTestId('dpt-line')).toContainText(/vents|ground|spring/i);
    await expect.poll(async () => (await st(page)).deaths, { timeout: 90_000 }).toBeGreaterThanOrEqual(14);
    await expect(page.getByTestId('dpt-skip')).toBeVisible();
  });
});

test.describe("DON'T PRESS THAT: data, accessibility, motion", () => {
  test('a tester\'s link can preset the host (muted or on) for a fair comparison, and Copy my results has numbers only', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
    await page.goto('/#/dont-press-that?host=muted');
    await expect(page.getByTestId('dpt-menu-mute')).toHaveAttribute('aria-checked', 'true');
    await page.goto('/#/dont-press-that?host=on');
    await page.reload();
    await expect(page.getByTestId('dpt-menu-mute')).toHaveAttribute('aria-checked', 'false');
    // after some play, the results summary is offered and contains counts, not text the player typed
    await open(page, 1);
    await feed(page, [0, RESTART, ...Array(200).fill(2)], true);
    await expect.poll(async () => (await st(page)).deaths, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await page.goto('/#/dont-press-that');
    await expect(page.getByTestId('dpt-copy-results')).toBeVisible();
    await page.getByTestId('dpt-copy-results').click();
    await expect(page.getByTestId('dpt-copy-status')).toHaveText(/Copied|would not copy/);
    const text = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    if (text) {
      expect(text).toContain('DON\'T PRESS THAT playtest results');
      expect(text).toMatch(/L1 False Confidence: not cleared, \d+ attempts?, [1-9]\d* deaths?/);
      expect(text).not.toMatch(/http|@/);
    }
  });

  test('writes nothing to the event log without consent; with consent, valid events and no network beyond this site', async ({ page }) => {
    const origins = new Set<string>();
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.protocol.startsWith('http')) origins.add(u.origin);
    });
    await open(page, 1);
    await feed(page, [0, RESTART, ...Array(150).fill(2)]);
    await expect.poll(async () => (await st(page)).history.length).toBeGreaterThan(0);
    expect(await page.evaluate(() => localStorage.getItem('hva.events.v1'))).toBeNull();

    await page.goto('/#/settings');
    await page.getByTestId('research-toggle').click();
    await open(page, 1);
    await page.reload();
    await page.waitForFunction(() => '__DPT__' in window);
    await feed(page, [0, RESTART, ...Array(300).fill(2)]);
    await expect.poll(async () => (await st(page)).attempt, { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hva.events.v1') ?? 'null'));
    const all = (stored.events as EventEnvelope[]).filter((e) => e.game.id === 'dont-press-that');
    expect(all.length).toBeGreaterThan(4);
    for (const e of all) expect(validateEnvelope(e), JSON.stringify(e)).toEqual({ ok: true, errors: [] });
    expect(checkSequence(stored.events as EventEnvelope[])).toEqual([]);
    const types = all.map((e) => e.type);
    expect(types).toContain('attempt_start');
    expect(types).toContain('death');
    expect(types).toContain('respawn');
    expect(types).toContain('inputs');
    const death = all.find((e) => e.type === 'death')!;
    expect(death.payload).toMatchObject({ cause: 'drop' });
    expect(JSON.stringify(all)).not.toMatch(/userAgent|email|name"/i);
    expect([...origins]).toHaveLength(1);
  });

  test('the menu, a level, and the ending have no serious accessibility violations', async ({ page }) => {
    const scan = async (label: string): Promise<void> => {
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes[0]?.html.slice(0, 140)}`), label).toEqual([]);
    };
    await page.goto('/#/dont-press-that');
    await page.waitForTimeout(700); // the screen fades in; scan the settled colours
    await scan('menu');
    await open(page, 1);
    await page.waitForTimeout(500);
    await scan('level');
    await page.getByTestId('dpt-settings').click();
    await page.waitForTimeout(700);
    await scan('settings dialog');
    await page.getByTestId('dpt-resume').click();
    await page.goto('/#/dont-press-that/done?unlock=all');
    await page.waitForTimeout(700);
    await scan('ending');
  });

  test('with reduced motion the game is fully playable and draws no particles or shake', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hva.save.v1', JSON.stringify({ v: 1, levels: {}, achievements: {}, settings: { sound: false, music: false, volume: 0.7, motion: 'reduced' } })));
    await open(page, 1);
    await feed(page, [0, RESTART, ...Array(150).fill(2)]);
    await expect.poll(async () => (await st(page)).history.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe('reduced');
    await expect.poll(async () => (await st(page)).attempt).toBeGreaterThanOrEqual(2);
  });

  test('Escape opens the settings and pauses the world', async ({ page }) => {
    await open(page, 1);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dpt-resume')).toBeVisible();
    const paused = (await st(page)).tick;
    await page.waitForTimeout(400);
    expect((await st(page)).tick).toBe(paused);
    await page.getByTestId('dpt-resume').click();
    await expect.poll(async () => (await st(page)).tick).toBeGreaterThan(paused);
  });

  test('addresses it does not know, or levels not unlocked yet, land on the level list', async ({ page }) => {
    await page.goto('/#/dont-press-that/play/4');
    await expect(page.getByTestId('dpt-menu')).toBeVisible();
    await page.goto('/#/dont-press-that/play/99?unlock=all');
    await expect(page.getByTestId('dpt-menu')).toBeVisible();
    await page.goto('/#/dont-press-that/whatever');
    await expect(page.getByTestId('dpt-menu')).toBeVisible();
    // the ending is not a typed address: without finishing, it goes to the list
    await page.goto('/#/dont-press-that/done');
    await expect(page.getByTestId('dpt-menu')).toBeVisible();
    await expect(page.getByTestId('dpt-end')).toHaveCount(0);
  });
});
