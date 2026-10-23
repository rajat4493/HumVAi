// Live-site smoke test. Usage: node tools/live-smoke.mjs <url>   e.g. https://rajat4493.github.io/HumVAi/
// Runs in Chromium with a desktop profile and two phone profiles. Checks the title screen, World 1, progression,
// saves, sound controls, the campaign ending, that no secrets are in the served files, that the page only talks to its
// own origin, and that reference-solver fixtures are neither loaded by default nor mistakable for an AI when opted in.
// Exit code 1 on any failure. It reads the live site only; it changes nothing.
/* global window, document, localStorage */
import { chromium, devices } from '@playwright/test';

const url = (process.argv[2] ?? '').replace(/\/?$/, '/');
if (!/^https?:\/\//.test(url)) throw new Error('usage: node tools/live-smoke.mjs <url>');
const origin = new URL(url).origin;
const failures = [];
const passes = [];
const check = (ok, label, detail = '') => (ok ? passes.push(label) : failures.push(`${label}${detail ? `: ${detail}` : ''}`));

const SECRET = /sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{32,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|BEGIN (RSA |EC )?PRIVATE KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY|x-api-key/i;
const WORLDS = 20;
const PROFILES = [
  { name: 'desktop 1280x760', opts: { viewport: { width: 1280, height: 760 } }, touch: false },
  { name: 'phone (Pixel 7 profile)', opts: { ...devices['Pixel 7'] }, touch: true },
  { name: 'phone (iPhone 13 profile, Chromium engine)', opts: { ...devices['iPhone 13'], defaultBrowserType: undefined }, touch: true },
];
const KEY = { R: 'ArrowRight', L: 'ArrowLeft', U: 'ArrowUp', D: 'ArrowDown' };
const PAD = { R: 'Move right', L: 'Move left', U: 'Move up', D: 'Move down' };
const press = async (page, keys, touch) => {
  for (const k of keys) {
    if (touch) await page.getByRole('button', { name: PAD[k], exact: true }).click();
    else await page.keyboard.press(KEY[k]);
  }
};
const save = (ids) =>
  JSON.stringify({
    v: 1,
    levels: Object.fromEntries(ids.map((id) => [id, { completed: true, attempts: 1, wins: 1, bestRun: 12, bestUnassistedRun: 12, bestActions: null, firstWonAt: '2026-01-01T00:00:00Z', usedHints: false }])),
    achievements: {},
    settings: { sound: false, music: false, volume: 0.7, motion: 'reduced' },
  });

const browser = await chromium.launch();
try {
  for (const prof of PROFILES) {
    const tag = `[${prof.name}]`;
    const ctx = await browser.newContext(prof.opts);
    const page = await ctx.newPage();
    const problems = [];
    const hosts = new Set();
    const urls = [];
    page.on('pageerror', (e) => problems.push(`pageerror ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && !/recordings\/index\.json/.test(m.text()) && problems.push(`console ${m.text()}`));
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.protocol === 'http:' || u.protocol === 'https:') hosts.add(u.origin);
      urls.push(r.url());
    });

    // 1. title screen
    const res = await page.goto(url);
    check(res?.ok(), `${tag} public URL answers 200`, String(res?.status()));
    await page.getByTestId('play').waitFor({ timeout: 15000 });
    check((await page.title()).includes('Humans vs AI'), `${tag} title screen shows the game title`);

    // 1b. the arcade home and catalogue
    check(/available/i.test(await page.getByTestId('game-experiment').innerText()), `${tag} catalogue: The Experiment is Available`);
    check(/experimental prototype/i.test(await page.getByTestId('game-pattern-hunter').innerText()), `${tag} catalogue: Pattern Hunter is labelled an experimental prototype`);
    check(/coming soon/i.test(await page.getByTestId('game-detective').innerText()) && (await page.getByTestId('game-detective').getByRole('button').count()) === 0, `${tag} catalogue: The Detective is Coming soon with no Play button`);
    check(/experimental prototype/i.test(await page.getByTestId('game-dont-press-that').innerText()), `${tag} catalogue: DON'T PRESS THAT is labelled an experimental prototype`);
    check(/no recorded AI attempts/i.test(await page.getByTestId('experiment-ai-note').innerText()), `${tag} home makes no AI claim without recordings`);
    // DON'T PRESS THAT: the level list opens, level 1 runs, a death comes back within half a second, and the host's score is shown
    await page.goto(`${url}#/dont-press-that`);
    await page.getByTestId('dpt-play').waitFor();
    await page.getByTestId('dpt-play').click();
    await page.waitForFunction(() => '__DPT__' in window);
    await page.evaluate(() => window.__DPT__.feed([8, ...Array(200).fill(2)]));
    await page.waitForFunction(() => window.__DPT__.state().respawnMs !== null, null, { timeout: 8000 });
    const dpt = await page.evaluate(() => window.__DPT__.state());
    check(dpt.respawnMs !== null && dpt.respawnMs < 500, `${tag} DON'T PRESS THAT: after a death, control returned in ${dpt.respawnMs} ms (< 500)`);
    check(/His predictions/i.test(await page.getByTestId('dpt-score').innerText()), `${tag} DON'T PRESS THAT: the host's prediction score is shown`);
    await page.evaluate(() => localStorage.removeItem('hva.dpt.v1'));
    await page.goto(url);
    await page.getByTestId('play').waitFor();
    // Pattern Hunter, direct link, solved with the truthful answers
    await page.goto(`${url}#/pattern-hunter`);
    await page.getByTestId('ph-experimental').waitFor();
    for (const n of [7, 20, 16]) await page.getByTestId(`ph-n-${n}`).click();
    await page.getByTestId('ph-ready').click();
    for (const [n, yes] of [[7, 'no'], [20, 'no'], [15, 'yes'], [38, 'no'], [9, 'no'], [27, 'yes']]) await page.getByTestId(`ph-say-${n}-${yes}`).click();
    await page.getByTestId('ph-submit').click();
    check((await page.getByTestId('ph-result').innerText()).includes('You found the rule'), `${tag} Pattern Hunter prototype is playable from a direct link`);
    await page.goto(url);
    await page.evaluate(() => localStorage.removeItem('hva.ph.v1'));
    await page.reload();
    await page.getByTestId('play').waitFor();

    // 3a. World 1 + progression
    await page.getByTestId('play').click();
    check((await page.getByTestId('progress-summary').innerText()).startsWith(`0 of ${WORLDS}`), `${tag} fresh map says 0 of ${WORLDS} worlds finished`);
    check(await page.getByTestId('node-w02-orange-switch').isDisabled(), `${tag} World 2 is locked on a fresh save`);
    await page.getByTestId('node-w01-first-steps').click();
    await page.getByTestId('begin').click();
    await page.waitForFunction(() => '__HVA__' in window);
    await press(page, 'RRDDRRUU', prof.touch);
    await page.getByTestId('reveal').waitFor({ timeout: 8000 });
    const reveal = (await page.getByTestId('reveal').innerText()).toLowerCase();
    check(/no recorded|waiting/.test(reveal) || /recorded/.test(reveal), `${tag} World 1 result screen opens`);
    check(!/live|thinking/.test(reveal), `${tag} result screen never claims a live or thinking AI`);
    check(!/reference solver|computed player/.test(reveal), `${tag} no reference-solver text without ?fixtures=1`);
    check(/no recorded ai attempt|there is no recorded/.test(reveal), `${tag} result says there is no recorded AI attempt`, reveal.slice(0, 160));

    // 3b. saves survive a reload
    await page.goto(url);
    await page.getByTestId('play').click();
    check((await page.getByTestId('progress-summary').innerText()).startsWith(`1 of ${WORLDS}`), `${tag} progress (1 world) survives a reload`);
    check(await page.getByTestId('node-w02-orange-switch').isEnabled(), `${tag} World 2 unlocks after World 1`);
    const stored = await page.evaluate(() => localStorage.getItem('hva.save.v1'));
    check(!!stored && stored.includes('w01-first-steps'), `${tag} save is in this browser's local storage`);

    // 3c. sound controls persist
    await page.getByTestId('settings-button').click();
    const toggle = page.getByTestId('sound-toggle');
    const before = await toggle.getAttribute('aria-checked');
    await toggle.click();
    const after = await toggle.getAttribute('aria-checked');
    check(before !== after, `${tag} sound switch toggles`);
    await page.goto(url);
    await page.getByTestId('play').click();
    await page.getByTestId('settings-button').click();
    check((await page.getByTestId('sound-toggle').getAttribute('aria-checked')) === after, `${tag} sound setting survives a reload`);

    // 3d. campaign ending (World 20 played for real from a seeded save of the other 19)
    await page.goto(url);
    await page.getByTestId('play').click();
    await page.getByTestId('progress-summary').waitFor(); // the map is a lazy chunk now
    const worldIds = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="node-"]')].map((n) => n.getAttribute('data-testid').slice(5)));
    check(worldIds.length === WORLDS, `${tag} map lists ${WORLDS} worlds`, String(worldIds.length));
    const last = 'w20-the-last-experiment';
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['hva.save.v1', save(worldIds.filter((i) => i !== last))]);
    await page.goto(url);
    await page.getByTestId('play').click();
    await page.getByTestId(`node-${last}`).click();
    await page.getByTestId('begin').click();
    await page.waitForFunction(() => '__HVA__' in window);
    if (prof.touch) await page.getByRole('button', { name: 'Start the run', exact: true }).click();
    else await page.keyboard.press('c');
    await press(page, 'RRRDDRRLLL', prof.touch);
    if (prof.touch) await page.getByRole('button', { name: /^Interact/ }).click();
    else await page.keyboard.press('Shift+ArrowLeft');
    await press(page, 'DRDD', prof.touch);
    await page.getByTestId('finish-experiment').click({ timeout: 8000 });
    await page.getByTestId('finale-title').waitFor();
    const finale = await page.getByTestId('finale-stats').innerText();
    check(finale.includes(`${WORLDS} / ${WORLDS}`), `${tag} World 20 is won and the ending shows 20 / 20`);
    await page.waitForFunction(() => (document.querySelector('[data-testid="finale-ai"]')?.textContent ?? '').length > 10);
    const ai = (await page.getByTestId('finale-ai').innerText()).toLowerCase();
    check(/no recorded ai attempts/.test(ai), `${tag} ending claims no AI result`, ai.slice(0, 120));

    // 5. fixtures: not requested by default; labelled as not-an-AI when explicitly opted in
    check(!urls.some((u) => /\/fixtures\//.test(u)), `${tag} no fixture file was requested during normal play`);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${url}?screen=arena&level=1&briefing=0&fixtures=1`);
    await page.waitForFunction(() => '__HVA__' in window);
    await press(page, 'RRDDRRUU', prof.touch);
    await page.getByTestId('reveal').waitFor({ timeout: 8000 });
    await page.waitForTimeout(1800);
    const fx = (await page.getByTestId('reveal').innerText()).toLowerCase();
    check(/not an ai|reference/.test(fx), `${tag} with ?fixtures=1 the opponent is labelled as a reference solver, not an AI`, fx.slice(0, 200));
    check(!/live|thinking/.test(fx), `${tag} fixture reveal never says live or thinking`);

    // 4. secrets in every served text asset (after the whole flow, so lazy chunks are included)
    if (prof === PROFILES[0]) {
      const assets = urls.filter((u) => u.startsWith(origin) && /\.(js|css|html|json)(\?|$)|\/$/.test(u));
      let scanned = 0;
      for (const a of new Set(assets)) {
        const body = await (await ctx.request.get(a)).text();
        scanned += 1;
        if (SECRET.test(body)) failures.push(`secret-looking text in ${a}`);
      }
      check(scanned > 5, `${tag} scanned ${scanned} served files for key patterns`, scanned <= 5 ? 'too few files scanned' : '');
    }

    // 4. network
    const foreign = [...hosts].filter((h) => h !== origin);
    check(foreign.length === 0, `${tag} page only contacted its own origin`, foreign.join(', '));
    check(!urls.some((u) => /anthropic|openai/i.test(u)), `${tag} no request to an AI provider`);
    check(problems.length === 0, `${tag} no console or page errors`, problems.slice(0, 3).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`${passes.length} checks passed`);
for (const p of passes) console.log(`  ok   ${p}`);
if (failures.length) {
  console.error(`${failures.length} FAILED`);
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
